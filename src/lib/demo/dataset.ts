import {
  createVoiceNote,
  saveTranscript,
  saveExtraction,
  saveEmbeddingChunks,
  getDb,
} from '@/lib/db';
import { getEmbeddingProvider } from '@/lib/ai/embeddings/provider';
import { chunkTranscriptAndMetadata } from '@/lib/rag/chunking';
import { DueDateType } from '@/types';
import crypto from 'crypto';

export interface DemoNoteSpec {
  id: string;
  title: string;
  client?: string;
  project?: string;
  durationSeconds: number;
  transcript: string;
  segments: Array<{ start: number; end: number; text: string }>;
  callSummary?: string;
  summary: string;
  tasks: Array<{
    title: string;
    evidence: string;
    confidence: number;
    dueDate?: string;
    dueDateType?: DueDateType;
    priority: 'low' | 'medium' | 'high';
  }>;
  clientCommitments?: Array<{
    commitment: string;
    evidence: string;
    by?: string;
  }>;
  ideas: Array<{ idea: string; evidence: string }>;
  decisions: Array<{ decision: string; evidence: string }>;
  openQuestions?: Array<{
    question: string;
    evidence: string;
    askedBy?: string;
  }>;
  followUpSuggestions?: Array<{
    suggestion: string;
    evidence?: string;
    rationale?: string;
  }>;
  emailDraft?: {
    subject: string;
    body: string;
    recipientName?: string;
  };
  people: string[];
  topics: string[];
  importantDates: Array<{ event: string; date: string; evidence?: string }>;
}

