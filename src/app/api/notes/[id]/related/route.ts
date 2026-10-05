import { NextRequest, NextResponse } from 'next/server';
import { findRelatedNotes } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const related = findRelatedNotes(id, 4);
    return NextResponse.json({ related });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to find related notes' }, { status: 500 });
  }
}
