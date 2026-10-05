import { NextRequest, NextResponse } from 'next/server';
import { updateTaskStatus } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { taskId, completed } = body;

    if (!taskId || typeof completed !== 'boolean') {
      return NextResponse.json({ error: 'taskId and completed boolean are required' }, { status: 400 });
    }

    const updatedTasks = updateTaskStatus(id, taskId, completed);
    if (!updatedTasks) {
      return NextResponse.json({ error: 'Task or note not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, tasks: updatedTasks });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update task' }, { status: 500 });
  }
}