export const DEMO_NOTES: DemoNoteSpec[] = [
  {
    id: 'demo-note-1-onboarding',
    title: 'Apex Health Client Redesign: Mobile Onboarding & Patient Portal Discovery',
    client: 'Apex Health Tech',
    project: 'Website Redesign & Mobile Onboarding',
    durationSeconds: 27.5,
    transcript: 'Thanks for hopping on the discovery call, Sarah. To summarize our freelance client agreement: we decided to redesign the Apex Health patient portal with an accessible, mobile-first design system and a HIPAA-compliant onboarding flow. The client commitment from Sarah is to provide their SVG brand assets and Figma component library by Friday at 5pm. For my action items, I need to deliver the initial interactive wireframes by November 21st, which is our confirmed deadline for Milestone 1. Sarah also mentioned they might want user testing sessions with clinicians sometime late next month, which we will treat as an inferred tentative window. An open question remains on whether the portal needs direct single-sign-on integration with Epic EHR or if standard OAuth suffices. As a proactive follow-up suggestion, I recommend implementing audit-logging for patient records right away so HIPAA certification passes smoothly without redesign later.',
    segments: [
      { start: 0.0, end: 4.2, text: 'Thanks for hopping on the discovery call, Sarah.' },
      { start: 4.2, end: 11.5, text: 'To summarize our freelance client agreement: we decided to redesign the Apex Health patient portal with an accessible, mobile-first design system' },
      { start: 11.5, end: 15.0, text: 'and a HIPAA-compliant onboarding flow.' },
      { start: 15.0, end: 19.8, text: 'The client commitment from Sarah is to provide their SVG brand assets and Figma component library by Friday at 5pm.' },
      { start: 19.8, end: 24.5, text: 'For my action items, I need to deliver the initial interactive wireframes by November 21st, which is our confirmed deadline for Milestone 1.' },
      { start: 24.5, end: 27.5, text: 'Sarah also mentioned user testing sometime late next month.' },
    ],
    callSummary: 'Discovery call with Sarah Lin (VP Marketing, Apex Health Tech) aligning on the new HIPAA-compliant mobile onboarding and patient portal redesign. Key deliverables and timeline milestones established for Milestone 1 wireframes.',
    summary: 'Decided on a mobile-first patient portal and onboarding redesign for Apex Health. Sarah committed to delivering brand assets by Friday at 5pm. Interactive wireframes deadline confirmed for November 21st.',
    tasks: [
      {
        title: 'Deliver initial interactive wireframes for Milestone 1 review',
        evidence: 'I need to deliver the initial interactive wireframes by November 21st, which is our confirmed deadline for Milestone 1.',
        confidence: 0.98,
        dueDate: 'November 21st',
        dueDateType: 'explicit',
        priority: 'high',
      },
      {
        title: 'Draft user testing protocol for clinician review sessions',
        evidence: 'Sarah also mentioned they might want user testing sessions with clinicians sometime late next month',
        confidence: 0.88,
        dueDate: 'Late next month',
        dueDateType: 'inferred',
        priority: 'medium',
      },
      {
        title: 'Verify OAuth 2.0 vs Epic EHR SSO authentication requirements',
        evidence: 'An open question remains on whether the portal needs direct single-sign-on integration with Epic EHR or if standard OAuth suffices.',
        confidence: 0.94,
        dueDate: undefined,
        dueDateType: 'none',
        priority: 'high',
      },
    ],
    clientCommitments: [
      {
        commitment: 'Provide SVG brand assets and Figma component library',
        evidence: 'The client commitment from Sarah is to provide their SVG brand assets and Figma component library by Friday at 5pm.',
        by: 'Sarah Lin',
      },
    ],
    ideas: [
      {
        idea: 'One-click audio walkthrough preview during patient onboarding',
        evidence: 'accessible, mobile-first design system and a HIPAA-compliant onboarding flow',
      },
    ],
    decisions: [
      {
        decision: 'Redesign patient portal with mobile-first design system and HIPAA onboarding flow',
        evidence: 'we decided to redesign the Apex Health patient portal with an accessible, mobile-first design system',
      },
      {
        decision: 'November 21st set as confirmed milestone deadline for wireframe delivery',
        evidence: 'November 21st, which is our confirmed deadline for Milestone 1',
      },
    ],
    openQuestions: [
      {
        question: 'Does the portal require direct Epic EHR SSO integration or does standard OAuth suffice?',
        evidence: 'whether the portal needs direct single-sign-on integration with Epic EHR or if standard OAuth suffices',
        askedBy: 'Sarah Lin',
      },
    ],
    followUpSuggestions: [
      {
        suggestion: 'Implement audit-logging for patient record views early in development',
        rationale: 'Ensures HIPAA compliance audit passes smoothly without requiring architectural refactoring later.',
        evidence: 'implementing audit-logging for patient records right away so HIPAA certification passes smoothly without redesign later',
      },
    ],
    emailDraft: {
      subject: 'Follow-up: Apex Health Patient Portal Redesign - Next Steps & Timeline',
      recipientName: 'Sarah Lin',
      body: `Hi Sarah,

Great speaking with you today regarding the Apex Health Patient Portal redesign!

Here is a quick recap of what we agreed on:
• Scope: Modern, mobile-first portal with an accessible design system and HIPAA onboarding flow.
• Key Milestone: I will deliver the interactive Figma wireframes by November 21st.
• Client Deliverable: Looking forward to receiving the SVG brand assets and Figma component library from your team by Friday at 5:00 PM.

Pending Items:
• We are confirming with your IT team whether direct Epic EHR single-sign-on is required or if our standard OAuth flow meets compliance.

Best regards,
Alex
Freelance Design & Engineering Consultant`,
    },
    people: ['Sarah Lin', 'Alex'],
    topics: ['Mobile', 'Onboarding', 'Healthcare', 'UI/UX Redesign', 'Figma'],
    importantDates: [
      { event: 'Sarah delivers brand assets and Figma library', date: 'Friday at 5pm', evidence: 'by Friday at 5pm' },
      { event: 'Initial interactive wireframes milestone', date: 'November 21st', evidence: 'by November 21st' },
      { event: 'Clinician user testing window', date: 'Late next month', evidence: 'sometime late next month' },
    ],
  },
  {
    id: 'demo-note-2-pricing',
    title: 'Q4 SaaS Pricing Strategy & Enterprise Tier',
    client: 'CloudScale Inc',
    project: 'Q4 Pricing & Architecture',
    durationSeconds: 24.2,
    transcript: 'Reflecting on our pricing call earlier today. We decided to keep the starter plan at twenty dollars a month, but introduce a custom enterprise tier for teams needing local air-gapped deployments. I need to write the comparison matrix by Friday afternoon. Let us also explore annual billing discounts as a retention idea.',
    segments: [
      { start: 0.0, end: 4.5, text: 'Reflecting on our pricing call earlier today.' },
      { start: 4.5, end: 12.0, text: 'We decided to keep the starter plan at twenty dollars a month, but introduce a custom enterprise tier' },
      { start: 12.0, end: 16.5, text: 'for teams needing local air-gapped deployments.' },
      { start: 16.5, end: 20.0, text: 'I need to write the comparison matrix by Friday afternoon.' },
      { start: 20.0, end: 24.2, text: 'Let us also explore annual billing discounts as a retention idea.' },
    ],
    callSummary: 'Strategy session for CloudScale packaging. Locked in $20/month base tier and an air-gapped on-premise offering.',
    summary: 'Decided to keep starter plan at $20/month while introducing a custom air-gapped enterprise tier. Feature comparison matrix is due Friday.',
    tasks: [
      {
        title: 'Write pricing tier comparison matrix by Friday afternoon',
        evidence: 'I need to write the comparison matrix by Friday afternoon.',
        confidence: 0.98,
        dueDate: 'Friday afternoon',
        dueDateType: 'explicit',
        priority: 'high',
      },
      {
        title: 'Calculate margin requirements for air-gapped enterprise tier',
        evidence: 'introduce a custom enterprise tier for teams needing local air-gapped deployments.',
        confidence: 0.91,
        dueDate: 'Next Tuesday',
        dueDateType: 'inferred',
        priority: 'medium',
      },
    ],
    clientCommitments: [],
    ideas: [
      {
        idea: 'Annual billing discounts for customer retention',
        evidence: 'Let us also explore annual billing discounts as a retention idea.',
      },
    ],
    decisions: [
      {
        decision: 'Keep starter plan at $20/mo and introduce custom air-gapped enterprise tier',
        evidence: 'We decided to keep the starter plan at twenty dollars a month, but introduce a custom enterprise tier',
      },
    ],
    openQuestions: [],
    followUpSuggestions: [
      {
        suggestion: 'Create an interactive ROI calculator widget on the pricing page',
        rationale: 'Demonstrates clear financial payback for enterprise buyers comparing against cloud competitors.',
      },
    ],
    emailDraft: {
      subject: 'CloudScale Packaging Matrix & Enterprise Tier Proposal',
      recipientName: 'CloudScale Product Team',
      body: `Hi team,

Following up on today's pricing architecture review:
• Retaining $20/mo starter plan for friction-free developer adoption.
• Introducing Enterprise Tier with air-gapped deployment support.
• I will deliver the complete tier matrix by Friday afternoon.

Best regards,
Alex`,
    },
    people: [],
    topics: ['Pricing', 'SaaS', 'Enterprise'],
    importantDates: [
      { event: 'Pricing comparison matrix deadline', date: 'Friday afternoon', evidence: 'by Friday afternoon' },
    ],
  },
  {
    id: 'demo-note-3-acme',
    title: 'Acme Corp Migration Meeting & Export Scripts',
    client: 'Acme Corp',
    project: 'Knowledge Base Migration',
    durationSeconds: 21.0,
    transcript: 'Met with Sarah and Marcus from Acme Corp today. They decided to migrate their knowledge base from Notion by November 15th. Action item for me is to prepare the database export script before next Monday. Also, Marcus suggested we support batch audio upload for their historical archive.',
    segments: [
      { start: 0.0, end: 4.5, text: 'Met with Sarah and Marcus from Acme Corp today.' },
      { start: 4.5, end: 10.0, text: 'They decided to migrate their knowledge base from Notion by November 15th.' },
      { start: 10.0, end: 15.5, text: 'Action item for me is to prepare the database export script before next Monday.' },
      { start: 15.5, end: 21.0, text: 'Also, Marcus suggested we support batch audio upload for their historical archive.' },
    ],
    callSummary: 'Migration sync with Acme Corp leadership. Confirmed November 15th migration deadline from Notion and scheduled export script delivery for next Monday.',
    summary: 'Acme Corp decided to migrate from Notion by November 15th. Export script is due next Monday; batch audio upload was suggested.',
    tasks: [
      {
        title: 'Prepare database export script before next Monday',
        evidence: 'Action item for me is to prepare the database export script before next Monday.',
        confidence: 0.97,
        dueDate: 'Next Monday',
        dueDateType: 'explicit',
        priority: 'high',
      },
      {
        title: 'Send Sarah and Marcus calendar invitation for migration checkpoint',
        evidence: 'Met with Sarah and Marcus from Acme Corp today.',
        confidence: 0.93,
        dueDate: 'Thursday',
        dueDateType: 'explicit',
        priority: 'low',
      },
    ],
    clientCommitments: [
      {
        commitment: 'Provide workspace admin export token for Notion',
        evidence: 'They decided to migrate their knowledge base from Notion by November 15th.',
        by: 'Marcus',
      },
    ],
    ideas: [
      {
        idea: 'Support batch audio upload for historical archives',
        evidence: 'Marcus suggested we support batch audio upload for their historical archive.',
      },
    ],
    decisions: [
      {
        decision: 'Migrate knowledge base from Notion by November 15th',
        evidence: 'They decided to migrate their knowledge base from Notion by November 15th.',
      },
    ],
    openQuestions: [
      {
        question: 'How large is the historical audio attachment archive in gigabytes?',
        evidence: 'batch audio upload for their historical archive',
        askedBy: 'Alex',
      },
    ],
    followUpSuggestions: [
      {
        suggestion: 'Run a 100-page dry-run migration to test Markdown formatting fidelity',
        rationale: 'Catches edge-case table and embed bugs before running the full workspace export.',
      },
    ],
    emailDraft: {
      subject: 'Acme Corp: Notion Migration Plan & Export Checkpoint',
      recipientName: 'Sarah & Marcus',
      body: `Hi Sarah and Marcus,

Thanks for a productive sync on the Acme Corp knowledge base migration!

Next steps:
• I will finalize the custom export script by next Monday.
• Target migration cutover date is set for November 15th.

Looking forward to testing the pilot batch next week.

Best,
Alex`,
    },
    people: ['Sarah', 'Marcus'],
    topics: ['Acme Corp', 'Migration', 'Notion'],
    importantDates: [
      { event: 'Acme Corp Notion migration', date: 'November 15th', evidence: 'by November 15th' },
      { event: 'Database export script due', date: 'Next Monday', evidence: 'before next Monday' },
    ],
  },
  {
    id: 'demo-note-4-fitness',
    title: 'Half Marathon Training & Nutrition Plan',
    client: '',
    project: 'Personal Athletics',
    durationSeconds: 17.5,
    transcript: 'Quick personal health memo. The half marathon race is on December 12th. I decided to run twelve miles this Saturday morning at 7am. Remember to buy electrolyte gels from the running store on Thursday.',
    segments: [
      { start: 0.0, end: 3.5, text: 'Quick personal health memo.' },
      { start: 3.5, end: 7.0, text: 'The half marathon race is on December 12th.' },
      { start: 7.0, end: 12.0, text: 'I decided to run twelve miles this Saturday morning at 7am.' },
      { start: 12.0, end: 17.5, text: 'Remember to buy electrolyte gels from the running store on Thursday.' },
    ],
    callSummary: 'Personal endurance training log. Half marathon scheduled for December 12th.',
    summary: 'Half marathon is scheduled for December 12th. Planned a 12-mile training run for Saturday at 7am and need to pick up electrolyte gels Thursday.',
    tasks: [
      {
        title: 'Buy electrolyte gels from running store on Thursday',
        evidence: 'Remember to buy electrolyte gels from the running store on Thursday.',
        confidence: 0.95,
        dueDate: 'Thursday',
        dueDateType: 'explicit',
        priority: 'medium',
      },
      {
        title: 'Run twelve miles Saturday morning at 7am',
        evidence: 'I decided to run twelve miles this Saturday morning at 7am.',
        confidence: 0.94,
        dueDate: 'Saturday 7am',
        dueDateType: 'explicit',
        priority: 'medium',
      },
    ],
    clientCommitments: [],
    ideas: [],
    decisions: [
      {
        decision: 'Run 12 miles Saturday morning at 7am for half marathon prep',
        evidence: 'I decided to run twelve miles this Saturday morning at 7am.',
      },
    ],
    openQuestions: [],
    followUpSuggestions: [],
    people: [],
    topics: ['Fitness', 'Running', 'Health'],
    importantDates: [
      { event: 'Half Marathon Race', date: 'December 12th', evidence: 'on December 12th' },
      { event: '12-mile long run', date: 'Saturday 7am', evidence: 'this Saturday morning at 7am' },
    ],
  },
  {
    id: 'demo-note-5-home',
    title: 'Solar Panels & Roof Renovation Estimates',
    client: 'SunPower Contracting',
    project: 'Home Energy Upgrade',
    durationSeconds: 22.0,
    transcript: 'Got the contractor quotes back for solar panels and roof repair. The electrician is coming on October 18th to inspect the main electrical panel. We decided to go with the eight kilowatt solar system. I should call the city permits office on Wednesday morning to check zoning approvals.',
    segments: [
      { start: 0.0, end: 5.0, text: 'Got the contractor quotes back for solar panels and roof repair.' },
      { start: 5.0, end: 11.0, text: 'The electrician is coming on October 18th to inspect the main electrical panel.' },
      { start: 11.0, end: 16.0, text: 'We decided to go with the eight kilowatt solar system.' },
      { start: 16.0, end: 22.0, text: 'I should call the city permits office on Wednesday morning to check zoning approvals.' },
    ],
    callSummary: 'Contractor evaluation for home solar installation. 8kW system selected with inspection on October 18th.',
    summary: 'Selected the 8kW solar system. Electrician inspection scheduled for October 18th, and city permits office must be called Wednesday morning.',
    tasks: [
      {
        title: 'Call city permits office on Wednesday morning for zoning approvals',
        evidence: 'I should call the city permits office on Wednesday morning to check zoning approvals.',
        confidence: 0.96,
        dueDate: 'Wednesday morning',
        dueDateType: 'explicit',
        priority: 'high',
      },
      {
        title: 'Prepare breaker panel access for electrician inspection on October 18th',
        evidence: 'The electrician is coming on October 18th to inspect the main electrical panel.',
        confidence: 0.93,
        dueDate: 'October 18th',
        dueDateType: 'explicit',
        priority: 'medium',
      },
    ],
    clientCommitments: [],
    ideas: [],
    decisions: [
      {
        decision: 'Go with the eight kilowatt solar system',
        evidence: 'We decided to go with the eight kilowatt solar system.',
      },
    ],
    openQuestions: [],
    followUpSuggestions: [],
    people: ['Electrician'],
    topics: ['Home', 'Solar', 'Renovation'],
    importantDates: [
      { event: 'Electrician panel inspection', date: 'October 18th', evidence: 'on October 18th' },
      { event: 'Call city permits office', date: 'Wednesday morning', evidence: 'on Wednesday morning' },
    ],
  },
  {
    id: 'demo-note-6-engineering',
    title: 'Background Processing Architecture: Go vs Node',
    client: 'Internal Infra',
    project: 'Audio Pipeline Optimization',
    durationSeconds: 20.0,
    transcript: 'Engineering sync discussion about our background processing worker. We decided to use Go for the audio ingestion service because of its simple concurrency model and fast startup time. I need to benchmark the FFmpeg subprocess throughput against Node.js by Friday.',
    segments: [
      { start: 0.0, end: 4.5, text: 'Engineering sync discussion about our background processing worker.' },
      { start: 4.5, end: 12.0, text: 'We decided to use Go for the audio ingestion service because of its simple concurrency model and fast startup time.' },
      { start: 12.0, end: 20.0, text: 'I need to benchmark the FFmpeg subprocess throughput against Node.js by Friday.' },
    ],
    callSummary: 'Architecture evaluation comparing Go and Node.js for low-latency background audio ingestion.',
    summary: 'Decided on Go for the background audio ingestion service due to concurrency benefits. Subprocess benchmarking is due Friday.',
    tasks: [
      {
        title: 'Benchmark FFmpeg subprocess throughput against Node.js by Friday',
        evidence: 'I need to benchmark the FFmpeg subprocess throughput against Node.js by Friday.',
        confidence: 0.98,
        dueDate: 'Friday',
        dueDateType: 'explicit',
        priority: 'high',
      },
      {
        title: 'Document memory profile comparison in engineering wiki',
        evidence: 'Engineering sync discussion about our background processing worker.',
        confidence: 0.92,
        dueDate: 'Next Monday',
        dueDateType: 'inferred',
        priority: 'medium',
      },
    ],
    clientCommitments: [],
    ideas: [
      {
        idea: 'Evaluate Rust for heavy DSP filtering at scale',
        evidence: 'concurrency model and fast startup time',
      },
    ],
    decisions: [
      {
        decision: 'Use Go for the audio ingestion worker',
        evidence: 'We decided to use Go for the audio ingestion service because of its simple concurrency model',
      },
    ],
    openQuestions: [],
    followUpSuggestions: [],
    people: [],
    topics: ['Engineering', 'Architecture', 'Go'],
    importantDates: [
      { event: 'FFmpeg benchmark completion', date: 'Friday', evidence: 'by Friday' },
    ],
  },
];

