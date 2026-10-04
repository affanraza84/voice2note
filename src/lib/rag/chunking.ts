import { Transcript, ChunkMetadata } from '@/types';
import crypto from 'crypto';

export interface ChunkInput {
  noteId: string;
  noteTitle: string;
  transcript: Transcript;
  summary?: string;
  topics?: string[];
  createdAt: string;
}

export function chunkTranscriptAndMetadata(input: ChunkInput): Array<{
  id: string;
  noteId: string;
  chunkIndex: number;
  text: string;
  metadata: ChunkMetadata;
}> {
  const chunks: Array<{
    id: string;
    noteId: string;
    chunkIndex: number;
    text: string;
    metadata: ChunkMetadata;
  }> = [];

  let chunkIndex = 0;

  // 1. If summary exists, include it as chunk 0 for fast conceptual matching
  if (input.summary && input.summary.trim().length > 0) {
    const summaryText = `Note Title: "${input.noteTitle}". Summary: ${input.summary.trim()}`;
    chunks.push({
      id: crypto.randomUUID(),
      noteId: input.noteId,
      chunkIndex: chunkIndex++,
      text: summaryText,
      metadata: {
        noteId: input.noteId,
        noteTitle: input.noteTitle,
        chunkIndex: 0,
        startTime: 0,
        endTime: input.transcript.segments.length > 0 ? input.transcript.segments[input.transcript.segments.length - 1].end : 0,
        topic: input.topics && input.topics.length > 0 ? input.topics.join(', ') : 'Overview',
        createdAt: input.createdAt,
      },
    });
  }

  // 2. Sentence / Segment-aware chunking
  const segments = input.transcript.segments || [];

  if (segments.length > 0) {
    let currentChunkSegments: typeof segments = [];
    let currentWordCount = 0;
    const TARGET_WORDS_PER_CHUNK = 80; // ~60-120 words per semantic chunk

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const wordCount = seg.text.split(/\s+/).filter(Boolean).length;
      currentChunkSegments.push(seg);
      currentWordCount += wordCount;

      if (currentWordCount >= TARGET_WORDS_PER_CHUNK || i === segments.length - 1) {
        const text = currentChunkSegments.map((s) => s.text).join(' ').trim();
        if (text.length > 0) {
          chunks.push({
            id: crypto.randomUUID(),
            noteId: input.noteId,
            chunkIndex: chunkIndex++,
            text,
            metadata: {
              noteId: input.noteId,
              noteTitle: input.noteTitle,
              chunkIndex,
              startTime: currentChunkSegments[0].start,
              endTime: currentChunkSegments[currentChunkSegments.length - 1].end,
              topic: input.topics && input.topics.length > 0 ? input.topics[0] : undefined,
              createdAt: input.createdAt,
            },
          });
        }

        // 1-segment overlap for semantic continuity
        if (currentChunkSegments.length > 1 && i < segments.length - 1) {
          currentChunkSegments = [segments[i]];
          currentWordCount = segments[i].text.split(/\s+/).filter(Boolean).length;
        } else {
          currentChunkSegments = [];
          currentWordCount = 0;
        }
      }
    }
  } else if (input.transcript.rawText && input.transcript.rawText.trim().length > 0) {
    // Fallback: Sentence-boundary chunking
    const rawSentences = input.transcript.rawText.match(/[^.!?]+[.!?]+/g) || [input.transcript.rawText];
    let currentSentences: string[] = [];
    let currentWords = 0;

    for (let i = 0; i < rawSentences.length; i++) {
      const sentence = rawSentences[i].trim();
      const words = sentence.split(/\s+/).length;
      currentSentences.push(sentence);
      currentWords += words;

      if (currentWords >= 75 || i === rawSentences.length - 1) {
        const text = currentSentences.join(' ');
        chunks.push({
          id: crypto.randomUUID(),
          noteId: input.noteId,
          chunkIndex: chunkIndex++,
          text,
          metadata: {
            noteId: input.noteId,
            noteTitle: input.noteTitle,
            chunkIndex,
            createdAt: input.createdAt,
          },
        });
        currentSentences = [];
        currentWords = 0;
      }
    }
  }

  return chunks;
}
