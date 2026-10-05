import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const persona = {
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
  return NextResponse.json({ persona });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, problem, workflow } = body;

    if (name !== undefined) setSetting('FRIEND_NAME', String(name).trim());
    if (problem !== undefined) setSetting('FRIEND_PROBLEM', String(problem).trim());
    if (workflow !== undefined) setSetting('FRIEND_WORKFLOW', String(workflow).trim());

    return NextResponse.json({ message: 'Settings saved successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to save settings' }, { status: 500 });
  }
}
