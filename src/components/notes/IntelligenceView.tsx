'use client';

import React, { useState, useEffect } from 'react';
import { Extraction, TaskItem, EmailDraft, DueDateType } from '@/types';
import {
  CheckCircle2,
  Circle,
  Lightbulb,
  CheckSquare,
  Users,
  Tag,
  Calendar,
  Sparkles,
  Quote,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Mail,
  ExternalLink,
  Edit2,
  Save,
  X,
  Briefcase,
  HelpCircle,
  Compass,
  FileSpreadsheet,
} from 'lucide-react';
import { generateTasksCSV, downloadFile, generateMailtoUrl } from '@/lib/export/meeting-export';

interface IntelligenceViewProps {
  extraction: Extraction | null;
  noteId: string;
  noteTitle?: string;
  client?: string;
  project?: string;
  onTaskToggle?: (taskId: string, completed: boolean) => void;
}

export function IntelligenceView({
  extraction,
  noteId,
  noteTitle = 'Client Meeting',
  client = '',
  project = '',
  onTaskToggle,
}: IntelligenceViewProps) {
  const [tasks, setTasks] = useState<TaskItem[]>(extraction?.tasks || []);
  const [showEvidenceFor, setShowEvidenceFor] = useState<Record<string, boolean>>({});
  const [copiedChecklist, setCopiedChecklist] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Task editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDueDate, setEditTaskDueDate] = useState('');
  const [editTaskDueDateType, setEditTaskDueDateType] = useState<DueDateType>('none');
  const [editTaskPriority, setEditTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isSavingTask, setIsSavingTask] = useState(false);

  // Email draft editing state
  const [emailDraft, setEmailDraft] = useState<EmailDraft>(
    extraction?.emailDraft || { subject: '', body: '', recipientName: '' }
  );
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailSaveSuccess, setEmailSaveSuccess] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Call summary editing state
  const [callSummary, setCallSummary] = useState(
    extraction?.callSummary || extraction?.summary || ''
  );
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isSavingSummary, setIsSavingSummary] = useState(false);

  useEffect(() => {
    if (extraction?.tasks) {
      setTasks(extraction.tasks);
    }
    if (extraction?.emailDraft) {
      setEmailDraft(extraction.emailDraft);
    }
    if (extraction?.callSummary || extraction?.summary) {
      setCallSummary(extraction.callSummary || extraction.summary);
    }
  }, [extraction]);

  if (!extraction) {
    return (
      <div className="p-8 rounded-2xl glass-panel text-center text-zinc-500 space-y-2">
        <Sparkles className="w-6 h-6 mx-auto text-zinc-600" />
        <p className="text-sm">Structured intelligence has not been extracted yet.</p>
        <p className="text-xs text-zinc-600">Local Llama 3.2 will extract client commitments, tasks, decisions, and follow-up drafts during background analysis.</p>
      </div>
    );
  }

  const copyChecklist = () => {
    if (tasks.length === 0) return;
    const lines = [
      `### Action Items: ${extraction.title || noteTitle}`,
      ...tasks.map(
        (t) => `- [${t.completed ? 'x' : ' '}] ${t.title}${t.dueDate ? ` (Due: ${t.dueDate} [${t.dueDateType || 'explicit'}])` : ''}`
      ),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedChecklist(true);
    setTimeout(() => setCopiedChecklist(false), 2000);
  };

  const handleExportTasksCSV = () => {
    const csvContent = generateTasksCSV(tasks, noteTitle, client, project);
    const filename = `${noteTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-tasks.csv`;
    downloadFile(csvContent, filename, 'text/csv');
  };

  const toggleTask = async (taskId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, completed: nextStatus } : t));
    setTasks(updated);

    if (onTaskToggle) {
      onTaskToggle(taskId, nextStatus);
    }

    try {
      await fetch(`/api/notes/${noteId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, completed: nextStatus }),
      });
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const startEditingTask = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskDueDate(task.dueDate || '');
    setEditTaskDueDateType(task.dueDateType || (task.dueDate ? 'explicit' : 'none'));
    setEditTaskPriority(task.priority);
  };

  const cancelEditingTask = () => {
    setEditingTaskId(null);
  };

  const saveTaskEdits = async (taskId: string) => {
    if (!editTaskTitle.trim()) return;
    setIsSavingTask(true);
    try {
      const res = await fetch(`/api/notes/${noteId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          title: editTaskTitle.trim(),
          dueDate: editTaskDueDate.trim() || null,
          dueDateType: editTaskDueDate.trim() ? editTaskDueDateType : 'none',
          priority: editTaskPriority,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
        setEditingTaskId(null);
      }
    } catch (err) {
      console.error('Failed to save task edits:', err);
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleSaveEmailDraft = async () => {
    setIsSavingEmail(true);
    try {
      const res = await fetch(`/api/notes/${noteId}/extraction`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailDraft }),
      });
      if (res.ok) {
        setIsEditingEmail(false);
        setEmailSaveSuccess(true);
        setTimeout(() => setEmailSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Failed to save email draft:', err);
    } finally {
      setIsSavingEmail(false);
    }
  };

  const copyEmailText = () => {
    const fullText = `Subject: ${emailDraft.subject}\n\n${emailDraft.body}`;
    navigator.clipboard.writeText(fullText);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleSaveSummary = async () => {
    setIsSavingSummary(true);
    try {
      const res = await fetch(`/api/notes/${noteId}/extraction`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSummary: callSummary.trim() }),
      });
      if (res.ok) {
        setIsEditingSummary(false);
      }
    } catch (err) {
      console.error('Failed to save summary:', err);
    } finally {
      setIsSavingSummary(false);
    }
  };

  const toggleEvidence = (id: string) => {
    setShowEvidenceFor((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Client Call Summary Card */}
      <div className="p-5 sm:p-6 rounded-2xl glass-panel border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Executive Client-Call Summary
          </span>
          <div className="flex items-center gap-2">
            {!isEditingSummary ? (
              <button
                onClick={() => setIsEditingSummary(true)}
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSaveSummary}
                  disabled={isSavingSummary}
                  className="flex items-center gap-1 text-[11px] text-black font-semibold bg-emerald-400 hover:bg-emerald-300 px-2.5 py-1 rounded transition cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span>{isSavingSummary ? 'Saving...' : 'Save'}</span>
                </button>
                <button
                  onClick={() => {
                    setCallSummary(extraction.callSummary || extraction.summary);
                    setIsEditingSummary(false);
                  }}
                  className="p-1 rounded text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {isEditingSummary ? (
          <textarea
            value={callSummary}
            onChange={(e) => setCallSummary(e.target.value)}
            rows={3}
            className="w-full p-3 rounded-xl bg-black/40 border border-emerald-500/40 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
          />
        ) : (
          <p className="text-sm text-zinc-200 leading-relaxed font-sans">{callSummary}</p>
        )}
      </div>

      {/* Follow-up Email Draft Card (Editable & External Dispatch) */}
      <div className="p-5 sm:p-6 rounded-2xl glass-panel border border-white/5 space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-sky-400" />
              Follow-Up Email Draft
            </span>
            <span className="text-[10px] text-zinc-400 font-mono px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
              User-Controlled Send
            </span>
          </div>

          <div className="flex items-center gap-2">
            {emailSaveSuccess && (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                <Check className="w-3 h-3" /> Saved!
              </span>
            )}

            {!isEditingEmail ? (
              <button
                onClick={() => setIsEditingEmail(true)}
                className="flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition cursor-pointer"
              >
                <Edit2 className="w-3 h-3 text-zinc-400" />
                <span>Edit Draft</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSaveEmailDraft}
                  disabled={isSavingEmail}
                  className="flex items-center gap-1 text-[11px] text-black font-semibold bg-emerald-400 hover:bg-emerald-300 px-3 py-1 rounded-lg transition cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span>{isSavingEmail ? 'Saving...' : 'Save Draft'}</span>
                </button>
                <button
                  onClick={() => setIsEditingEmail(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={copyEmailText}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[11px] font-medium transition cursor-pointer border border-white/5"
              title="Copy subject and email body to clipboard"
            >
              {copiedEmail ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-zinc-400" />
                  <span>Copy Email</span>
                </>
              )}
            </button>

            <a
              href={generateMailtoUrl(emailDraft)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 hover:text-sky-200 text-[11px] font-semibold border border-sky-500/30 transition cursor-pointer"
              title="Launch your desktop email client with this subject and body"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open in Email App</span>
            </a>
          </div>
        </div>

        {isEditingEmail ? (
          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">Subject</label>
              <input
                type="text"
                value={emailDraft.subject}
                onChange={(e) => setEmailDraft({ ...emailDraft, subject: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-sky-500/40 text-sm text-white font-medium focus:outline-none focus:ring-1 focus:ring-sky-400"
              />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">Email Body</label>
              <textarea
                value={emailDraft.body}
                onChange={(e) => setEmailDraft({ ...emailDraft, body: e.target.value })}
                rows={8}
                className="w-full p-3 rounded-xl bg-black/40 border border-sky-500/40 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-400 font-sans leading-relaxed"
              />
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-xs border-b border-white/5 pb-2">
              <span className="text-zinc-500 font-medium">Subject:</span>
              <span className="text-zinc-200 font-semibold">{emailDraft.subject || 'Follow-up regarding our call'}</span>
            </div>
            <p className="text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed pt-1">
              {emailDraft.body || 'No email draft generated yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Grid: Action Items & Client Commitments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Action Items / Freelancer Tasks */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-amber-400" />
              Action Items ({tasks.filter((t) => !t.completed).length} pending)
            </span>

            <div className="flex items-center gap-2">
              {tasks.length > 0 && (
                <>
                  <button
                    onClick={copyChecklist}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[11px] font-medium transition cursor-pointer border border-white/5"
                    title="Copy all tasks as Markdown checklist"
                  >
                    {copiedChecklist ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-zinc-400" />
                        <span>Markdown</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleExportTasksCSV}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[11px] font-medium transition cursor-pointer border border-white/5"
                    title="Export tasks to CSV file"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                    <span>CSV</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {tasks.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">No action items detected in this recording.</p>
          ) : (
            <div className="space-y-2.5">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-3 rounded-xl border transition-all ${
                    task.completed
                      ? 'bg-white/[0.01] border-white/5 opacity-60'
                      : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                  }`}
                >
                  {editingTaskId === task.id ? (
                    /* Inline Task Edit Form */
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Task Title</label>
                        <input
                          type="text"
                          value={editTaskTitle}
                          onChange={(e) => setEditTaskTitle(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-amber-500/50 text-xs text-white focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Due Date</label>
                          <input
                            type="text"
                            placeholder="e.g. Friday Nov 21"
                            value={editTaskDueDate}
                            onChange={(e) => setEditTaskDueDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs text-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Date Type</label>
                          <select
                            value={editTaskDueDateType}
                            onChange={(e) => setEditTaskDueDateType(e.target.value as DueDateType)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none"
                          >
                            <option value="explicit">Explicit (Confirmed)</option>
                            <option value="inferred">Inferred (Tentative)</option>
                            <option value="none">None (No deadline)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Priority</label>
                          <select
                            value={editTaskPriority}
                            onChange={(e) => setEditTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none"
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                        <button
                          onClick={cancelEditingTask}
                          className="px-2.5 py-1 rounded text-zinc-400 hover:text-white text-[11px] bg-white/5 hover:bg-white/10"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveTaskEdits(task.id)}
                          disabled={isSavingTask}
                          className="px-3 py-1 rounded bg-amber-400 text-black font-semibold text-[11px] hover:bg-amber-300"
                        >
                          {isSavingTask ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal Task Row */
                    <div className="flex items-start gap-2.5">
                      <button
                        onClick={() => toggleTask(task.id, task.completed)}
                        className="mt-0.5 text-zinc-400 hover:text-emerald-400 cursor-pointer"
                        title={task.completed ? 'Mark pending' : 'Mark complete'}
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`text-xs font-medium text-zinc-100 ${
                              task.completed ? 'line-through text-zinc-500' : ''
                            }`}
                          >
                            {task.title}
                          </span>
                          <button
                            onClick={() => startEditingTask(task)}
                            className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-white/5 cursor-pointer"
                            title="Edit task title, due date, or priority"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap text-[10px]">
                          {task.dueDate && (
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono border ${
                                task.dueDateType === 'explicit'
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                  : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                              }`}
                              title={
                                task.dueDateType === 'explicit'
                                  ? 'Explicit deadline stated in transcript'
                                  : 'Inferred or approximate timeframe'
                              }
                            >
                              Due: {task.dueDate}
                              <span className="ml-1 opacity-75 text-[9px] uppercase">
                                ({task.dueDateType || 'explicit'})
                              </span>
                            </span>
                          )}

                          <span
                            className={`px-1.5 py-0.5 rounded uppercase font-mono ${
                              task.priority === 'high'
                                ? 'bg-red-500/10 text-red-400'
                                : task.priority === 'low'
                                ? 'bg-zinc-500/10 text-zinc-400'
                                : 'bg-blue-500/10 text-blue-400'
                            }`}
                          >
                            {task.priority}
                          </span>

                          {task.evidence && (
                            <button
                              onClick={() => toggleEvidence(task.id)}
                              className="text-zinc-500 hover:text-zinc-300 flex items-center gap-0.5 ml-auto cursor-pointer"
                            >
                              <Quote className="w-2.5 h-2.5" />
                              <span>Evidence</span>
                              {showEvidenceFor[task.id] ? (
                                <ChevronUp className="w-2.5 h-2.5" />
                              ) : (
                                <ChevronDown className="w-2.5 h-2.5" />
                              )}
                            </button>
                          )}
                        </div>

                        {showEvidenceFor[task.id] && task.evidence && (
                          <div className="mt-1.5 p-2 rounded-lg bg-black/40 text-[11px] text-zinc-400 italic border border-white/5 animate-in fade-in duration-100">
                            &ldquo;{task.evidence}&rdquo;
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Client Commitments (What client promised to deliver) */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-emerald-400" />
              Client Commitments ({extraction.clientCommitments?.length || 0})
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Client Deliverables</span>
          </div>

          {!extraction.clientCommitments || extraction.clientCommitments.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">No specific deliverables committed by client during call.</p>
          ) : (
            <div className="space-y-2.5">
              {extraction.clientCommitments.map((item, idx) => (
                <div key={item.id || idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-zinc-200">{item.commitment}</p>
                    {item.by && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono shrink-0">
                        {item.by}
                      </span>
                    )}
                  </div>
                  {item.evidence && (
                    <p className="text-[11px] text-zinc-500 italic flex items-center gap-1">
                      <Quote className="w-2.5 h-2.5 shrink-0" />
                      <span>{item.evidence}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid: Decisions & Open Questions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Decisions Finalized */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
            Decisions Finalized ({extraction.decisions.length})
          </span>

          {extraction.decisions.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">No explicit decisions finalized in recording.</p>
          ) : (
            <div className="space-y-2">
              {extraction.decisions.map((d, idx) => (
                <div key={d.id || idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <p className="text-xs font-medium text-zinc-200">{d.decision}</p>
                  {d.evidence && <p className="text-[11px] text-zinc-500 italic">&ldquo;{d.evidence}&rdquo;</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Open Questions & Ambiguities */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-rose-400" />
            Open Questions ({extraction.openQuestions?.length || 0})
          </span>

          {!extraction.openQuestions || extraction.openQuestions.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">No unresolved questions or ambiguities detected.</p>
          ) : (
            <div className="space-y-2">
              {extraction.openQuestions.map((q, idx) => (
                <div key={q.id || idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-zinc-200">{q.question}</p>
                    {q.askedBy && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-mono shrink-0">
                        {q.askedBy}
                      </span>
                    )}
                  </div>
                  {q.evidence && <p className="text-[11px] text-zinc-500 italic">&ldquo;{q.evidence}&rdquo;</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid: Follow-Up Suggestions & Ideas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Proactive Follow-Up Suggestions */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-amber-400" />
            Follow-Up Suggestions ({extraction.followUpSuggestions?.length || 0})
          </span>

          {!extraction.followUpSuggestions || extraction.followUpSuggestions.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">No follow-up recommendations identified.</p>
          ) : (
            <div className="space-y-2">
              {extraction.followUpSuggestions.map((s, idx) => (
                <div key={s.id || idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <p className="text-xs font-medium text-zinc-200">{s.suggestion}</p>
                  {s.rationale && (
                    <p className="text-[11px] text-zinc-400"><strong className="text-zinc-500">Why:</strong> {s.rationale}</p>
                  )}
                  {s.evidence && (
                    <p className="text-[11px] text-zinc-500 italic">&ldquo;{s.evidence}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ideas & Brainstorming */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-teal-400" />
            Ideas & Brainstorming ({extraction.ideas.length})
          </span>

          {extraction.ideas.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">No specific brainstorming concepts recorded.</p>
          ) : (
            <div className="space-y-2">
              {extraction.ideas.map((item, idx) => (
                <div key={item.id || idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <p className="text-xs font-medium text-zinc-200">{item.idea}</p>
                  {item.evidence && (
                    <p className="text-[11px] text-zinc-500 italic flex items-center gap-1">
                      <Quote className="w-2.5 h-2.5 shrink-0" />
                      <span>{item.evidence}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dates, People, Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Important Dates */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-purple-400" />
            Milestones & Scheduled Dates ({extraction.importantDates.length})
          </span>

          {extraction.importantDates.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">No scheduled dates or deadlines mentioned.</p>
          ) : (
            <div className="space-y-2">
              {extraction.importantDates.map((dt, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                  <span className="text-zinc-200 font-medium">{dt.event}</span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    {dt.date}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* People & Topics */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-3.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Meeting Metadata & Tags
          </span>

          <div className="space-y-3 text-xs">
            {extraction.people.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-zinc-500">People:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {extraction.people.map((p, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-white/5 text-zinc-300 border border-white/10 text-[11px]">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {extraction.topics.length > 0 && (
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-zinc-500">Topics:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {extraction.topics.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Transparency Banner */}
      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Processed with <strong className="text-zinc-200 font-mono">{extraction.modelUsed || 'Llama 3.2'}</strong>
        </span>
        <span className="text-[11px] text-zinc-500">Strict Evidence Verification & No Hallucinated Deadlines</span>
      </div>
    </div>
  );
}
