import { NextRequest, NextResponse } from 'next/server';
import { loadDemoDataset, clearDemoDataset, isDemoModeActive, DEMO_NOTES } from '@/lib/demo/dataset';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const isDemoActive = isDemoModeActive();
  return NextResponse.json({
    isDemoActive,
    availableDemoNotes: DEMO_NOTES.length,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'load';

    if (action === 'clear') {
      const result = clearDemoDataset();
      return NextResponse.json({
        message: 'Demo dataset cleared successfully.',
        clearedCount: result.cleared,
        isDemoActive: false,
      });
    }

    const result = await loadDemoDataset();
    return NextResponse.json({
      message: 'Demo dataset loaded and indexed successfully.',
      loadedCount: result.loaded,
      isDemoActive: true,
    });
  } catch (error: any) {
    console.error('Demo API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to manage demo data' },
      { status: 500 }
    );
  }
}
