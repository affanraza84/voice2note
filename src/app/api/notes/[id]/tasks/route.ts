import { NextRequest, NextResponse } from 'next/server';
import { updateTask } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { taskId, completed, title, dueDate, dueDateType, priority } = body;

    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    if (
      completed === undefined &&
      title === undefined &&
      dueDate === undefined &&
      dueDateType === undefined &&
      priority === undefined
    ) {
      return NextResponse.json(
        { error: 'At least one field to update is required (completed, title, dueDate, dueDateType, priority)' },
        { status: 400 }
      );
    }

    if (priority !== undefined && !['low', 'medium', 'high'].includes(priority)) {
      return NextResponse.json({ error: 'priority must be low, medium, or high' }, { status: 400 });
    }

    if (dueDateType !== undefined && !['explicit', 'inferred', 'none'].includes(dueDateType)) {
      return NextResponse.json({ error: 'dueDateType must be explicit, inferred, or none' }, { status: 400 });
    }

    const updatedTasks = updateTask(id, taskId, {
      completed: typeof completed === 'boolean' ? completed : undefined,
      title: typeof title === 'string' ? title : undefined,
      dueDate: dueDate !== undefined ? dueDate : undefined,
      dueDateType: dueDateType !== undefined ? dueDateType : undefined,
      priority: priority !== undefined ? priority : undefined,
    });

    if (!updatedTasks) {
      return NextResponse.json({ error: 'Task or note not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, tasks: updatedTasks });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update task' }, { status: 500 });
  }
}