export async function loadDemoDataset(): Promise<{ loaded: number }> {
  // Clear any existing demo notes to prevent UNIQUE constraint errors
  clearDemoDataset();

  const embedder = getEmbeddingProvider();
  const db = getDb();

  for (const spec of DEMO_NOTES) {
    // 1. Voice Note record with client and project
    createVoiceNote({
      id: spec.id,
      title: spec.title,
      client: spec.client,
      project: spec.project,
      audioFileName: `${spec.id}.m4a`,
      mimeType: 'audio/m4a',
      fileSizeBytes: Math.floor(spec.durationSeconds * 9500),
      durationSeconds: spec.durationSeconds,
      status: 'ready',
    });

    // 2. Transcript
    const transcript = saveTranscript({
      id: crypto.randomUUID(),
      voiceNoteId: spec.id,
      rawText: spec.transcript,
      segments: spec.segments,
      detectedLanguage: 'en',
      modelUsed: 'Xenova/whisper-tiny.en',
      processingTimeMs: 1250,
    });

    // 3. Extraction
    saveExtraction({
      id: crypto.randomUUID(),
      voiceNoteId: spec.id,
      title: spec.title,
      client: spec.client,
      project: spec.project,
      callSummary: spec.callSummary || spec.summary,
      summary: spec.summary,
      tasks: spec.tasks.map((t, idx) => ({
        id: `${spec.id}-task-${idx + 1}`,
        title: t.title,
        sourceNoteId: spec.id,
        evidence: t.evidence,
        confidence: t.confidence,
        dueDate: t.dueDate,
        dueDateType: t.dueDateType || (t.dueDate ? 'explicit' : 'none'),
        completed: false,
        priority: t.priority,
      })),
      clientCommitments: (spec.clientCommitments || []).map((c, idx) => ({
        id: `${spec.id}-commitment-${idx + 1}`,
        commitment: c.commitment,
        evidence: c.evidence,
        by: c.by,
      })),
      ideas: spec.ideas.map((i, idx) => ({
        id: `${spec.id}-idea-${idx + 1}`,
        idea: i.idea,
        evidence: i.evidence,
      })),
      decisions: spec.decisions.map((d, idx) => ({
        id: `${spec.id}-decision-${idx + 1}`,
        decision: d.decision,
        evidence: d.evidence,
      })),
      openQuestions: (spec.openQuestions || []).map((q, idx) => ({
        id: `${spec.id}-question-${idx + 1}`,
        question: q.question,
        evidence: q.evidence,
        askedBy: q.askedBy,
      })),
      followUpSuggestions: (spec.followUpSuggestions || []).map((s, idx) => ({
        id: `${spec.id}-suggestion-${idx + 1}`,
        suggestion: s.suggestion,
        evidence: s.evidence,
        rationale: s.rationale,
      })),
      people: spec.people,
      topics: spec.topics,
      importantDates: spec.importantDates,
      emailDraft: spec.emailDraft || { subject: '', body: '' },
      modelUsed: 'llama3.2:latest',
    });

    // 4. Vector Chunks & Embeddings
    const chunks = chunkTranscriptAndMetadata({
      noteId: spec.id,
      noteTitle: spec.title,
      transcript,
      summary: spec.summary,
      topics: spec.topics,
      createdAt: new Date().toISOString(),
    });

    const embeddings = await embedder.embedBatch(chunks.map((c) => c.text));

    saveEmbeddingChunks(
      chunks.map((c, idx) => ({
        id: c.id,
        noteId: c.noteId,
        chunkIndex: c.chunkIndex,
        text: c.text,
        embedding: embeddings[idx],
        metadata: c.metadata,
        createdAt: c.metadata.createdAt,
      }))
    );
  }

  // Set Demo Mode flag in settings
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES ('DEMO_MODE_ACTIVE', 'true', ?)
    ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at
  `).run(new Date().toISOString());

  return { loaded: DEMO_NOTES.length };
}

export function clearDemoDataset(): { cleared: number } {
  const db = getDb();
  let count = 0;

  for (const spec of DEMO_NOTES) {
    db.prepare(`DELETE FROM note_embeddings WHERE note_id = ?`).run(spec.id);
    db.prepare(`DELETE FROM extractions WHERE voice_note_id = ?`).run(spec.id);
    db.prepare(`DELETE FROM transcripts WHERE voice_note_id = ?`).run(spec.id);
    db.prepare(`DELETE FROM voice_notes WHERE id = ?`).run(spec.id);
    count++;
  }

  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES ('DEMO_MODE_ACTIVE', 'false', ?)
    ON CONFLICT(key) DO UPDATE SET value = 'false', updated_at = excluded.updated_at
  `).run(new Date().toISOString());

  return { cleared: count };
}

export function isDemoModeActive(): boolean {
  const db = getDb();
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'DEMO_MODE_ACTIVE'`).get() as any;
  return row?.value === 'true';
}
