import { NextRequest, NextResponse } from 'next/server';
import { getEmbeddingProvider } from '@/lib/ai/embeddings/provider';
import { searchVectorChunks } from '@/lib/db';
import { SearchResult } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || !query.trim()) {
      return NextResponse.json({ results: [] });
    }

    const embedder = getEmbeddingProvider();
    const queryVector = await embedder.embed(query.trim());

    // Retrieve matching chunks
    const matches = searchVectorChunks(queryVector, 25, 0.25);

    // Group and deduplicate by noteId, picking the highest scoring chunk
    const noteMap = new Map<string, SearchResult>();

    for (const match of matches) {
      const existing = noteMap.get(match.noteId);
      if (!existing || match.score > existing.score) {
        noteMap.set(match.noteId, {
          noteId: match.noteId,
          noteTitle: match.metadata.noteTitle || 'Voice Note',
          matchedText: match.text,
          score: Math.round(match.score * 100), // percentage score 0-100%
          startTime: match.metadata.startTime,
          createdAt: match.metadata.createdAt,
        });
      }
    }

    const results = Array.from(noteMap.values());
    results.sort((a, b) => b.score - a.score);

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Semantic search error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to perform semantic search' },
      { status: 500 }
    );
  }
}
