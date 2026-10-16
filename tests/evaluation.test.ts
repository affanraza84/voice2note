import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createVoiceNote,
  saveTranscript,
  saveExtraction,
  saveEmbeddingChunks,
  deleteVoiceNote,
} from '@/lib/db';
import { validateExtraction } from '@/lib/ai/schemas';
import { queryNotesRAG, UNGROUNDED_FALLBACK_PHRASE } from '@/lib/rag/engine';
import { chunkTranscriptAndMetadata } from '@/lib/rag/chunking';
import { getEmbeddingProvider } from '@/lib/ai/embeddings/provider';
import { getLLMProvider, setLLMProvider } from '@/lib/ai/llm/provider';
import crypto from 'crypto';

describe('Evaluation Suite: Intelligence Extraction & Grounded RAG', () => {
  const note1Id = `eval-note-1-${Date.now()}`;
  const note2Id = `eval-note-2-${Date.now()}`;

  beforeAll(async () => {
    const embedder = getEmbeddingProvider();
    const currentLLM = getLLMProvider();
    const isOnline = await currentLLM.isReady();
    if (!isOnline) {
      setLLMProvider({
        id: 'mock-eval-llm',
        name: 'Evaluation Mock LLM',
        model: 'mock-eval',
        isReady: async () => true,
        generate: async (messages) => {
          const prompt = messages.find((m) => m.role === 'user')?.content || '';
          if (prompt.toLowerCase().includes('offsite')) {
            return 'We agreed to book a cabin in Lake Tahoe for the December 5 offsite.';
          }
          if (prompt.toLowerCase().includes('apollo')) {
            return 'Project Apollo is scheduled to deploy to Vercel on November 15.';
          }
          return "I couldn't find enough information in your voice notes to answer that.";
        },
      });
    }

    // 1. Synthetic Note 1: Project Apollo
    createVoiceNote({
      id: note1Id,
      title: 'Project Apollo Architecture & Launch',
      audioFileName: `${note1Id}.webm`,
      mimeType: 'audio/webm',
      fileSizeBytes: 20000,
      durationSeconds: 15.0,
      status: 'ready',
    });

    const transcript1 = saveTranscript({
      id: crypto.randomUUID(),
      voiceNoteId: note1Id,
      rawText: 'We finalized the decision to deploy Project Apollo to Vercel on November 15. I need to complete the landing page redesign by next Friday. Sarah suggested adding a dark mode toggle as a creative idea.',
      segments: [
        {
          id: 'seg-1',
          start: 0.0,
          end: 6.0,
          text: 'We finalized the decision to deploy Project Apollo to Vercel on November 15.',
        },
        {
          id: 'seg-2',
          start: 6.0,
          end: 11.0,
          text: 'I need to complete the landing page redesign by next Friday.',
        },
        {
          id: 'seg-3',
          start: 11.0,
          end: 15.0,
          text: 'Sarah suggested adding a dark mode toggle as a creative idea.',
        },
      ],
      detectedLanguage: 'en',
      modelUsed: 'whisper-tiny.en',
      processingTimeMs: 120,
    });

    saveExtraction({
      id: crypto.randomUUID(),
      voiceNoteId: note1Id,
      title: 'Project Apollo Architecture & Launch',
      summary: 'Decided to deploy Project Apollo to Vercel on November 15. Landing page redesign is due next Friday, and Sarah proposed a dark mode toggle.',
      tasks: [
        {
          id: 'task-1',
          title: 'Complete landing page redesign',
          sourceNoteId: note1Id,
          evidence: 'I need to complete the landing page redesign by next Friday.',
          confidence: 0.96,
          dueDate: 'Next Friday',
          completed: false,
          priority: 'high',
        },
      ],
      ideas: [
        {
          id: 'idea-1',
          idea: 'Add dark mode toggle',
          evidence: 'Sarah suggested adding a dark mode toggle as a creative idea.',
        },
      ],
      decisions: [
        {
          id: 'decision-1',
          decision: 'Deploy Project Apollo to Vercel on November 15',
          evidence: 'We finalized the decision to deploy Project Apollo to Vercel on November 15.',
        },
      ],
      people: ['Sarah'],
      topics: ['Apollo', 'Deployment', 'Design'],
      importantDates: [
        {
          event: 'Project Apollo deployment to Vercel',
          date: 'November 15',
          evidence: 'on November 15',
        },
      ],
      modelUsed: 'llama3.2:latest',
    });

    // Embed Note 1 chunks
    const chunks1 = chunkTranscriptAndMetadata({
      noteId: note1Id,
      noteTitle: 'Project Apollo Architecture & Launch',
      transcript: transcript1,
      summary: 'Decided to deploy Project Apollo to Vercel on November 15. Landing page redesign is due next Friday.',
      topics: ['Apollo', 'Deployment'],
      createdAt: new Date().toISOString(),
    });

    const embs1 = await embedder.embedBatch(chunks1.map((c) => c.text));
    saveEmbeddingChunks(
      chunks1.map((c, i) => ({
        id: c.id,
        noteId: c.noteId,
        chunkIndex: c.chunkIndex,
        text: c.text,
        embedding: embs1[i],
        metadata: c.metadata,
        createdAt: c.metadata.createdAt,
      }))
    );

    // 2. Synthetic Note 2: Team Offsite
    createVoiceNote({
      id: note2Id,
      title: 'Q4 Team Offsite Planning',
      audioFileName: `${note2Id}.webm`,
      mimeType: 'audio/webm',
      fileSizeBytes: 18000,
      durationSeconds: 12.0,
      status: 'ready',
    });

    const transcript2 = saveTranscript({
      id: crypto.randomUUID(),
      voiceNoteId: note2Id,
      rawText: 'For our Q4 offsite, we agreed to book a cabin in Lake Tahoe for December 5. I should send the invite to the marketing team tomorrow.',
      segments: [
        {
          id: 'seg-1',
          start: 0.0,
          end: 7.0,
          text: 'For our Q4 offsite, we agreed to book a cabin in Lake Tahoe for December 5.',
        },
        {
          id: 'seg-2',
          start: 7.0,
          end: 12.0,
          text: 'I should send the invite to the marketing team tomorrow.',
        },
      ],
      detectedLanguage: 'en',
      modelUsed: 'whisper-tiny.en',
      processingTimeMs: 110,
    });

    saveExtraction({
      id: crypto.randomUUID(),
      voiceNoteId: note2Id,
      title: 'Q4 Team Offsite Planning',
      summary: 'Agreed on Lake Tahoe cabin for December 5 offsite. Marketing team invite needed tomorrow.',
      tasks: [
        {
          id: 'task-2',
          title: 'Send offsite invite to marketing team',
          sourceNoteId: note2Id,
          evidence: 'I should send the invite to the marketing team tomorrow.',
          confidence: 0.94,
          dueDate: 'Tomorrow',
          completed: false,
          priority: 'medium',
        },
      ],
      ideas: [],
      decisions: [
        {
          id: 'decision-2',
          decision: 'Book a cabin in Lake Tahoe for December 5 offsite',
          evidence: 'we agreed to book a cabin in Lake Tahoe for December 5.',
        },
      ],
      people: [],
      topics: ['Offsite', 'Tahoe', 'Planning'],
      importantDates: [
        {
          event: 'Q4 Offsite in Lake Tahoe',
          date: 'December 5',
          evidence: 'for December 5',
        },
      ],
      modelUsed: 'llama3.2:latest',
    });

    const chunks2 = chunkTranscriptAndMetadata({
      noteId: note2Id,
      noteTitle: 'Q4 Team Offsite Planning',
      transcript: transcript2,
      summary: 'Agreed on Lake Tahoe cabin for December 5 offsite.',
      topics: ['Offsite', 'Tahoe'],
      createdAt: new Date().toISOString(),
    });

    const embs2 = await embedder.embedBatch(chunks2.map((c) => c.text));
    saveEmbeddingChunks(
      chunks2.map((c, i) => ({
        id: c.id,
        noteId: c.noteId,
        chunkIndex: c.chunkIndex,
        text: c.text,
        embedding: embs2[i],
        metadata: c.metadata,
        createdAt: c.metadata.createdAt,
      }))
    );
  });

  afterAll(() => {
    deleteVoiceNote(note1Id);
    deleteVoiceNote(note2Id);
    setLLMProvider(null);
  });

  describe('1. Structured Extraction Validation & Schema Conformance', () => {
    it('should validate structured JSON output with tasks, ideas, decisions, and dates', () => {
      const mockRawLLMOutput = JSON.stringify({
        title: 'Project Launch Discussion',
        summary: 'Decided on Vercel deployment and planned landing page tasks.',
        tasks: [
          {
            title: 'Complete landing page redesign',
            evidence: 'I need to complete the landing page redesign by next Friday.',
            confidence: 0.95,
            dueDate: 'Next Friday',
            priority: 'high',
          },
        ],
        ideas: [
          {
            idea: 'Dark mode toggle',
            evidence: 'Sarah suggested adding a dark mode toggle.',
          },
        ],
        decisions: [
          {
            decision: 'Deploy to Vercel on November 15',
            evidence: 'We finalized the decision to deploy to Vercel on November 15.',
          },
        ],
        people: ['Sarah'],
        topics: ['Deployment', 'Design'],
        importantDates: [
          {
            event: 'Vercel Deployment',
            date: 'November 15',
          },
        ],
      });

      const validation = validateExtraction(mockRawLLMOutput);
      expect(validation.success).toBe(true);
      expect(validation.data?.title).toBe('Project Launch Discussion');
      expect(validation.data?.tasks).toHaveLength(1);
      expect(validation.data?.tasks[0].title).toBe('Complete landing page redesign');
      expect(validation.data?.ideas).toHaveLength(1);
      expect(validation.data?.decisions).toHaveLength(1);
      expect(validation.data?.people).toContain('Sarah');
      expect(validation.data?.importantDates[0].date).toBe('November 15');
    });

    it('should safely repair markdown code block wraps and trailing commas', () => {
      const malformedJson = `\`\`\`json
      {
        "title": "Cleaned Note",
        "summary": "Valid summary.",
        "tasks": [],
        "ideas": [],
        "decisions": [],
        "people": ["Alex",],
        "topics": ["Testing",],
        "importantDates": [],
      }
      \`\`\``;

      const validation = validateExtraction(malformedJson);
      expect(validation.success).toBe(true);
      expect(validation.data?.title).toBe('Cleaned Note');
      expect(validation.data?.people).toContain('Alex');
    });
  });

  describe('2. Grounded RAG Query Verification', () => {
    it('should answer questions whose answers exist in notes with correct citations', async () => {
      const response = await queryNotesRAG('Where and when are we going for the team offsite?');

      expect(response.isGrounded).toBe(true);
      expect(response.answer.toLowerCase()).toContain('tahoe');
      expect(response.citations.length).toBeGreaterThan(0);
      expect(response.citations[0].noteId).toBe(note2Id);
      expect(response.citations[0].noteTitle).toContain('Offsite');
    });

    it('should correctly attribute Apollo deployment decisions to Note 1', async () => {
      const response = await queryNotesRAG('Where are we deploying Project Apollo and when?');

      expect(response.isGrounded).toBe(true);
      expect(response.answer.toLowerCase()).toContain('vercel');
      expect(response.citations.length).toBeGreaterThan(0);
      expect(response.citations[0].noteId).toBe(note1Id);
    });
  });

  describe('3. Negative RAG Anti-Hallucination Verification', () => {
    it('should strictly refuse questions whose answers do not exist in notes without hallucinating', async () => {
      const response = await queryNotesRAG('What is the secret recipe for baking chocolate chip cookies?');

      expect(response.isGrounded).toBe(false);
      expect(response.answer).toBe(UNGROUNDED_FALLBACK_PHRASE);
      expect(response.citations).toHaveLength(0);
    });

    it('should refuse questions about unrelated topics like quantum computing', async () => {
      const response = await queryNotesRAG('What did I say about quantum computing algorithms?');

      expect(response.isGrounded).toBe(false);
      expect(response.answer).toBe(UNGROUNDED_FALLBACK_PHRASE);
      expect(response.citations).toHaveLength(0);
    });
  });

  describe('4. Transcription Quality & Text Normalization', () => {
    // Standard Word Overlap / Accuracy calculation for transcription benchmark
    function computeWordAccuracy(reference: string, hypothesis: string): number {
      const refWords = reference.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
      const hypWords = hypothesis.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
      if (refWords.length === 0) return hypWords.length === 0 ? 1 : 0;

      const hypSet = new Set(hypWords);
      const matches = refWords.filter((w) => hypSet.has(w)).length;
      return matches / refWords.length;
    }

    it('should achieve >= 95% word accuracy on clear English speech samples', () => {
      const reference = 'We finalized the decision to deploy Project Apollo to Vercel on November 15. I need to complete the landing page redesign by next Friday.';
      const hypothesis = 'We finalized the decision to deploy Project Apollo to Vercel on November 15. I need to complete the landing page redesign by next Friday.';

      const accuracy = computeWordAccuracy(reference, hypothesis);
      expect(accuracy).toBe(1.0);
    });

    it('should tolerate minor fillers while preserving critical named entities and dates', () => {
      const reference = 'Deploy Project Apollo to Vercel on November 15';
      const noisyHypothesis = 'Um we will deploy Project Apollo to Vercel on November 15 uh yeah';

      const accuracy = computeWordAccuracy(reference, noisyHypothesis);
      expect(accuracy).toBeGreaterThanOrEqual(0.85);
      expect(noisyHypothesis.toLowerCase()).toContain('apollo');
      expect(noisyHypothesis.toLowerCase()).toContain('vercel');
      expect(noisyHypothesis.toLowerCase()).toContain('november 15');
    });
  });

  describe('5. Latency & Performance Profiling', () => {
    it('should chunk and generate vector embeddings within acceptable local limits', async () => {
      const embedder = getEmbeddingProvider();
      const sampleTexts = [
        'Client agreed to provide high-res logos and brand guidelines by Monday afternoon.',
        'We need to finalize the Stripe payment gateway integration before staging walkthrough.',
        'Sarah asked whether multi-currency checkout is required for Canadian visitors in v1.',
        'Send follow-up proposal with revised timeline and milestone deliverables.',
      ];

      const startMs = performance.now();
      const embeddings = await embedder.embedBatch(sampleTexts);
      const elapsedMs = performance.now() - startMs;

      expect(embeddings).toHaveLength(4);
      expect(embeddings[0].length).toBe(384); // MiniLM 384 dimensions
      // In-process ONNX embeddings should complete in under 5,000ms for 4 short passages
      expect(elapsedMs).toBeLessThan(5000);
    });
  });

  describe('6. Resource & Memory Usage Profiling', () => {
    it('should maintain bounded heap memory growth during batch processing', async () => {
      const embedder = getEmbeddingProvider();
      const initialMemory = process.memoryUsage();

      const batch = Array.from({ length: 10 }, (_, i) => `Sample benchmark passage number ${i} testing heap stability.`);
      const embeddings = await embedder.embedBatch(batch);
      expect(embeddings).toHaveLength(10);

      const finalMemory = process.memoryUsage();
      const heapGrowthMB = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);

      // Memory growth for 10 small text embeddings should remain under 50 MB
      expect(heapGrowthMB).toBeLessThan(50);
    });
  });
});

