import {
  createVoiceNote,
  saveTranscript,
  saveExtraction,
  saveEmbeddingChunks,
  getDb,
} from '@/lib/db';
import { getEmbeddingProvider } from '@/lib/ai/embeddings/provider';
import { chunkTranscriptAndMetadata } from '@/lib/rag/chunking';
import crypto from 'crypto';

export interface DemoNoteSpec {
  id: string;
  title: string;
  durationSeconds: number;
  transcript: string;
  segments: Array<{ start: number; end: number; text: string }>;
  summary: string;
  tasks: Array<{ title: string; evidence: string; confidence: number; dueDate?: string; priority: 'low' | 'medium' | 'high' }>;
  ideas: Array<{ idea: string; evidence: string }>;
  decisions: Array<{ decision: string; evidence: string }>;
  people: string[];
  topics: string[];
  importantDates: Array<{ event: string; date: string; evidence?: string }>;
}

export const DEMO_NOTES: DemoNoteSpec[] = [
  {
    id: 'demo-note-1-onboarding',
    title: 'Mobile Onboarding & Quick Audio Preview',
    durationSeconds: 19.4,
    transcript: 'Hey Alex, I had a sudden idea for the mobile onboarding. We should implement a one-click audio sample preview so new users immediately hear how local Whisper sounds. Also, we officially decided to ship the beta version to the design team next Wednesday. Make sure to invite David from engineering to the staging review on Tuesday morning.',
    segments: [
      { start: 0.0, end: 3.6, text: 'Hey Alex, I had a sudden idea for the mobile onboarding.' },
      { start: 3.6, end: 8.0, text: 'We should implement a one-click audio sample preview so new users immediately hear how' },
      { start: 8.0, end: 9.7, text: 'local Whisper sounds.' },
      { start: 9.7, end: 15.0, text: 'Also, we officially decided to ship the beta version to the design team next Wednesday.' },
      { start: 15.0, end: 19.4, text: 'Make sure to invite David from engineering to the staging review on Tuesday morning.' },
    ],
    summary: 'Implement a one-click audio sample preview for mobile onboarding and ship beta version to the design team next Wednesday.',
    tasks: [
      {
        title: 'Invite David from engineering to staging review on Tuesday',
        evidence: 'Make sure to invite David from engineering to the staging review on Tuesday morning.',
        confidence: 0.96,
        dueDate: 'Tuesday morning',
        priority: 'high',
      },
      {
        title: 'Ship beta version to design team',
        evidence: 'we officially decided to ship the beta version to the design team next Wednesday.',
        confidence: 0.95,
        dueDate: 'Next Wednesday',
        priority: 'high',
      },
    ],
    ideas: [
      {
        idea: 'One-click audio sample preview for mobile onboarding',
        evidence: 'We should implement a one-click audio sample preview so new users immediately hear how local Whisper sounds.',
      },
    ],
    decisions: [
      {
        decision: 'Ship beta version to design team next Wednesday',
        evidence: 'we officially decided to ship the beta version to the design team next Wednesday.',
      },
    ],
    people: ['Alex', 'David'],
    topics: ['Mobile', 'Onboarding', 'Design'],
    importantDates: [
      { event: 'Beta shipment to design team', date: 'Next Wednesday', evidence: 'next Wednesday' },
      { event: 'Staging review with David', date: 'Tuesday morning', evidence: 'Tuesday morning' },
    ],
  },
  {
    id: 'demo-note-2-pricing',
    title: 'Q4 SaaS Pricing Strategy & Enterprise Tier',
    durationSeconds: 24.2,
    transcript: 'Reflecting on our pricing call earlier today. We decided to keep the starter plan at twenty dollars a month, but introduce a custom enterprise tier for teams needing local air-gapped deployments. I need to write the comparison matrix by Friday afternoon. Let us also explore annual billing discounts as a retention idea.',
    segments: [
      { start: 0.0, end: 4.5, text: 'Reflecting on our pricing call earlier today.' },
      { start: 4.5, end: 12.0, text: 'We decided to keep the starter plan at twenty dollars a month, but introduce a custom enterprise tier' },
      { start: 12.0, end: 16.5, text: 'for teams needing local air-gapped deployments.' },
      { start: 16.5, end: 20.0, text: 'I need to write the comparison matrix by Friday afternoon.' },
      { start: 20.0, end: 24.2, text: 'Let us also explore annual billing discounts as a retention idea.' },
    ],
    summary: 'Decided to keep starter plan at $20/month while introducing a custom air-gapped enterprise tier. Feature comparison matrix is due Friday.',
    tasks: [
      {
        title: 'Write pricing tier comparison matrix by Friday afternoon',
        evidence: 'I need to write the comparison matrix by Friday afternoon.',
        confidence: 0.98,
        dueDate: 'Friday afternoon',
        priority: 'high',
      },
      {
        title: 'Calculate margin requirements for air-gapped enterprise tier',
        evidence: 'introduce a custom enterprise tier for teams needing local air-gapped deployments.',
        confidence: 0.91,
        dueDate: 'Next Tuesday',
        priority: 'medium',
      },
    ],
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
    people: [],
    topics: ['Pricing', 'SaaS', 'Enterprise'],
    importantDates: [
      { event: 'Pricing comparison matrix deadline', date: 'Friday afternoon', evidence: 'by Friday afternoon' },
    ],
  },
  {
    id: 'demo-note-3-acme',
    title: 'Acme Corp Migration Meeting & Export Scripts',
    durationSeconds: 21.0,
    transcript: 'Met with Sarah and Marcus from Acme Corp today. They decided to migrate their knowledge base from Notion by November 15th. Action item for me is to prepare the database export script before next Monday. Also, Marcus suggested we support batch audio upload for their historical archive.',
    segments: [
      { start: 0.0, end: 4.5, text: 'Met with Sarah and Marcus from Acme Corp today.' },
      { start: 4.5, end: 10.0, text: 'They decided to migrate their knowledge base from Notion by November 15th.' },
      { start: 10.0, end: 15.5, text: 'Action item for me is to prepare the database export script before next Monday.' },
      { start: 15.5, end: 21.0, text: 'Also, Marcus suggested we support batch audio upload for their historical archive.' },
    ],
    summary: 'Acme Corp decided to migrate from Notion by November 15th. Export script is due next Monday; batch audio upload was suggested.',
    tasks: [
      {
        title: 'Prepare database export script before next Monday',
        evidence: 'Action item for me is to prepare the database export script before next Monday.',
        confidence: 0.97,
        dueDate: 'Next Monday',
        priority: 'medium',
      },
      {
        title: 'Send Sarah and Marcus calendar invitation for migration checkpoint',
        evidence: 'Met with Sarah and Marcus from Acme Corp today.',
        confidence: 0.93,
        dueDate: 'Thursday',
        priority: 'low',
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
    durationSeconds: 17.5,
    transcript: 'Quick personal health memo. The half marathon race is on December 12th. I decided to run twelve miles this Saturday morning at 7am. Remember to buy electrolyte gels from the running store on Thursday.',
    segments: [
      { start: 0.0, end: 3.5, text: 'Quick personal health memo.' },
      { start: 3.5, end: 7.0, text: 'The half marathon race is on December 12th.' },
      { start: 7.0, end: 12.0, text: 'I decided to run twelve miles this Saturday morning at 7am.' },
      { start: 12.0, end: 17.5, text: 'Remember to buy electrolyte gels from the running store on Thursday.' },
    ],
    summary: 'Half marathon is scheduled for December 12th. Planned a 12-mile training run for Saturday at 7am and need to pick up electrolyte gels Thursday.',
    tasks: [
      {
        title: 'Buy electrolyte gels from running store on Thursday',
        evidence: 'Remember to buy electrolyte gels from the running store on Thursday.',
        confidence: 0.95,
        dueDate: 'Thursday',
        priority: 'medium',
      },
      {
        title: 'Run twelve miles Saturday morning at 7am',
        evidence: 'I decided to run twelve miles this Saturday morning at 7am.',
        confidence: 0.94,
        dueDate: 'Saturday 7am',
        priority: 'medium',
      },
    ],
    ideas: [],
    decisions: [
      {
        decision: 'Run 12 miles Saturday morning at 7am for half marathon prep',
        evidence: 'I decided to run twelve miles this Saturday morning at 7am.',
      },
    ],
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
    durationSeconds: 22.0,
    transcript: 'Got the contractor quotes back for solar panels and roof repair. The electrician is coming on October 18th to inspect the main electrical panel. We decided to go with the eight kilowatt solar system. I should call the city permits office on Wednesday morning to check zoning approvals.',
    segments: [
      { start: 0.0, end: 5.0, text: 'Got the contractor quotes back for solar panels and roof repair.' },
      { start: 5.0, end: 11.0, text: 'The electrician is coming on October 18th to inspect the main electrical panel.' },
      { start: 11.0, end: 16.0, text: 'We decided to go with the eight kilowatt solar system.' },
      { start: 16.0, end: 22.0, text: 'I should call the city permits office on Wednesday morning to check zoning approvals.' },
    ],
    summary: 'Selected the 8kW solar system. Electrician inspection scheduled for October 18th, and city permits office must be called Wednesday morning.',
    tasks: [
      {
        title: 'Call city permits office on Wednesday morning for zoning approvals',
        evidence: 'I should call the city permits office on Wednesday morning to check zoning approvals.',
        confidence: 0.96,
        dueDate: 'Wednesday morning',
        priority: 'high',
      },
      {
        title: 'Prepare breaker panel access for electrician inspection on October 18th',
        evidence: 'The electrician is coming on October 18th to inspect the main electrical panel.',
        confidence: 0.93,
        dueDate: 'October 18th',
        priority: 'medium',
      },
    ],
    ideas: [],
    decisions: [
      {
        decision: 'Go with the eight kilowatt solar system',
        evidence: 'We decided to go with the eight kilowatt solar system.',
      },
    ],
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
    durationSeconds: 20.0,
    transcript: 'Engineering sync discussion about our background processing worker. We decided to use Go for the audio ingestion service because of its simple concurrency model and fast startup time. I need to benchmark the FFmpeg subprocess throughput against Node.js by Friday.',
    segments: [
      { start: 0.0, end: 4.5, text: 'Engineering sync discussion about our background processing worker.' },
      { start: 4.5, end: 12.0, text: 'We decided to use Go for the audio ingestion service because of its simple concurrency model and fast startup time.' },
      { start: 12.0, end: 20.0, text: 'I need to benchmark the FFmpeg subprocess throughput against Node.js by Friday.' },
    ],
    summary: 'Decided on Go for the background audio ingestion service due to concurrency benefits. Subprocess benchmarking is due Friday.',
    tasks: [
      {
        title: 'Benchmark FFmpeg subprocess throughput against Node.js by Friday',
        evidence: 'I need to benchmark the FFmpeg subprocess throughput against Node.js by Friday.',
        confidence: 0.98,
        dueDate: 'Friday',
        priority: 'high',
      },
      {
        title: 'Document memory profile comparison in engineering wiki',
        evidence: 'Engineering sync discussion about our background processing worker.',
        confidence: 0.92,
        dueDate: 'Next Monday',
        priority: 'medium',
      },
    ],
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
    people: [],
    topics: ['Engineering', 'Architecture', 'Go'],
    importantDates: [
      { event: 'FFmpeg benchmark completion', date: 'Friday', evidence: 'by Friday' },
    ],
  },
];

export async function loadDemoDataset(): Promise<{ loaded: number }> {
  const embedder = getEmbeddingProvider();
  const db = getDb();

  for (const spec of DEMO_NOTES) {
    // 1. Voice Note record
    createVoiceNote({
      id: spec.id,
      title: spec.title,
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
      summary: spec.summary,
      tasks: spec.tasks.map((t, idx) => ({
        id: `${spec.id}-task-${idx + 1}`,
        title: t.title,
        sourceNoteId: spec.id,
        evidence: t.evidence,
        confidence: t.confidence,
        dueDate: t.dueDate,
        completed: false,
        priority: t.priority,
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
      people: spec.people,
      topics: spec.topics,
      importantDates: spec.importantDates,
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
