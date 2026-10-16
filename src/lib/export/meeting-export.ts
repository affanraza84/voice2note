import { VoiceNote, TaskItem, EmailDraft } from '@/types';

/**
 * Generate a complete, beautifully structured Markdown export of a client meeting note.
 */
export function generateMeetingMarkdown(note: VoiceNote): string {
  const ext = note.extraction;
  const lines: string[] = [];

  // Header & Metadata
  lines.push(`# ${note.title}`);
  lines.push('');
  if (note.client) lines.push(`**Client:** ${note.client}`);
  if (note.project) lines.push(`**Project:** ${note.project}`);
  lines.push(`**Recorded At:** ${new Date(note.createdAt).toLocaleString('en-US')}`);
  lines.push(`**Duration:** ${Math.floor(note.durationSeconds / 60)}m ${Math.floor(note.durationSeconds % 60)}s`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Call Summary
  if (ext?.callSummary || ext?.summary) {
    lines.push('## Executive Client-Call Summary');
    lines.push('');
    lines.push(ext.callSummary || ext.summary);
    lines.push('');
  }

  // Client Commitments
  if (ext?.clientCommitments && ext.clientCommitments.length > 0) {
    lines.push('## Client Commitments (Deliverables & Access)');
    lines.push('');
    for (const c of ext.clientCommitments) {
      const byStr = c.by ? ` *(by ${c.by})*` : '';
      lines.push(`- **${c.commitment}**${byStr}`);
      if (c.evidence) {
        lines.push(`  > _"${c.evidence}"_`);
      }
    }
    lines.push('');
  }

  // Action Items / Tasks
  if (ext?.tasks && ext.tasks.length > 0) {
    lines.push('## Action Items & Next Steps');
    lines.push('');
    for (const t of ext.tasks) {
      const check = t.completed ? '[x]' : '[ ]';
      const dateInfo = t.dueDate ? ` (Due: ${t.dueDate} [${t.dueDateType || 'explicit'}])` : ' (No deadline)';
      const prio = `[${t.priority.toUpperCase()}]`;
      lines.push(`- ${check} **${t.title}** ${prio}${dateInfo}`);
      if (t.evidence) {
        lines.push(`  > _"${t.evidence}"_`);
      }
    }
    lines.push('');
  }

  // Decisions Finalized
  if (ext?.decisions && ext.decisions.length > 0) {
    lines.push('## Key Decisions Finalized');
    lines.push('');
    for (const d of ext.decisions) {
      lines.push(`- **${d.decision}**`);
      if (d.evidence) {
        lines.push(`  > _"${d.evidence}"_`);
      }
    }
    lines.push('');
  }

  // Open Questions
  if (ext?.openQuestions && ext.openQuestions.length > 0) {
    lines.push('## Open Questions & Ambiguities');
    lines.push('');
    for (const q of ext.openQuestions) {
      const byStr = q.askedBy ? ` *(Asked by: ${q.askedBy})*` : '';
      lines.push(`- **${q.question}**${byStr}`);
      if (q.evidence) {
        lines.push(`  > _"${q.evidence}"_`);
      }
    }
    lines.push('');
  }

  // Follow-Up Suggestions
  if (ext?.followUpSuggestions && ext.followUpSuggestions.length > 0) {
    lines.push('## Follow-Up Suggestions');
    lines.push('');
    for (const s of ext.followUpSuggestions) {
      lines.push(`- **${s.suggestion}**`);
      if (s.rationale) {
        lines.push(`  - *Rationale:* ${s.rationale}`);
      }
      if (s.evidence) {
        lines.push(`  > _"${s.evidence}"_`);
      }
    }
    lines.push('');
  }

  // Follow-Up Email Draft
  if (ext?.emailDraft && (ext.emailDraft.subject || ext.emailDraft.body)) {
    lines.push('## Follow-Up Email Draft');
    lines.push('');
    if (ext.emailDraft.subject) {
      lines.push(`**Subject:** ${ext.emailDraft.subject}`);
      lines.push('');
    }
    if (ext.emailDraft.body) {
      lines.push('```text');
      lines.push(ext.emailDraft.body);
      lines.push('```');
      lines.push('');
    }
  }

  // Transcript
  if (note.transcript?.rawText) {
    lines.push('## Raw Transcript');
    lines.push('');
    lines.push(note.transcript.rawText);
    lines.push('');
  }

  lines.push('---');
  lines.push('*Exported from Voice2Note - Freelancer Meeting Follow-Up Assistant*');

  return lines.join('\n');
}

/**
 * Generate a CSV spreadsheet export of tasks.
 */
export function generateTasksCSV(
  tasks: TaskItem[],
  noteTitle: string,
  client?: string,
  project?: string
): string {
  const headers = [
    'Task ID',
    'Task Title',
    'Completed',
    'Priority',
    'Due Date',
    'Date Type',
    'Evidence Quote',
    'Source Note',
    'Client',
    'Project',
  ];

  const escapeCSV = (val: string | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows: string[] = [headers.map((h) => `"${h}"`).join(',')];

  for (const t of tasks) {
    const row = [
      escapeCSV(t.id),
      escapeCSV(t.title),
      escapeCSV(t.completed ? 'YES' : 'NO'),
      escapeCSV(t.priority),
      escapeCSV(t.dueDate || ''),
      escapeCSV(t.dueDateType || 'none'),
      escapeCSV(t.evidence || ''),
      escapeCSV(noteTitle),
      escapeCSV(client || ''),
      escapeCSV(project || ''),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\r\n');
}

/**
 * Trigger browser file download
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate mailto URL for external user-controlled sending.
 */
export function generateMailtoUrl(emailDraft: EmailDraft): string {
  const subject = encodeURIComponent(emailDraft.subject || '');
  const body = encodeURIComponent(emailDraft.body || '');
  return `mailto:?subject=${subject}&body=${body}`;
}
