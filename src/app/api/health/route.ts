import { NextResponse } from 'next/server';
import { getAudioStorage } from '@/lib/storage';
import { getSpeechProvider } from '@/lib/ai/speech/provider';
import { getLLMProvider } from '@/lib/ai/llm/provider';
import { getEmbeddingProvider } from '@/lib/ai/embeddings/provider';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const isServerless = Boolean(
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production')
    );

    const storage = getAudioStorage();
    const speech = getSpeechProvider();
    const llm = getLLMProvider();
    const embeddings = getEmbeddingProvider();

    const isLlmConfigured = await llm.isReady();
    const isSpeechConfigured = await speech.isReady();

    return NextResponse.json({
      status: 'ok',
      service: 'Voice2Note',
      environment: process.env.NODE_ENV || 'development',
      serverless: isServerless,
      storage: {
        provider: storage.id,
        persistent: storage.id === 'vercel-blob' || !isServerless,
      },
      ai: {
        speech: {
          provider: speech.id,
          ready: isSpeechConfigured,
        },
        llm: {
          provider: llm.id,
          ready: isLlmConfigured,
        },
        embeddings: {
          provider: embeddings.id,
          dimensions: embeddings.dimensions,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: error?.message || 'Health check encountered an internal failure',
      },
      { status: 500 }
    );
  }
}
