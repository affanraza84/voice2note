import { getEmbeddingProvider } from '@/lib/ai/embeddings/provider';
import { getLLMProvider } from '@/lib/ai/llm/provider';
import { searchVectorChunks } from '@/lib/db';
import { buildRagPrompt } from '@/lib/ai/prompts';
import { RAGResponse, RAGCitation } from '@/types';

export const UNGROUNDED_FALLBACK_PHRASE = "I couldn't find enough information in your voice notes to answer that.";

export async function queryNotesRAG(question: string, topK = 5): Promise<RAGResponse> {
  const cleanQuery = question.trim();
  if (!cleanQuery) {
    return {
      answer: "Please provide a question about your voice notes.",
      citations: [],
      modelUsed: 'none',
      isGrounded: false,
    };
  }

  // 1. Generate query embedding
  const embeddingProvider = getEmbeddingProvider();
  const queryVector = await embeddingProvider.embed(cleanQuery);

  // 2. Perform vector search (with similarity threshold 0.35)
  const matches = searchVectorChunks(queryVector, topK, 0.35);

  // 3. Build retrieved context
  const retrievedContexts = matches.map((m) => ({
    noteId: m.noteId,
    noteTitle: m.metadata.noteTitle || 'Voice Note',
    text: m.text,
    timestamp: m.metadata.startTime,
    createdAt: m.metadata.createdAt,
    score: m.score,
  }));

  // 4. If no relevant chunks meet threshold, immediately return safe fallback without hallucination
  if (retrievedContexts.length === 0) {
    return {
      answer: UNGROUNDED_FALLBACK_PHRASE,
      citations: [],
      modelUsed: 'local-guardrail',
      isGrounded: false,
    };
  }

  // 5. Build prompt and query local LLM
  const { system, user } = buildRagPrompt(cleanQuery, retrievedContexts);
  const llm = getLLMProvider();

  try {
    const rawAnswer = await llm.generate([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ], { temperature: 0.1 });

    const trimmedAnswer = rawAnswer.trim();

    // Check if the LLM returned the ungrounded refusal phrase
    const isUnanswerable = trimmedAnswer.toLowerCase().includes("couldn't find enough information") ||
      trimmedAnswer.toLowerCase().includes("could not find enough information");

    if (isUnanswerable) {
      return {
        answer: UNGROUNDED_FALLBACK_PHRASE,
        citations: [],
        modelUsed: llm.model,
        isGrounded: false,
      };
    }

    // Build structured citations from matched contexts
    const citations: RAGCitation[] = [];
    const seenNoteIds = new Set<string>();

    for (const ctx of retrievedContexts) {
      if (!seenNoteIds.has(ctx.noteId)) {
        seenNoteIds.add(ctx.noteId);
        citations.push({
          noteId: ctx.noteId,
          noteTitle: ctx.noteTitle,
          quote: ctx.text.slice(0, 160) + (ctx.text.length > 160 ? '...' : ''),
          startTime: ctx.timestamp,
          score: ctx.score,
        });
      }
    }

    return {
      answer: trimmedAnswer,
      citations,
      modelUsed: llm.model,
      isGrounded: true,
    };
  } catch (err: any) {
    console.error('RAG query error:', err);
    throw new Error(`RAG query failed: ${err?.message || err}`);
  }
}
