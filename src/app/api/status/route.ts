import { NextResponse } from 'next/server';
import { getActiveJobCount } from '@/lib/processing/pipeline';
import { getStats, getSetting } from '@/lib/db';
import { getLLMProvider } from '@/lib/ai/llm/provider';
import { getSpeechProvider } from '@/lib/ai/speech/provider';
import { getAudioStorage } from '@/lib/storage';
import { LocalAIStatus } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const llm = getLLMProvider();
  const speech = getSpeechProvider();
  const storage = getAudioStorage();

  const isLlmOnline = await llm.isReady();
  const isSpeechReady = await speech.isReady();

  const activeJobs = getActiveJobCount();
  const dbStats = getStats();

  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production')
  );

  let statusType: LocalAIStatus['status'] = 'ready';
  let label = 'Local AI Ready';

  if (activeJobs > 0) {
    statusType = 'processing';
    label = `Processing (${activeJobs} active)`;
  } else if (!isSpeechReady) {
    statusType = 'starting';
    label = `${speech.name} Standby`;
  } else if (!isLlmOnline) {
    statusType = 'ready';
    label = isServerless 
      ? 'Local Speech Ready (Cloud LLM Standby)' 
      : 'Local Speech Ready (Ollama Offline)';
  } else {
    statusType = 'ready';
    label = `${speech.name} Ready`;
  }

  const status: LocalAIStatus = {
    status: statusType,
    label,
    details: {
      speechModel: speech.model,
      speechEngine: speech.name,
      llmModel: llm.model,
      ollamaOnline: isLlmOnline,
      activeJobs,
    },
  };

  const friendPersona = {
    name: getSetting('FRIEND_NAME', 'Alex (Product Designer)'),
    problem: getSetting(
      'FRIEND_PROBLEM',
      'Records daily voice memos during commutes & brainstorms, but loses commitments, ideas, and action items.'
    ),
    workflow: getSetting(
      'FRIEND_WORKFLOW',
      'Captures quick voice notes on phone/laptop, needs instant action items and end-of-week semantic search.'
    ),
  };

  return NextResponse.json({
    status,
    storage: {
      provider: storage.name,
      id: storage.id,
    },
    dbStats,
    friendPersona,
    timestamp: new Date().toISOString(),
  });
}
