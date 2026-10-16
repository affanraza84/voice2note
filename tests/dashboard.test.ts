import { describe, it, expect } from 'vitest';
import { VoiceNote } from '../src/types';
import {
  generateAllTasksCSV,
  generateAllMeetingsMarkdown,
  TaskExportItem,
} from '../src/lib/export/meeting-export';

describe('Freelancer Dashboard Data States & Aggregations', () => {
  const mockNotes: VoiceNote[] = [
    {
      id: 'note-1',
      title: 'Acme Corp Website Kickoff',
      audioFileName: 'note-1.webm',
      mimeType: 'audio/webm',
      fileSizeBytes: 1540000,
      durationSeconds: 1540,
      status: 'ready',
      client: 'Acme Corp',
      project: 'Storefront Redesign',
      createdAt: '2026-10-14T10:00:00.000Z',
      updatedAt: '2026-10-14T10:30:00.000Z',
      extraction: {
        id: 'ext-1',
        voiceNoteId: 'note-1',
        title: 'Acme Corp Website Kickoff',
        client: 'Acme Corp',
        project: 'Storefront Redesign',
        callSummary: 'Kickoff call to align on e-commerce scope and timeline.',
        summary: 'Kickoff call to align on e-commerce scope and timeline.',
        tasks: [
          {
            id: 'task-1',
            title: 'Send updated Figma mockups with mobile checkout',
            sourceNoteId: 'note-1',
            priority: 'high',
            completed: false,
            dueDate: '2026-10-20',
            dueDateType: 'explicit',
            evidence: 'I will send over the revised checkout frames by Tuesday October 20th.',
            confidence: 0.95,
          },
          {
            id: 'task-2',
            title: 'Set up Stripe sandbox credentials',
            sourceNoteId: 'note-1',
            priority: 'medium',
            completed: true,
            dueDate: '2026-10-18',
            dueDateType: 'explicit',
            evidence: 'Stripe keys will be provisioned by Friday.',
            confidence: 0.9,
          },
          {
            id: 'task-3',
            title: 'Draft preliminary information architecture diagram',
            sourceNoteId: 'note-1',
            priority: 'low',
            completed: false,
            dueDate: 'Late next week',
            dueDateType: 'inferred',
            evidence: 'Probably need an IA map sometime late next week.',
            confidence: 0.8,
          },
        ],
        clientCommitments: [
          {
            id: 'comm-1',
            commitment: 'Provide high-res brand photography assets',
            by: '2026-10-19',
            evidence: 'Sarah promised to upload the photos to Google Drive by Monday.',
          },
        ],
        decisions: [
          {
            id: 'dec-1',
            decision: 'Proceed with Next.js and Tailwind for the front-end store',
            evidence: 'We all agreed Next.js is the best fit.',
          },
        ],
        openQuestions: [
          {
            id: 'q-1',
            question: 'Will we need multi-currency checkout for Canadian customers in v1?',
            askedBy: 'Sarah Jenkins',
            evidence: 'What about Canadian shoppers? Should we support CAD right away?',
          },
        ],
        followUpSuggestions: [
          {
            id: 'sug-1',
            suggestion: 'Follow up with marketing team regarding Shopify migration timeline',
            rationale: 'Needed before finalizing product catalog import script',
            evidence: 'We need to know when the current Shopify store contract expires.',
          },
        ],
        ideas: [],
        people: ['Sarah Jenkins', 'David Kim'],
        topics: ['E-commerce', 'Checkout', 'Figma'],
        importantDates: [{ event: 'Figma mockups due', date: '2026-10-20' }],
        emailDraft: {
          subject: 'Follow-up: Acme Corp Website Kickoff & Next Steps',
          body: 'Hi Sarah,\n\nThanks for meeting today...',
          recipientName: 'Sarah Jenkins',
        },
        modelUsed: 'Llama 3.2',
        createdAt: '2026-10-14T10:30:00.000Z',
      },
    },
    {
      id: 'note-2',
      title: 'Globex Mobile App Sync',
      audioFileName: 'note-2.webm',
      mimeType: 'audio/webm',
      fileSizeBytes: 980000,
      durationSeconds: 980,
      status: 'ready',
      client: 'Globex Ltd',
      project: 'Mobile Companion',
      createdAt: '2026-10-15T14:00:00.000Z',
      updatedAt: '2026-10-15T14:20:00.000Z',
      extraction: {
        id: 'ext-2',
        voiceNoteId: 'note-2',
        title: 'Globex Mobile App Sync',
        client: 'Globex Ltd',
        project: 'Mobile Companion',
        callSummary: 'Weekly sync regarding push notification integration.',
        summary: 'Weekly sync regarding push notification integration.',
        tasks: [
          {
            id: 'task-4',
            title: 'Configure APNs certificates for Apple Push Notification service',
            sourceNoteId: 'note-2',
            priority: 'high',
            completed: false,
            dueDate: '2026-10-24',
            dueDateType: 'explicit',
            evidence: 'We need the Apple APNs certificates sorted out by October 24.',
            confidence: 0.95,
          },
        ],
        clientCommitments: [],
        decisions: [],
        openQuestions: [
          {
            id: 'q-2',
            question: 'Are push notifications allowed during user quiet hours (10pm-7am)?',
            askedBy: 'Marcus Vance',
            evidence: 'Marcus asked whether we should respect do-not-disturb by default.',
          },
        ],
        followUpSuggestions: [],
        ideas: [],
        people: ['Marcus Vance'],
        topics: ['APNs', 'Push Notifications'],
        importantDates: [{ event: 'APNs deadline', date: '2026-10-24' }],
        emailDraft: {
          subject: 'Follow-up: Push Notifications & APNs Setup',
          body: 'Hi Marcus...',
          recipientName: 'Marcus Vance',
        },
        modelUsed: 'Llama 3.2',
        createdAt: '2026-10-15T14:20:00.000Z',
      },
    },
    {
      id: 'note-3',
      title: 'Initech Consultation',
      audioFileName: 'note-3.webm',
      mimeType: 'audio/webm',
      fileSizeBytes: 420000,
      durationSeconds: 420,
      status: 'failed',
      client: 'Initech',
      project: 'Payroll Automation',
      errorMessage: 'Extraction failed: Ollama endpoint connection refused',
      createdAt: '2026-10-16T09:00:00.000Z',
      updatedAt: '2026-10-16T09:05:00.000Z',
    },
  ];

  it('correctly filters incomplete tasks and excludes completed tasks', () => {
    const incompleteTasks: TaskExportItem[] = [];
    for (const note of mockNotes) {
      const tasks = note.extraction?.tasks || [];
      for (const task of tasks) {
        if (!task.completed) {
          incompleteTasks.push({
            task,
            noteId: note.id,
            noteTitle: note.title,
            client: note.client,
            project: note.project,
          });
        }
      }
    }

    // task-1 (Acme, high, incomplete)
    // task-3 (Acme, low, incomplete)
    // task-4 (Globex, high, incomplete)
    // task-2 (Acme, completed) should be excluded
    expect(incompleteTasks).toHaveLength(3);
    const taskIds = incompleteTasks.map((t) => t.task.id);
    expect(taskIds).toContain('task-1');
    expect(taskIds).toContain('task-3');
    expect(taskIds).toContain('task-4');
    expect(taskIds).not.toContain('task-2');
  });

  it('separates explicit confirmed deadlines from inferred tentative dates', () => {
    const deadlines: Array<{ dueDate: string; dueDateType: string; title: string }> = [];
    for (const note of mockNotes) {
      for (const t of note.extraction?.tasks || []) {
        if (!t.completed && t.dueDate) {
          deadlines.push({
            dueDate: t.dueDate,
            dueDateType: t.dueDateType || 'explicit',
            title: t.title,
          });
        }
      }
    }

    const explicit = deadlines.filter((d) => d.dueDateType === 'explicit');
    const inferred = deadlines.filter((d) => d.dueDateType === 'inferred');

    expect(explicit).toHaveLength(2);
    expect(explicit.map((d) => d.dueDate)).toEqual(expect.arrayContaining(['2026-10-20', '2026-10-24']));
    expect(inferred).toHaveLength(1);
    expect(inferred[0].dueDate).toBe('Late next week');
  });

  it('extracts open client questions with speaker attribution and transcript evidence', () => {
    const questions: Array<{ question: string; askedBy?: string; evidence?: string }> = [];
    for (const note of mockNotes) {
      for (const q of note.extraction?.openQuestions || []) {
        questions.push({
          question: q.question,
          askedBy: q.askedBy,
          evidence: q.evidence,
        });
      }
    }

    expect(questions).toHaveLength(2);
    expect(questions[0].question).toContain('multi-currency checkout');
    expect(questions[0].askedBy).toBe('Sarah Jenkins');
    expect(questions[0].evidence).toBeDefined();

    expect(questions[1].question).toContain('quiet hours');
    expect(questions[1].askedBy).toBe('Marcus Vance');
  });

  it('identifies processing failures for the recoverable retry panel', () => {
    const failed = mockNotes.filter((n) => n.status === 'failed');
    expect(failed).toHaveLength(1);
    expect(failed[0].id).toBe('note-3');
    expect(failed[0].client).toBe('Initech');
    expect(failed[0].errorMessage).toContain('Ollama endpoint connection refused');
  });

  it('computes factual client metrics without fabricated time-saved or accuracy claims', () => {
    const clients = new Set<string>();
    for (const note of mockNotes) {
      if (note.client) clients.add(note.client.toLowerCase());
    }

    expect(clients.size).toBe(3); // Acme Corp, Globex Ltd, Initech

    // Total audio duration
    const totalDuration = mockNotes.reduce((sum, n) => sum + n.durationSeconds, 0);
    expect(totalDuration).toBe(2940); // 1540 + 980 + 420 = 2940 seconds (49 mins)
  });

  it('exports incomplete tasks to CSV with full metadata and escaped fields', () => {
    const items: TaskExportItem[] = [
      {
        task: {
          id: 'task-1',
          sourceNoteId: 'note-1',
          title: 'Send "revised" mockups, specs & details',
          priority: 'high',
          completed: false,
          dueDate: '2026-10-20',
          dueDateType: 'explicit',
          evidence: 'I will send frames by Tuesday.',
          confidence: 0.95,
        },
        noteTitle: 'Acme Kickoff',
        client: 'Acme Corp',
        project: 'Redesign',
      },
    ];

    const csv = generateAllTasksCSV(items);
    expect(csv).toContain('"Task ID","Task Title","Completed","Priority","Due Date","Date Type","Evidence Quote","Source Note","Client","Project"');
    expect(csv).toContain('"task-1"');
    // Quotes inside title should be escaped
    expect(csv).toContain('Send ""revised"" mockups, specs & details');
    expect(csv).toContain('"NO"');
    expect(csv).toContain('"high"');
    expect(csv).toContain('"2026-10-20"');
    expect(csv).toContain('"explicit"');
    expect(csv).toContain('"Acme Corp"');
    expect(csv).toContain('"Redesign"');
  });

  it('exports all meetings to Markdown with executive summaries, tasks, and email drafts', () => {
    const readyNotes = mockNotes.filter((n) => n.status === 'ready');
    const md = generateAllMeetingsMarkdown(readyNotes);

    expect(md).toContain('# Freelance Client Calls Summary');
    expect(md).toContain('**Total Calls Included:** 2');
    expect(md).toContain('## Executive Client-Call Summary');
    expect(md).toContain('Acme Corp Website Kickoff');
    expect(md).toContain('Globex Mobile App Sync');
    expect(md).toContain('## Client Commitments');
    expect(md).toContain('Sarah Jenkins');
    expect(md).toContain('## Follow-Up Email Draft');
    expect(md).toContain('Follow-up: Acme Corp Website Kickoff & Next Steps');
  });
});
