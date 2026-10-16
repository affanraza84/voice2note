import { NextRequest, NextResponse } from 'next/server';
import { updateExtraction } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { callSummary, emailDraft, client, project } = body;

    if (
      callSummary === undefined &&
      emailDraft === undefined &&
      client === undefined &&
      project === undefined
    ) {
      return NextResponse.json(
        { error: 'At least one field (callSummary, emailDraft, client, project) is required' },
        { status: 400 }
      );
    }

    const updatedExtraction = updateExtraction(id, {
      callSummary: typeof callSummary === 'string' ? callSummary : undefined,
      emailDraft: typeof emailDraft === 'object' && emailDraft !== null ? emailDraft : undefined,
      client: typeof client === 'string' ? client : undefined,
      project: typeof project === 'string' ? project : undefined,
    });

    if (!updatedExtraction) {
      return NextResponse.json({ error: 'Extraction or note not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, extraction: updatedExtraction });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to update extraction' },
      { status: 500 }
    );
  }
}
