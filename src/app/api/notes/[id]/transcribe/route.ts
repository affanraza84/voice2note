import { NextRequest, NextResponse, after } from 'next/server';
import { getVoiceNote, updateVoiceNoteStatus, saveTranscript } from '@/lib/db';
import { processVoiceNote, isJobActive } from '@/lib/processing/pipeline';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const note = getVoiceNote(id);

    if (!note) {
      return NextResponse.json({ error: 'Voice note not found' }, { status: 404 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    // If client computed the transcript in-browser (e.g. from IndexedDB audio retry)
    if (body.transcriptText && typeof body.transcriptText === 'string' && body.transcriptText.trim().length > 0) {
      console.log(`[Voice2Note] Saving client-provided transcript for note ${id}`);
      saveTranscript({
        id: crypto.randomUUID(),
        voiceNoteId: id,
        rawText: body.transcriptText.trim(),
        segments: body.transcriptSegments || [],
        modelUsed: 'Browser Whisper (ONNX / WebGPU / WASM)',
        processingTimeMs: body.processingTimeMs || 0,
      });
    }

    if (isJobActive(id)) {
      return NextResponse.json({ message: 'Processing is already active' }, { status: 409 });
    }

    // Reset status to processing
    updateVoiceNoteStatus(id, 'processing');

    // Trigger processing safely for serverless environments
    if (typeof after === 'function') {
      after(async () => {
        try {
          await processVoiceNote(id);
        } catch (err) {
          console.error(`Retry processing failed for ${id}:`, err);
        }
      });
    } else {
      queueMicrotask(() => {
        processVoiceNote(id).catch((err) => {
          console.error(`Retry processing failed for ${id}:`, err);
        });
      });
    }

    return NextResponse.json({ message: 'Transcription triggered successfully' });
  } catch (error: any) {
    console.error('Error triggering transcription:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to trigger transcription' },
      { status: 500 }
    );
  }
}
