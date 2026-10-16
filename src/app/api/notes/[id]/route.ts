import { NextRequest, NextResponse } from 'next/server';
import { getVoiceNote, deleteVoiceNote, updateVoiceNoteMetadata } from '@/lib/db';
import { deleteAudioFiles } from '@/lib/storage/audio';

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
      return NextResponse.json({ error: 'Voice note not found' }, { status: 404 });
    }

    return NextResponse.json({ note });
  } catch (error: any) {
    console.error('Error fetching note:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch note' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, client, project } = body;

    if (
      title === undefined &&
      client === undefined &&
      project === undefined
    ) {
      return NextResponse.json({ error: 'At least one field (title, client, project) is required' }, { status: 400 });
    }

    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
      return NextResponse.json({ error: 'Valid title is required if provided' }, { status: 400 });
    }

    const updated = updateVoiceNoteMetadata(id, {
      title: title !== undefined ? title.trim() : undefined,
      client: client !== undefined && typeof client === 'string' ? client.trim() : undefined,
      project: project !== undefined && typeof project === 'string' ? project.trim() : undefined,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Voice note not found' }, { status: 404 });
    }

    return NextResponse.json({ note: updated });
  } catch (error: any) {
    console.error('Error updating note:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update note' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = deleteVoiceNote(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Voice note not found' }, { status: 404 });
    }

    // Clean up physical audio files
    await deleteAudioFiles(id, deleted.audioFileName);

    return NextResponse.json({ success: true, message: 'Voice note and audio deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting note:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete note' },
      { status: 500 }
    );
  }
}
