import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';
import {
  getProcessingMode,
  setProcessingMode,
  isCloudOptInConfirmed,
  getModeDisclosure,
  validateModeConfiguration,
} from '@/lib/config/processing-mode';
import { ProcessingMode } from '@/types';

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

  const mode = getProcessingMode();
  const cloudAssistedOptIn = isCloudOptInConfirmed();
  const disclosure = getModeDisclosure(mode);
  const validation = validateModeConfiguration(mode);

  return NextResponse.json({
    persona,
    mode,
    cloudAssistedOptIn,
    disclosure,
    validation,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, problem, workflow, mode, cloudAssistedOptIn } = body;

    if (name !== undefined) setSetting('FRIEND_NAME', String(name).trim());
    if (problem !== undefined) setSetting('FRIEND_PROBLEM', String(problem).trim());
    if (workflow !== undefined) setSetting('FRIEND_WORKFLOW', String(workflow).trim());

    if (mode !== undefined) {
      const targetMode = mode as ProcessingMode;
      if (targetMode !== 'local-private' && targetMode !== 'cloud-assisted') {
        return NextResponse.json({ error: 'Invalid processing mode specified.' }, { status: 400 });
      }

      if (targetMode === 'cloud-assisted' && !cloudAssistedOptIn) {
        return NextResponse.json(
          {
            error:
              'Cloud-Assisted mode requires explicit opt-in confirmation before remote inference or cloud storage can be used.',
          },
          { status: 400 }
        );
      }

      setProcessingMode(targetMode, Boolean(cloudAssistedOptIn));
    }

    const updatedMode = getProcessingMode();
    const updatedOptIn = isCloudOptInConfirmed();

    return NextResponse.json({
      message: 'Settings saved successfully',
      mode: updatedMode,
      cloudAssistedOptIn: updatedOptIn,
      disclosure: getModeDisclosure(updatedMode),
      validation: validateModeConfiguration(updatedMode),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to save settings' }, { status: 500 });
  }
}
