import { NextResponse } from 'next/server';
import { getActiveJobCount } from '@/lib/processing/pipeline';
import { getStats, getSetting } from '@/lib/db';
import { LocalAIStatus } from '@/types';

export async function GET() {
  let ollamaOnline = false;
  let ollamaModels: string[] = [];

  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      const data = await res.json();
      ollamaOnline = true;
      ollamaModels = (data.models || []).map((m: any) => m.name);
    }
  } catch {
    ollamaOnline = false;
  }

  const activeJobs = getActiveJobCount();
  const dbStats = getStats();

  let statusType: LocalAIStatus['status'] = 'ready';
  let label = 'Local AI Ready';

  if (activeJobs > 0) {
    statusType = 'processing';
    label = `Processing Locally (${activeJobs} active)`;
  } else if (!ollamaOnline) {
    // Whisper is ready locally, but LLM is offline
    label = 'Local Speech Ready (Ollama Offline)';
  }

  const status: LocalAIStatus = {
    status: statusType,
    label,
    details: {
      speechModel: 'Xenova/whisper-tiny.en',
      speechEngine: 'Local ONNX (Transformers.js)',
      llmModel: ollamaModels.find((m) => m.includes('llama3.2')) || ollamaModels[0] || 'llama3.2:latest',
      ollamaOnline,
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
    dbStats,
    friendPersona,
    timestamp: new Date().toISOString(),
  });
}
