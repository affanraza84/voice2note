import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getVoiceNote } from '@/lib/db';
import { getAudioStorage, getAudioFilePath } from '@/lib/storage/audio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const note = getVoiceNote(id);

    if (!note) {
      return new NextResponse('Audio note not found', { status: 404 });
    }

    const storage = getAudioStorage();
    const audioData = await storage.get(id, note.audioFileName);

    // If persistent object storage (Vercel Blob) returned a public URL, redirect with 307
    if (audioData?.url) {
      return NextResponse.redirect(audioData.url, { status: 307 });
    }

    // Resolve local file path
    const filePath = getAudioFilePath(note.audioFileName);
    if (!filePath || !fs.existsSync(filePath)) {
      return new NextResponse('Audio file missing on disk', { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = request.headers.get('range');
    const contentType = note.mimeType || 'audio/webm';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        return new NextResponse('Requested range not satisfiable', {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      const webReadableStream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
      });

      return new NextResponse(webReadableStream as any, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': contentType,
        },
      });
    } else {
      const fileStream = fs.createReadStream(filePath);
      const webReadableStream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
      });

      return new NextResponse(webReadableStream as any, {
        status: 200,
        headers: {
          'Content-Length': fileSize.toString(),
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
        },
      });
    }
  } catch (error: any) {
    console.error('Audio stream error:', error);
    return new NextResponse('Internal server error streaming audio', { status: 500 });
  }
}

