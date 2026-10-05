import { NextRequest, NextResponse, after } from 'next/server';
import { getVoiceNote, updateVoiceNoteStatus } from '@/lib/db';
import { processVoiceNote, isJobActive } from '@/lib/processing/pipeline';

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

    if (isJobActive(id)) {
      return NextResponse.json({ message: 'Transcription is already in progress' }, { status: 409 });
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
