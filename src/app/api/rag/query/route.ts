import { NextRequest, NextResponse } from 'next/server';
import { queryNotesRAG } from '@/lib/rag/engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Valid question string is required' }, { status: 400 });
    }

    const response = await queryNotesRAG(question);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('RAG endpoint error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process RAG query' },
      { status: 500 }
    );
  }
}
