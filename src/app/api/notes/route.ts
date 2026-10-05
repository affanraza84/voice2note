import { NextRequest, NextResponse, after } from 'next/server';
import { listVoiceNotes, createVoiceNote, saveTranscript, getStats } from '@/lib/db';
import { validateAudioFile, saveAudioBuffer } from '@/lib/storage/audio';
import { processVoiceNote } from '@/lib/processing/pipeline';
import { NoteStatus } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const status = (searchParams.get('status') || undefined) as NoteStatus | undefined;

    const notes = listVoiceNotes(limit, offset, status);
    const stats = getStats();

    return NextResponse.json({ notes, stats });
  } catch (error: any) {
    console.error('Error fetching notes:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const titleInput = formData.get('title') as string | null;
    const durationInput = formData.get('duration') as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided in request' },
        { status: 400 }
      );
    }

    // 1. Validation
    const validation = validateAudioFile({
      size: audioFile.size,
      type: audioFile.type,
      name: audioFile.name,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // 2. Save audio buffer safely
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalName = audioFile.name || `Recording-${new Date().toISOString()}.webm`;
    const mimeType = audioFile.type || 'audio/webm';

    const stored = await saveAudioBuffer(buffer, originalName, mimeType);

    // Duration fallback
    let durationSeconds = stored.durationSeconds;
    if (durationSeconds === 0 && durationInput) {
      const parsed = parseFloat(durationInput);
      if (!isNaN(parsed) && parsed > 0) {
        durationSeconds = Math.round(parsed * 10) / 10;
      }
    }

    // 3. Create database entry
    const defaultTitle = titleInput?.trim() || `Voice Note ${new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    const note = createVoiceNote({
      id: stored.id,
      title: defaultTitle,
      audioFileName: stored.fileName,
      mimeType: stored.mimeType,
      fileSizeBytes: stored.fileSizeBytes,
      durationSeconds,
      status: 'processing',
    });

    const transcriptText = formData.get('transcriptText') as string | null;
    const transcriptSegmentsJson = formData.get('transcriptSegments') as string | null;

    if (transcriptText && transcriptText.trim()) {
      let segments = [];
      try {
        if (transcriptSegmentsJson) segments = JSON.parse(transcriptSegmentsJson);
      } catch {}

      saveTranscript({
        id: crypto.randomUUID(),
        voiceNoteId: note.id,
        rawText: transcriptText.trim(),
        segments,
        modelUsed: 'Browser Whisper (ONNX / WebGPU / WASM)',
        processingTimeMs: 0,
      });
    }

    // 4. Trigger processing pipeline asynchronously (using after() to prevent serverless freeze)
    if (typeof after === 'function') {
      after(async () => {
        try {
          await processVoiceNote(note.id);
        } catch (err) {
          console.error(`Background processing failed for note ${note.id}:`, err);
        }
      });
    } else {
      queueMicrotask(() => {
        processVoiceNote(note.id).catch((err) => {
          console.error(`Background processing failed for note ${note.id}:`, err);
        });
      });
    }

    return NextResponse.json({
      note,
      message: 'Audio received and queued for local transcription.',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error handling audio upload:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to upload and process audio' },
      { status: 500 }
    );
  }
}
