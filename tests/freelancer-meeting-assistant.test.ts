import { describe, it, expect, afterEach } from 'vitest';
import {
  createVoiceNote,
  getVoiceNote,
  saveExtraction,
  updateVoiceNoteMetadata,
  updateTask,
  updateExtraction,
  deleteVoiceNote,
} from '@/lib/db';
import {
  StructuredExtractionSchema,
  validateExtraction,
  TaskSchema,
  ClientCommitmentSchema,
  OpenQuestionSchema,
  FollowUpSuggestionSchema,
} from '@/lib/ai/schemas';
import { buildExtractionPrompt } from '@/lib/ai/prompts';
import {
  generateMeetingMarkdown,
  generateTasksCSV,
  generateMailtoUrl,
} from '@/lib/export/meeting-export';
import { DEMO_NOTES } from '@/lib/demo/dataset';
import { VoiceNote } from '@/types';

describe('Freelancer Meeting Follow-Up Assistant Suite', () => {
  const testNoteId = `freelance-test-${Date.now()}`;

  afterEach(() => {
    try {
      deleteVoiceNote(testNoteId);
    } catch {}
  });

  describe('1. Zod Schemas & Anti-Hallucination Date Rules', () => {
    it('validates explicit vs inferred vs none dueDateType on tasks', () => {
      const explicitTask = TaskSchema.parse({
        title: 'Submit Figma prototype',
        evidence: 'deliver the wireframes by November 21st',
        confidence: 0.95,
        dueDate: 'November 21st',
        dueDateType: 'explicit',
        priority: 'high',
      });
      expect(explicitTask.dueDateType).toBe('explicit');

      const inferredTask = TaskSchema.parse({
        title: 'Run user testing sessions',
        evidence: 'sometime late next month',
        confidence: 0.85,
        dueDate: 'Late next month',
        dueDateType: 'inferred',
        priority: 'medium',
      });
      expect(inferredTask.dueDateType).toBe('inferred');

      const noDateTask = TaskSchema.parse({
        title: 'Check OAuth configuration',
        evidence: 'whether OAuth suffices',
        confidence: 0.9,
        dueDate: null,
        dueDateType: 'none',
        priority: 'low',
      });
      expect(noDateTask.dueDateType).toBe('none');
      expect(noDateTask.dueDate).toBeNull();
    });

    it('defaults dueDateType to none when not specified and no date is present', () => {
      const task = TaskSchema.parse({
        title: 'Review codebase',
        evidence: 'take a look at code',
      });
      expect(task.dueDateType).toBe('none');
      expect(task.dueDate).toBeUndefined();
    });

    it('validates client commitments with verbatim evidence quote and owner', () => {
      const commitment = ClientCommitmentSchema.parse({
        commitment: 'Deliver brand guideline SVGs and component library',
        evidence: 'Sarah will provide SVG brand assets by Friday at 5pm',
        by: 'Sarah Lin',
      });
      expect(commitment.commitment).toBe('Deliver brand guideline SVGs and component library');
      expect(commitment.by).toBe('Sarah Lin');
      expect(commitment.evidence).toContain('Friday at 5pm');
    });

    it('validates open questions and follow-up suggestions', () => {
      const openQ = OpenQuestionSchema.parse({
        question: 'Does the client need HIPAA BAA signed before staging?',
        evidence: 'Do we need a BAA before staging deployment?',
        askedBy: 'Alex',
      });
      expect(openQ.askedBy).toBe('Alex');

      const suggestion = FollowUpSuggestionSchema.parse({
        suggestion: 'Implement audit-logging middleware on patient queries',
        rationale: 'Pass HIPAA compliance audit without redesign later',
        evidence: 'audit-logging for patient records',
      });
      expect(suggestion.rationale).toContain('HIPAA');
    });

    it('validates complete StructuredExtractionSchema including email draft', () => {
      const extraction = StructuredExtractionSchema.parse({
        title: 'Apex Health Patient Portal Discovery',
        client: 'Apex Health Tech',
        project: 'Portal Redesign',
        callSummary: 'Discovery call with Sarah Lin to align on scope, milestones, and deliverables.',
        summary: 'Met with client to plan redesign. First milestone due Nov 21.',
        tasks: [
          {
            title: 'Deliver initial wireframes',
            evidence: 'wireframes by November 21st',
            confidence: 0.95,
            dueDate: 'November 21st',
            dueDateType: 'explicit',
            priority: 'high',
          },
        ],
        clientCommitments: [
          {
            commitment: 'Provide SVG brand assets',
            evidence: 'Sarah will provide brand assets by Friday',
            by: 'Sarah Lin',
          },
        ],
        openQuestions: [
          {
            question: 'Direct Epic EHR SSO or standard OAuth?',
            evidence: 'whether portal needs direct Epic integration',
          },
        ],
        followUpSuggestions: [
          {
            suggestion: 'Implement audit logging early',
            rationale: 'Smooth HIPAA certification',
          },
        ],
        emailDraft: {
          subject: 'Follow-up: Apex Health Patient Portal Redesign - Next Steps',
          body: 'Hi Sarah,\n\nThanks for the call today. Looking forward to wireframes on Nov 21.',
          recipientName: 'Sarah Lin',
        },
      });

      expect(extraction.client).toBe('Apex Health Tech');
      expect(extraction.project).toBe('Portal Redesign');
      expect(extraction.tasks[0].dueDateType).toBe('explicit');
      expect(extraction.clientCommitments[0].by).toBe('Sarah Lin');
      expect(extraction.emailDraft?.subject).toContain('Apex Health');
    });

    it('salvages partial extractions in validateExtraction without crashing', () => {
      const partialJson = JSON.stringify({
        title: 'Partial Client Call',
        client: 'Beta Labs',
        tasks: [
          { title: 'Send invoice', evidence: 'send the invoice' },
        ],
        clientCommitments: [
          { commitment: 'Send wire payment' },
        ],
      });

      const validated = validateExtraction(partialJson);
      expect(validated.success).toBe(true);
      expect(validated.data?.client).toBe('Beta Labs');
      expect(validated.data?.tasks[0].dueDateType).toBe('none');
      expect(validated.data?.clientCommitments?.[0].commitment).toBe('Send wire payment');
      expect(validated.data?.emailDraft?.subject).toBe('');
    });
  });

  describe('2. AI Extraction Prompt Directives', () => {
    it('contains strict instructions to distinguish explicit from inferred dates and never invent deadlines', () => {
      const prompt = buildExtractionPrompt('Sample transcript');
      expect(prompt.system).toContain('expert freelance meeting follow-up assistant');
      expect(prompt.system).toContain('DATE INVARIANT (STRICT)');
      expect(prompt.system).toContain('explicit');
      expect(prompt.system).toContain('inferred');
      expect(prompt.system).toContain('NEVER INVENT OR FABRICATE A CONFIRMED DEADLINE');
      expect(prompt.system).toContain('CLIENT COMMITMENTS');
      expect(prompt.system).toContain('OPEN QUESTIONS');
      expect(prompt.system).toContain('FOLLOW-UP EMAIL DRAFT');
      expect(prompt.user).toContain('"dueDateType": "explicit | inferred | none"');
      expect(prompt.user).toContain('"clientCommitments"');
      expect(prompt.user).toContain('"openQuestions"');
      expect(prompt.user).toContain('"followUpSuggestions"');
      expect(prompt.user).toContain('"emailDraft"');
    });
  });

  describe('3. SQLite Database Layer: Migrations, Labels & CRUD', () => {
    it('creates voice note with client and project labels', () => {
      const note = createVoiceNote({
        id: testNoteId,
        title: 'Apex Health Kickoff Call',
        client: 'Apex Health Tech',
        project: 'Patient Portal Redesign',
        audioFileName: `${testNoteId}.m4a`,
        mimeType: 'audio/m4a',
        fileSizeBytes: 120000,
        durationSeconds: 45.0,
        status: 'ready',
      });

      expect(note.client).toBe('Apex Health Tech');
      expect(note.project).toBe('Patient Portal Redesign');

      const retrieved = getVoiceNote(testNoteId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.client).toBe('Apex Health Tech');
      expect(retrieved?.project).toBe('Patient Portal Redesign');
    });

    it('updates voice note metadata (title, client, project)', () => {
      createVoiceNote({
        id: testNoteId,
        title: 'Initial Title',
        client: '',
        project: '',
        audioFileName: `${testNoteId}.m4a`,
        mimeType: 'audio/m4a',
        fileSizeBytes: 100000,
        status: 'ready',
      });

      const updated = updateVoiceNoteMetadata(testNoteId, {
        title: 'Renamed Client Call',
        client: 'Acme International',
        project: 'Notion Sync',
      });

      expect(updated?.title).toBe('Renamed Client Call');
      expect(updated?.client).toBe('Acme International');
      expect(updated?.project).toBe('Notion Sync');

      const retrieved = getVoiceNote(testNoteId);
      expect(retrieved?.title).toBe('Renamed Client Call');
      expect(retrieved?.client).toBe('Acme International');
      expect(retrieved?.project).toBe('Notion Sync');
    });

    it('persists and retrieves full extraction with commitments, questions, suggestions, and email draft', () => {
      createVoiceNote({
        id: testNoteId,
        title: 'Full Extraction Note',
        client: 'Apex Health',
        project: 'Redesign',
        audioFileName: `${testNoteId}.m4a`,
        mimeType: 'audio/m4a',
        fileSizeBytes: 100000,
        status: 'ready',
      });

      const taskId = `task-${testNoteId}-1`;
      saveExtraction({
        id: `ext-${testNoteId}`,
        voiceNoteId: testNoteId,
        title: 'Full Extraction Note',
        client: 'Apex Health',
        project: 'Redesign',
        callSummary: 'Executive summary of discovery meeting.',
        summary: 'Met with client.',
        tasks: [
          {
            id: taskId,
            title: 'Deliver wireframes',
            sourceNoteId: testNoteId,
            evidence: 'wireframes by Friday',
            confidence: 0.95,
            dueDate: 'Friday',
            dueDateType: 'explicit',
            completed: false,
            priority: 'high',
          },
        ],
        clientCommitments: [
          {
            id: `comm-${testNoteId}-1`,
            commitment: 'Provide SVG logo files',
            evidence: 'Sarah will provide SVGs',
            by: 'Sarah',
          },
        ],
        ideas: [{ id: 'idea-1', idea: 'Dark mode', evidence: 'dark mode mentioned' }],
        decisions: [{ id: 'dec-1', decision: 'Use Tailwind CSS', evidence: 'agreed on Tailwind' }],
        openQuestions: [
          {
            id: `q-${testNoteId}-1`,
            question: 'Will SSO be SAML or OAuth?',
            evidence: 'SAML or OAuth',
            askedBy: 'Alex',
          },
        ],
        followUpSuggestions: [
          {
            id: `sug-${testNoteId}-1`,
            suggestion: 'Setup staging environment before Milestone 1',
            evidence: 'staging env',
            rationale: 'Faster client feedback cycles',
          },
        ],
        people: ['Sarah', 'Alex'],
        topics: ['UI', 'Tailwind'],
        importantDates: [{ event: 'Milestone 1', date: 'Friday' }],
        emailDraft: {
          subject: 'Apex Health Next Steps',
          body: 'Hi Sarah, recapping our decisions today.',
          recipientName: 'Sarah',
        },
        modelUsed: 'test-model',
      });

      const retrieved = getVoiceNote(testNoteId);
      const ext = retrieved?.extraction;
      expect(ext).not.toBeNull();
      expect(ext?.client).toBe('Apex Health');
      expect(ext?.project).toBe('Redesign');
      expect(ext?.callSummary).toBe('Executive summary of discovery meeting.');
      expect(ext?.tasks[0].dueDateType).toBe('explicit');
      expect(ext?.clientCommitments?.[0].commitment).toBe('Provide SVG logo files');
      expect(ext?.clientCommitments?.[0].by).toBe('Sarah');
      expect(ext?.openQuestions?.[0].question).toContain('SAML or OAuth');
      expect(ext?.followUpSuggestions?.[0].rationale).toContain('Faster client feedback');
      expect(ext?.emailDraft?.subject).toBe('Apex Health Next Steps');
    });

    it('allows updating task properties (title, dueDate, dueDateType, priority, completion)', () => {
      createVoiceNote({
        id: testNoteId,
        title: 'Task Edit Note',
        audioFileName: `${testNoteId}.m4a`,
        mimeType: 'audio/m4a',
        fileSizeBytes: 100000,
        status: 'ready',
      });

      const taskId = `task-${testNoteId}-editable`;
      saveExtraction({
        id: `ext-${testNoteId}`,
        voiceNoteId: testNoteId,
        title: 'Task Edit Note',
        summary: 'Summary',
        tasks: [
          {
            id: taskId,
            title: 'Initial Task',
            sourceNoteId: testNoteId,
            evidence: 'evidence',
            confidence: 0.9,
            dueDate: null,
            dueDateType: 'none',
            completed: false,
            priority: 'low',
          },
        ],
        ideas: [],
        decisions: [],
        people: [],
        topics: [],
        importantDates: [],
      });

      // Update task via updateTask
      const updatedTasks = updateTask(testNoteId, taskId, {
        title: 'Adjusted Milestone Delivery',
        dueDate: 'November 28th',
        dueDateType: 'explicit',
        priority: 'high',
        completed: true,
      });

      expect(updatedTasks).not.toBeNull();
      const task = updatedTasks?.find((t) => t.id === taskId);
      expect(task?.title).toBe('Adjusted Milestone Delivery');
      expect(task?.dueDate).toBe('November 28th');
      expect(task?.dueDateType).toBe('explicit');
      expect(task?.priority).toBe('high');
      expect(task?.completed).toBe(true);
    });

    it('allows updating extraction call summary and email draft', () => {
      createVoiceNote({
        id: testNoteId,
        title: 'Extraction Update Note',
        audioFileName: `${testNoteId}.m4a`,
        mimeType: 'audio/m4a',
        fileSizeBytes: 100000,
        status: 'ready',
      });

      saveExtraction({
        id: `ext-${testNoteId}`,
        voiceNoteId: testNoteId,
        title: 'Extraction Update Note',
        summary: 'Summary',
        tasks: [],
        ideas: [],
        decisions: [],
        people: [],
        topics: [],
        importantDates: [],
      });

      const updatedExt = updateExtraction(testNoteId, {
        callSummary: 'Edited Call Summary for Stakeholders.',
        emailDraft: {
          subject: 'Customized Follow-up Subject',
          body: 'Polished body sent from freelancer.',
          recipientName: 'Dr. Jane',
        },
        client: 'Jane Clinic',
        project: 'EMR Portal',
      });

      expect(updatedExt?.callSummary).toBe('Edited Call Summary for Stakeholders.');
      expect(updatedExt?.emailDraft?.subject).toBe('Customized Follow-up Subject');
      expect(updatedExt?.client).toBe('Jane Clinic');
      expect(updatedExt?.project).toBe('EMR Portal');

      // Also verify voice_notes table was synced
      const note = getVoiceNote(testNoteId);
      expect(note?.client).toBe('Jane Clinic');
      expect(note?.project).toBe('EMR Portal');
    });
  });

  describe('4. Export Utilities (Markdown, CSV, and mailto URL)', () => {
    const mockNote: VoiceNote = {
      id: 'export-test-1',
      title: 'Apex Health Redesign Discovery',
      client: 'Apex Health Tech',
      project: 'Patient Portal Redesign',
      audioFileName: 'export-test-1.m4a',
      mimeType: 'audio/m4a',
      fileSizeBytes: 200000,
      durationSeconds: 125,
      status: 'ready',
      createdAt: '2026-10-16T12:00:00Z',
      updatedAt: '2026-10-16T12:05:00Z',
      extraction: {
        id: 'ext-1',
        voiceNoteId: 'export-test-1',
        title: 'Apex Health Redesign Discovery',
        client: 'Apex Health Tech',
        project: 'Patient Portal Redesign',
        callSummary: 'Discovery meeting with Sarah Lin to align on patient portal redesign.',
        summary: 'Redesign agreed.',
        tasks: [
          {
            id: 't-1',
            title: 'Deliver interactive wireframes',
            sourceNoteId: 'export-test-1',
            evidence: 'wireframes by November 21st',
            confidence: 0.98,
            dueDate: 'November 21st',
            dueDateType: 'explicit',
            completed: false,
            priority: 'high',
          },
          {
            id: 't-2',
            title: 'Schedule user testing sessions',
            sourceNoteId: 'export-test-1',
            evidence: 'testing late next month',
            confidence: 0.88,
            dueDate: 'Late next month',
            dueDateType: 'inferred',
            completed: true,
            priority: 'medium',
          },
        ],
        clientCommitments: [
          {
            id: 'c-1',
            commitment: 'Provide SVG logo and Figma kit',
            evidence: 'Sarah will provide assets by Friday',
            by: 'Sarah Lin',
          },
        ],
        ideas: [{ id: 'i-1', idea: 'One-click audio preview', evidence: 'audio preview' }],
        decisions: [{ id: 'd-1', decision: 'Mobile-first design system', evidence: 'mobile first' }],
        openQuestions: [
          {
            id: 'q-1',
            question: 'Epic EHR integration required?',
            evidence: 'whether Epic integration required',
            askedBy: 'Sarah',
          },
        ],
        followUpSuggestions: [
          {
            id: 's-1',
            suggestion: 'Implement audit logging early',
            rationale: 'HIPAA certification requirement',
          },
        ],
        people: ['Sarah Lin'],
        topics: ['Healthcare', 'Design'],
        importantDates: [{ event: 'Milestone 1', date: 'November 21st' }],
        emailDraft: {
          subject: 'Follow-up: Apex Health Patient Portal',
          body: 'Hi Sarah, here are our next steps.',
          recipientName: 'Sarah Lin',
        },
        createdAt: '2026-10-16T12:05:00Z',
      },
      transcript: {
        id: 'tr-1',
        voiceNoteId: 'export-test-1',
        rawText: 'Thanks for hopping on the discovery call Sarah.',
        segments: [],
        modelUsed: 'whisper',
        processingTimeMs: 1200,
        createdAt: '2026-10-16T12:01:00Z',
      },
    };

    it('generates Markdown export with all sections and evidence quotes', () => {
      const md = generateMeetingMarkdown(mockNote);
      expect(md).toContain('# Apex Health Redesign Discovery');
      expect(md).toContain('**Client:** Apex Health Tech');
      expect(md).toContain('**Project:** Patient Portal Redesign');
      expect(md).toContain('## Executive Client-Call Summary');
      expect(md).toContain('Discovery meeting with Sarah Lin');
      expect(md).toContain('## Client Commitments');
      expect(md).toContain('Provide SVG logo and Figma kit');
      expect(md).toContain('(by Sarah Lin)');
      expect(md).toContain('## Action Items & Next Steps');
      expect(md).toContain('- [ ] **Deliver interactive wireframes** [HIGH] (Due: November 21st [explicit])');
      expect(md).toContain('- [x] **Schedule user testing sessions** [MEDIUM] (Due: Late next month [inferred])');
      expect(md).toContain('## Key Decisions Finalized');
      expect(md).toContain('Mobile-first design system');
      expect(md).toContain('## Open Questions & Ambiguities');
      expect(md).toContain('Epic EHR integration required?');
      expect(md).toContain('## Follow-Up Suggestions');
      expect(md).toContain('Implement audit logging early');
      expect(md).toContain('## Follow-Up Email Draft');
      expect(md).toContain('**Subject:** Follow-up: Apex Health Patient Portal');
      expect(md).toContain('## Raw Transcript');
      expect(md).toContain('Thanks for hopping on the discovery call Sarah.');
    });

    it('generates well-formed CSV export for tasks with quotes escaped', () => {
      const csv = generateTasksCSV(
        mockNote.extraction!.tasks,
        mockNote.title,
        mockNote.client,
        mockNote.project
      );

      const rows = csv.split('\r\n');
      expect(rows[0]).toContain('"Task ID","Task Title","Completed","Priority","Due Date","Date Type"');
      expect(rows[1]).toContain('"t-1","Deliver interactive wireframes","NO","high","November 21st","explicit"');
      expect(rows[2]).toContain('"t-2","Schedule user testing sessions","YES","medium","Late next month","inferred"');
      expect(rows[1]).toContain('"Apex Health Tech","Patient Portal Redesign"');
    });

    it('generates valid user-controlled mailto link without server sending', () => {
      const mailto = generateMailtoUrl(mockNote.extraction!.emailDraft!);
      expect(mailto).toMatch(/^mailto:\?subject=Follow-up%3A%20Apex%20Health%20Patient%20Portal&body=Hi%20Sarah%2C%20here%20are%20our%20next%20steps\.$/);
    });
  });

  describe('5. Demo Dataset Website Redesign Call Integrity', () => {
    it('features realistic freelance website redesign client call in DEMO_NOTES', () => {
      const redesignNote = DEMO_NOTES.find((n) => n.id === 'demo-note-1-onboarding');
      expect(redesignNote).toBeDefined();
      expect(redesignNote?.client).toBe('Apex Health Tech');
      expect(redesignNote?.project).toContain('Redesign');
      expect(redesignNote?.callSummary).toContain('Sarah Lin');
      expect(redesignNote?.clientCommitments?.length).toBeGreaterThan(0);
      expect(redesignNote?.clientCommitments?.[0].by).toBe('Sarah Lin');
      expect(redesignNote?.openQuestions?.length).toBeGreaterThan(0);
      expect(redesignNote?.followUpSuggestions?.length).toBeGreaterThan(0);
      expect(redesignNote?.emailDraft?.subject).toContain('Apex Health');

      // Check date distinction
      const explicitTask = redesignNote?.tasks.find((t) => t.dueDateType === 'explicit');
      expect(explicitTask).toBeDefined();
      expect(explicitTask?.dueDate).toBe('November 21st');

      const inferredTask = redesignNote?.tasks.find((t) => t.dueDateType === 'inferred');
      expect(inferredTask).toBeDefined();
      expect(inferredTask?.dueDate).toBe('Late next month');
    });
  });
});
