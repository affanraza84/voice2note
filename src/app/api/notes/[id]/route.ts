import { NextRequest, NextResponse } from 'next/server';
import { getVoiceNote, deleteVoiceNote, updateVoiceNoteTitle } from '@/lib/db';
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
    const { title } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Valid title is required' }, { status: 400 });
    }

    updateVoiceNoteTitle(id, title.trim());
    const updated = getVoiceNote(id);

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
    deleteAudioFiles(id, deleted.audioFileName);

    return NextResponse.json({ success: true, message: 'Voice note and audio deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting note:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete note' },
      { status: 500 }
    );
  }
}
