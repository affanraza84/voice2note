import {
  getVoiceNote,
  updateVoiceNoteStatus,
  updateVoiceNoteTitle,
  updateVoiceNoteMetadata,
  saveTranscript,
  saveExtraction,
  saveEmbeddingChunks,
  deleteEmbeddingChunksForNote,
  getSetting,
} from '@/lib/db';
import { getAudioStorage } from '@/lib/storage';
import { getSpeechProvider } from '@/lib/ai/speech/provider';
import { getLLMProvider } from '@/lib/ai/llm/provider';
import { getEmbeddingProvider } from '@/lib/ai/embeddings/provider';
import { buildExtractionPrompt } from '@/lib/ai/prompts';
import { validateExtraction } from '@/lib/ai/schemas';
import { chunkTranscriptAndMetadata } from '@/lib/rag/chunking';
import crypto from 'crypto';

// Active processing tasks tracker
const activeJobs = new Set<string>();

export function getActiveJobCount(): number {
  return activeJobs.size;
}

export function isJobActive(noteId: string): boolean {
  return activeJobs.has(noteId);
}

export interface StageOutcome {
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  durationMs?: number;
}

export interface PipelineResult {
  noteId: string;
  success: boolean;
  stages: {
    transcription: StageOutcome;
    extraction: StageOutcome;
    embedding: StageOutcome;
  };
  error?: string;
}

export interface ProcessOptions {
  forceRetranscribe?: boolean;
  forceReextract?: boolean;
  forceReembed?: boolean;
}

export async function processVoiceNote(
  noteId: string,
  options?: ProcessOptions
): Promise<PipelineResult> {
  const note = getVoiceNote(noteId);
  if (!note) {
    throw new Error(`VoiceNote not found with id: ${noteId}`);
  }

  // Prevent duplicate concurrent runs for the same note
  if (activeJobs.has(noteId)) {
    console.log(`Note ${noteId} is already being processed.`);
    return {
      noteId,
      success: false,
      stages: {
        transcription: { status: 'skipped' },
        extraction: { status: 'skipped' },
        embedding: { status: 'skipped' },
      },
      error: `Note ${noteId} is already being processed.`,
    };
  }

  activeJobs.add(noteId);

  const transcriptionOutcome: StageOutcome = { status: 'skipped' };
  let extractionOutcome: StageOutcome = { status: 'skipped' };
  let embeddingOutcome: StageOutcome = { status: 'skipped' };

  try {
    let savedTranscript = note.transcript;
    let savedExtraction = note.extraction;
    let finalDuration = note.durationSeconds;

    // ---------------------------------------------------------
    // 1 & 2. Transcription Stage
    // ---------------------------------------------------------
    if (!savedTranscript || options?.forceRetranscribe) {
      updateVoiceNoteStatus(noteId, 'transcribing');
      const speechStartTime = Date.now();

      try {
        const storage = getAudioStorage();
        const processingFile = await storage.getFilePathForProcessing(note.id, note.audioFileName);

        let result;
        try {
          const speechProvider = getSpeechProvider();

          // Timeout guard for serverless lambdas (14s max so lambda doesn't terminate silently)
          const isServerless = Boolean(
            process.env.VERCEL ||
            process.env.AWS_LAMBDA_FUNCTION_NAME ||
            (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production')
          );

          if (isServerless && speechProvider.id === 'local-whisper') {
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => {
                reject(
                  new Error(
                    'Serverless execution timeout: Local ONNX model download exceeds lambda limits. In-browser Whisper will transcribe on your device.'
                  )
                );
              }, 12000);
            });
            result = await Promise.race([
              speechProvider.transcribe({
                filePath: processingFile.filePath,
                mimeType: note.mimeType,
                durationSeconds: note.durationSeconds,
              }),
              timeoutPromise,
            ]);
          } else {
            result = await speechProvider.transcribe({
              filePath: processingFile.filePath,
              mimeType: note.mimeType,
              durationSeconds: note.durationSeconds,
            });
          }
        } finally {
          // Ephemeral cleanup for downloaded temporary audio
          await processingFile.cleanup();
        }

        const transcriptId = savedTranscript?.id || crypto.randomUUID();
        savedTranscript = saveTranscript({
          id: transcriptId,
          voiceNoteId: noteId,
          rawText: result.text || '(No audible speech detected in recording)',
          segments: result.segments,
          detectedLanguage: result.language,
          modelUsed: result.modelUsed,
          processingTimeMs: result.processingTimeMs,
        });

        if (result.duration > 0) {
          finalDuration = result.duration;
        }

        transcriptionOutcome.status = 'success';
        transcriptionOutcome.durationMs = Date.now() - speechStartTime;
      } catch (speechErr: any) {
        transcriptionOutcome.status = 'failed';
        transcriptionOutcome.error = speechErr?.message || 'Transcription failed';
        transcriptionOutcome.durationMs = Date.now() - speechStartTime;

        updateVoiceNoteStatus(noteId, 'failed', `Transcription: ${transcriptionOutcome.error}`, finalDuration);
        return {
          noteId,
          success: false,
          stages: {
            transcription: transcriptionOutcome,
            extraction: { status: 'skipped' },
            embedding: { status: 'skipped' },
          },
          error: transcriptionOutcome.error,
        };
      }
    } else {
      transcriptionOutcome.status = 'skipped';
    }

    updateVoiceNoteStatus(noteId, 'analyzing', null, finalDuration);

    // ---------------------------------------------------------
    // 3. Structured Intelligence Extraction Stage
    // ---------------------------------------------------------
    let summaryText = savedExtraction?.summary || 'Recording transcribed successfully.';
    let topicsList: string[] = savedExtraction?.topics || [];

    const rawTranscriptText = savedTranscript?.rawText || '';
    const hasAudibleText =
      rawTranscriptText.trim().length > 5 &&
      !rawTranscriptText.includes('(No audible speech detected in recording)');

    if (!hasAudibleText) {
      // Nothing to extract from inaudible recordings
      extractionOutcome = { status: 'skipped' };
    } else if (savedExtraction && !options?.forceReextract) {
      // Safe retry: Preserve existing successful extraction and user tasks without duplicating
      extractionOutcome = { status: 'skipped' };
    } else {
      const extractionStartTime = Date.now();
      const llm = getLLMProvider();
      const isLlmOnline = await llm.isReady();

      if (!isLlmOnline) {
        const errDetail = `LLM provider (${llm.name}) is offline or unreachable.`;
        console.warn(`Extraction error for note ${noteId}: ${errDetail}`);
        extractionOutcome = {
          status: 'failed',
          error: errDetail,
          durationMs: Date.now() - extractionStartTime,
        };
      } else {
        const persona = {
          name: getSetting('FRIEND_NAME', 'Alex'),
          problem: getSetting('FRIEND_PROBLEM', ''),
          workflow: getSetting('FRIEND_WORKFLOW', ''),
        };

        const { system, user } = buildExtractionPrompt(rawTranscriptText, persona);

        try {
          const rawJsonOutput = await llm.generate(
            [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            { responseFormat: 'json', temperature: 0.1 }
          );

          const validation = validateExtraction(rawJsonOutput);

          if (!validation.success || !validation.data) {
            throw new Error(`Extraction validation failed: ${validation.error || 'Invalid JSON format'}`);
          }

          const data = validation.data;
          summaryText = data.summary;
          topicsList = data.topics;

          // If the note currently has a generic default title, apply the LLM's smart title
          const refreshedNote = getVoiceNote(noteId);
          const currentTitle = refreshedNote?.title || note.title;
          const isGenericTitle =
            currentTitle.startsWith('Voice Note') ||
            currentTitle.startsWith('Recording-') ||
            currentTitle.trim() === '';

          if (isGenericTitle && data.title && data.title.trim().length > 0) {
            updateVoiceNoteTitle(noteId, data.title.trim());
          }

          // If client or project are identified and note metadata is empty, update note metadata
          if ((data.client || data.project) && (!refreshedNote?.client || !refreshedNote?.project)) {
            updateVoiceNoteMetadata(noteId, {
              client: refreshedNote?.client || data.client,
              project: refreshedNote?.project || data.project,
            });
          }

          // Format task items with UUIDs, sourceNoteId, and dueDateType
          const tasks = data.tasks.map((t) => ({
            id: crypto.randomUUID(),
            title: t.title,
            sourceNoteId: noteId,
            evidence: t.evidence,
            confidence: t.confidence,
            dueDate: t.dueDate,
            dueDateType: t.dueDateType,
            completed: false,
            priority: t.priority,
          }));

          const clientCommitments = data.clientCommitments.map((c) => ({
            id: crypto.randomUUID(),
            commitment: c.commitment,
            evidence: c.evidence,
            by: c.by,
          }));

          const ideas = data.ideas.map((i) => ({
            id: crypto.randomUUID(),
            idea: i.idea,
            evidence: i.evidence,
          }));

          const decisions = data.decisions.map((d) => ({
            id: crypto.randomUUID(),
            decision: d.decision,
            evidence: d.evidence,
          }));

          const openQuestions = data.openQuestions.map((q) => ({
            id: crypto.randomUUID(),
            question: q.question,
            evidence: q.evidence,
            askedBy: q.askedBy,
          }));

          const followUpSuggestions = data.followUpSuggestions.map((s) => ({
            id: crypto.randomUUID(),
            suggestion: s.suggestion,
            evidence: s.evidence,
            rationale: s.rationale,
          }));

          const importantDates = data.importantDates.map((dt) => ({
            event: dt.event,
            date: dt.date,
            evidence: dt.evidence,
          }));

          savedExtraction = saveExtraction({
            id: savedExtraction?.id || crypto.randomUUID(),
            voiceNoteId: noteId,
            title: data.title,
            client: data.client,
            project: data.project,
            callSummary: data.callSummary,
            summary: data.summary,
            tasks,
            clientCommitments,
            ideas,
            decisions,
            openQuestions,
            followUpSuggestions,
            people: data.people,
            topics: data.topics,
            importantDates,
            emailDraft: data.emailDraft,
            modelUsed: llm.model,
          });

          extractionOutcome = {
            status: 'success',
            durationMs: Date.now() - extractionStartTime,
          };
        } catch (llmErr: any) {
          console.error(`Extraction failure for note ${noteId}:`, llmErr);
          extractionOutcome = {
            status: 'failed',
            error: llmErr?.message || 'LLM extraction failed',
            durationMs: Date.now() - extractionStartTime,
          };
        }
      }
    }

    // ---------------------------------------------------------
    // 4. Vector Chunking & Embedding Ingestion Stage
    // ---------------------------------------------------------
    const embeddingStartTime = Date.now();
    try {
      const refreshedNote = getVoiceNote(noteId);
      const activeTitle = refreshedNote?.title || note.title;

      const rawChunks = chunkTranscriptAndMetadata({
        noteId,
        noteTitle: activeTitle,
        transcript: savedTranscript,
        summary: summaryText,
        topics: topicsList,
        createdAt: note.createdAt,
      });

      if (rawChunks.length > 0) {
        const embedder = getEmbeddingProvider();
        const texts = rawChunks.map((c) => c.text);
        const embeddings = await embedder.embedBatch(texts);

        const vectorChunks = rawChunks.map((c, idx) => ({
          id: c.id,
          noteId: c.noteId,
          chunkIndex: c.chunkIndex,
          text: c.text,
          embedding: embeddings[idx],
          metadata: c.metadata,
          createdAt: note.createdAt,
        }));

        // Safe retry: clear previous chunks first to prevent duplicate embeddings
        deleteEmbeddingChunksForNote(noteId);
        saveEmbeddingChunks(vectorChunks);

        embeddingOutcome = {
          status: 'success',
          durationMs: Date.now() - embeddingStartTime,
        };
      } else {
        embeddingOutcome = { status: 'skipped' };
      }
    } catch (embErr: any) {
      console.error(`Vector embedding failure for note ${noteId}:`, embErr);
      embeddingOutcome = {
        status: 'failed',
        error: embErr?.message || 'Vector embedding failed',
        durationMs: Date.now() - embeddingStartTime,
      };
    }

    // ---------------------------------------------------------
    // 5. Finalize status: Track stage outcomes
    // ---------------------------------------------------------
    const stageErrors: string[] = [];
    if (extractionOutcome.status === 'failed') {
      stageErrors.push(`Extraction: ${extractionOutcome.error}`);
    }
    if (embeddingOutcome.status === 'failed') {
      stageErrors.push(`Embedding: ${embeddingOutcome.error}`);
    }

    const pipelineSuccess = stageErrors.length === 0;

    if (pipelineSuccess) {
      updateVoiceNoteStatus(noteId, 'ready', null, finalDuration);
    } else {
      const combinedError = stageErrors.join('; ');
      updateVoiceNoteStatus(noteId, 'failed', combinedError, finalDuration);
    }

    return {
      noteId,
      success: pipelineSuccess,
      stages: {
        transcription: transcriptionOutcome,
        extraction: extractionOutcome,
        embedding: embeddingOutcome,
      },
      error: pipelineSuccess ? undefined : stageErrors.join('; '),
    };
  } catch (err: any) {
    console.error(`Pipeline failure for note ${noteId}:`, err);
    const message = err?.message || 'Unknown processing error occurred';
    updateVoiceNoteStatus(noteId, 'failed', message);

    return {
      noteId,
      success: false,
      stages: {
        transcription: transcriptionOutcome,
        extraction: extractionOutcome,
        embedding: embeddingOutcome,
      },
      error: message,
    };
  } finally {
    activeJobs.delete(noteId);
  }
}
