'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { VoiceNote, TaskItem, OpenQuestionItem } from '@/types';
import { NoteCard } from '@/components/notes/NoteCard';
import { ProcessingQueue } from '@/components/notes/ProcessingQueue';
import {
  Mic,
  MessageSquare,
  Clock,
  FileAudio,
  CheckSquare,
  ArrowRight,
  ShieldCheck,
  Database,
  AlertTriangle,
  RefreshCw,
  Download,
  Calendar,
  HelpCircle,
  Briefcase,
  ExternalLink,
  CheckCircle2,
  FileText,
  AlertCircle,
  Quote,
} from 'lucide-react';
import {
  generateAllTasksCSV,
  generateAllMeetingsMarkdown,
  downloadFile,
} from '@/lib/export/meeting-export';

interface FlattenedTask {
  task: TaskItem;
  noteId: string;
  noteTitle: string;
  client?: string;
  project?: string;
}

interface FlattenedQuestion {
  question: OpenQuestionItem;
  noteId: string;
  noteTitle: string;
  client?: string;
  project?: string;
}

interface FlattenedDeadline {
  dueDate: string;
  dueDateType: 'explicit' | 'inferred' | 'none';
  title: string;
  task: TaskItem;
  noteId: string;
  noteTitle: string;
  client?: string;
  project?: string;
}

export default function FreelancerDashboardPage() {
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [stats, setStats] = useState({
    totalNotes: 0,
    totalDurationSeconds: 0,
    processingCount: 0,
    readyCount: 0,
    failedCount: 0,
    clientCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryingNoteId, setRetryingNoteId] = useState<string | null>(null);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);
  const [exportNotification, setExportNotification] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setFetchError(null);
      const res = await fetch('/api/notes?limit=50');
      if (!res.ok) {
        throw new Error(`Failed to load data (HTTP ${res.status})`);
      }
      const data = await res.json();
      setNotes(data.notes || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      console.error('Failed to load notes:', err);
      setFetchError(err.message || 'Unable to connect to the local notes database.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 4000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Dismiss export notification after 4 seconds
  useEffect(() => {
    if (!exportNotification) return;
    const t = setTimeout(() => setExportNotification(null), 4000);
    return () => clearTimeout(t);
  }, [exportNotification]);

  const formatTotalTime = (secs: number) => {
    if (!secs || secs <= 0) return '0 min';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ${Math.floor(secs % 60)}s`;
    const hrs = (mins / 60).toFixed(1);
    return `${hrs} hrs`;
  };

  // 1. Incomplete Tasks across all client calls
  const incompleteTasks: FlattenedTask[] = useMemo(() => {
    const list: FlattenedTask[] = [];
    for (const note of notes) {
      const client = note.client || note.extraction?.client;
      const project = note.project || note.extraction?.project;
      const tasks = note.extraction?.tasks || [];
      for (const task of tasks) {
        if (!task.completed) {
          list.push({
            task,
            noteId: note.id,
            noteTitle: note.title,
            client,
            project,
          });
        }
      }
    }
    return list;
  }, [notes]);

  // Filtered incomplete tasks for UI
  const filteredTasks = useMemo(() => {
    if (priorityFilter === 'all') return incompleteTasks;
    return incompleteTasks.filter((item) => item.task.priority === priorityFilter);
  }, [incompleteTasks, priorityFilter]);

  // 2. Upcoming Deadlines sorted by date
  const upcomingDeadlines: FlattenedDeadline[] = useMemo(() => {
    const list: FlattenedDeadline[] = [];
    for (const item of incompleteTasks) {
      if (item.task.dueDate && item.task.dueDate.trim().length > 0) {
        list.push({
          dueDate: item.task.dueDate,
          dueDateType: item.task.dueDateType || 'explicit',
          title: item.task.title,
          task: item.task,
          noteId: item.noteId,
          noteTitle: item.noteTitle,
          client: item.client,
          project: item.project,
        });
      }
    }
    // Sort deadlines chronologically / alphabetically
    return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [incompleteTasks]);

  // 3. Open Client Questions across all notes
  const openQuestions: FlattenedQuestion[] = useMemo(() => {
    const list: FlattenedQuestion[] = [];
    for (const note of notes) {
      const client = note.client || note.extraction?.client;
      const project = note.project || note.extraction?.project;
      const questions = note.extraction?.openQuestions || [];
      for (const question of questions) {
        list.push({
          question,
          noteId: note.id,
          noteTitle: note.title,
          client,
          project,
        });
      }
    }
    return list;
  }, [notes]);

  // 4. Processing Failures
  const failedNotes = useMemo(() => {
    return notes.filter((n) => n.status === 'failed');
  }, [notes]);

  // 5. Active Clients count (distinct non-empty client names)
  const activeClientsCount = useMemo(() => {
    const clients = new Set<string>();
    for (const note of notes) {
      const c = note.client || note.extraction?.client;
      if (c && c.trim().length > 0) {
        clients.add(c.trim().toLowerCase());
      }
    }
    return Math.max(clients.size, stats.clientCount || 0);
  }, [notes, stats.clientCount]);

  // Handle task completion toggle directly from dashboard
  const handleToggleTask = async (noteId: string, taskId: string, currentCompleted: boolean) => {
    setTogglingTaskId(taskId);
    setActionError(null);
    try {
      const res = await fetch(`/api/notes/${noteId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, completed: !currentCompleted }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update task status');
      }

      // Optimistically update local state
      setNotes((prevNotes) =>
        prevNotes.map((n) => {
          if (n.id !== noteId || !n.extraction) return n;
          const updatedTasks = n.extraction.tasks.map((t) =>
            t.id === taskId ? { ...t, completed: !currentCompleted } : t
          );
          return {
            ...n,
            extraction: {
              ...n.extraction,
              tasks: updatedTasks,
            },
          };
        })
      );
    } catch (err: any) {
      console.error('Failed to toggle task:', err);
      setActionError(err.message || 'Could not update task. Please try again.');
    } finally {
      setTogglingTaskId(null);
    }
  };

  // Handle retrying a failed processing job
  const handleRetryProcessing = async (noteId: string) => {
    setRetryingNoteId(noteId);
    setActionError(null);
    try {
      const res = await fetch(`/api/notes/${noteId}/transcribe`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Retry request failed');
      }
      await fetchDashboardData();
    } catch (err: any) {
      console.error('Failed to retry processing:', err);
      setActionError(err.message || 'Retry failed. Check model or local Ollama/Whisper availability.');
    } finally {
      setRetryingNoteId(null);
    }
  };

  // Export incomplete tasks as CSV
  const handleExportTasksCSV = () => {
    if (incompleteTasks.length === 0) {
      setExportNotification('No pending tasks to export.');
      return;
    }
    const csv = generateAllTasksCSV(incompleteTasks);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadFile(csv, `pending-client-tasks-${dateStr}.csv`, 'text/csv');
    setExportNotification(`Exported ${incompleteTasks.length} pending client task(s) to CSV.`);
  };

  // Export all calls summary as Markdown
  const handleExportCallsMarkdown = () => {
    const readyNotes = notes.filter((n) => n.status === 'ready');
    if (readyNotes.length === 0) {
      setExportNotification('No processed client call notes to export.');
      return;
    }
    const md = generateAllMeetingsMarkdown(readyNotes);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadFile(md, `client-calls-summary-${dateStr}.md`, 'text/markdown');
    setExportNotification(`Exported ${readyNotes.length} client call summary/summaries to Markdown.`);
  };

  return (
    <main role="main" className="space-y-8 animate-in fade-in duration-150 pb-12">
      {/* Export & Action Feedback Toast */}
      {exportNotification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-zinc-900 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-sm backdrop-blur-md"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{exportNotification}</span>
        </div>
      )}

      {/* Recoverable Network / Fetch Error Banner */}
      {fetchError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-between gap-3 text-sm"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="font-semibold text-rose-200">Unable to load dashboard data</p>
              <p className="text-xs text-rose-300/80">{fetchError}</p>
            </div>
          </div>
          <button
            onClick={() => fetchDashboardData()}
            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-amber-300 hover:text-white underline text-xs font-medium cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Freelancer Workflow Hero Section */}
      <header className="card-base p-8 sm:p-10 rounded-3xl relative overflow-hidden">
        <div className="max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% Local & Confidential Client Data</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Freelancer Meeting Follow-Up</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Client Calls & Deliverables,<br />
            Handled with Precision.
          </h1>

          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl">
            Turn client consultations into verified commitments, action items with explicit vs inferred deadlines, open client questions, and editable follow-up email drafts — without sharing confidential client audio with external servers.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/record"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
              aria-label="Record a new client call"
            >
              <Mic className="w-4 h-4" />
              <span>Record Client Call</span>
            </Link>

            <Link
              href="/ask"
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 font-semibold text-sm transition-all cursor-pointer"
              aria-label="Ask questions across client notes"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>Ask My Notes</span>
            </Link>

            {/* Quick Export Actions */}
            <button
              onClick={handleExportTasksCSV}
              disabled={incompleteTasks.length === 0}
              title={incompleteTasks.length === 0 ? 'No pending tasks to export' : 'Export pending tasks to CSV'}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 border border-white/10 font-semibold text-sm transition-all cursor-pointer"
              aria-label="Export pending tasks to CSV"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Export Tasks (CSV)</span>
            </button>

            <button
              onClick={handleExportCallsMarkdown}
              disabled={notes.filter((n) => n.status === 'ready').length === 0}
              title="Export all client call summaries to Markdown"
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 border border-white/10 font-semibold text-sm transition-all cursor-pointer"
              aria-label="Export call summaries to Markdown"
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Export Summaries (MD)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Factual, Verified Metrics (NO fabricated time-saved or accuracy percentages!) */}
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="sr-only">Overview Metrics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="p-4 sm:p-5 rounded-2xl card-base space-y-1">
            <span className="text-xs text-zinc-400 flex items-center gap-1.5 font-medium">
              <Briefcase className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Active Clients
            </span>
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {loading ? '-' : activeClientsCount}
            </div>
            <p className="text-[11px] text-zinc-500">Distinct client accounts</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl card-base space-y-1">
            <span className="text-xs text-zinc-400 flex items-center gap-1.5 font-medium">
              <CheckSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              Incomplete Tasks
            </span>
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {loading ? '-' : incompleteTasks.length}
            </div>
            <p className="text-[11px] text-zinc-500">Across all client calls</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl card-base space-y-1">
            <span className="text-xs text-zinc-400 flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              Upcoming Deadlines
            </span>
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {loading ? '-' : upcomingDeadlines.length}
            </div>
            <p className="text-[11px] text-zinc-500">
              {upcomingDeadlines.filter((d) => d.dueDateType === 'explicit').length} confirmed,{' '}
              {upcomingDeadlines.filter((d) => d.dueDateType === 'inferred').length} tentative
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl card-base space-y-1">
            <span className="text-xs text-zinc-400 flex items-center gap-1.5 font-medium">
              <HelpCircle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              Open Client Questions
            </span>
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {loading ? '-' : openQuestions.length}
            </div>
            <p className="text-[11px] text-zinc-500">Unresolved client queries</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl card-base space-y-1 col-span-2 sm:col-span-1">
            <span className="text-xs text-zinc-400 flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              Recorded Audio
            </span>
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {loading ? '-' : formatTotalTime(stats.totalDurationSeconds)}
            </div>
            <p className="text-[11px] text-zinc-500">
              {stats.totalNotes} {stats.totalNotes === 1 ? 'total call' : 'total calls'}
            </p>
          </div>
        </div>
      </section>

      {/* Processing Failures Banner & Recoverable Retry */}
      {failedNotes.length > 0 && (
        <section aria-labelledby="failures-heading" className="space-y-3">
          <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-rose-300">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <h2 id="failures-heading" className="text-sm font-bold text-rose-200">
                  Processing Failures ({failedNotes.length})
                </h2>
              </div>
              <span className="text-xs text-rose-300/80">
                Transcripts are preserved. Click retry to rerun extraction and embedding stages safely.
              </span>
            </div>

            <div className="space-y-2">
              {failedNotes.map((failedNote) => (
                <div
                  key={failedNote.id}
                  className="p-3 rounded-xl bg-black/40 border border-rose-500/20 flex items-center justify-between gap-3 text-xs flex-wrap"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{failedNote.title}</span>
                      {failedNote.client && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300">
                          {failedNote.client}
                        </span>
                      )}
                    </div>
                    <p className="text-rose-400/90 text-[11px]">
                      {failedNote.errorMessage || 'A processing stage encountered an error.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/notes/${failedNote.id}`}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors"
                    >
                      View Note
                    </Link>
                    <button
                      onClick={() => handleRetryProcessing(failedNote.id)}
                      disabled={retryingNoteId === failedNote.id}
                      className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      aria-label={`Retry processing for ${failedNote.title}`}
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${retryingNoteId === failedNote.id ? 'animate-spin' : ''}`}
                      />
                      <span>{retryingNoteId === failedNote.id ? 'Retrying...' : 'Retry'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Active Processing Queue */}
      <ProcessingQueue notes={notes} />

      {/* Two Column Section: Incomplete Tasks & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incomplete Tasks Section (2 cols on large screen) */}
        <section aria-labelledby="tasks-heading" className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 id="tasks-heading" className="text-lg font-bold text-white flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-amber-400" />
                <span>Incomplete Client Tasks</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono">
                  {incompleteTasks.length}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Action items extracted from client calls with transcript evidence
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Priority Filter */}
              <div className="flex items-center bg-zinc-900 border border-white/10 rounded-xl p-0.5 text-xs">
                {(['all', 'high', 'medium', 'low'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriorityFilter(p)}
                    className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-all cursor-pointer ${
                      priorityFilter === p
                        ? 'bg-amber-500 text-black font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* CSV Export Button */}
              {incompleteTasks.length > 0 && (
                <button
                  onClick={handleExportTasksCSV}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition-colors cursor-pointer"
                  title="Export tasks to CSV"
                  aria-label="Export incomplete tasks to CSV"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="card-base p-8 text-center text-zinc-500 text-sm animate-pulse rounded-2xl">
              Loading pending tasks...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-8 rounded-2xl card-base border-dashed text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-200">
                {priorityFilter === 'all'
                  ? 'All client tasks are complete!'
                  : `No ${priorityFilter}-priority incomplete tasks`}
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                {priorityFilter === 'all'
                  ? "Great job staying ahead of your client commitments. Record a new client call to track your next milestone."
                  : `Switch filters or record a new client meeting to capture ${priorityFilter}-priority tasks.`}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTasks.slice(0, 10).map(({ task, noteId, noteTitle, client, project }) => (
                <article
                  key={task.id}
                  className="p-3.5 rounded-2xl card-base hover:border-zinc-700 transition-all space-y-2.5 group"
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleTask(noteId, task.id, !!task.completed)}
                      disabled={togglingTaskId === task.id}
                      className="mt-0.5 w-5 h-5 rounded-md border border-zinc-600 hover:border-amber-400 flex items-center justify-center bg-zinc-900 transition-colors cursor-pointer shrink-0"
                      aria-label={`Mark task "${task.title}" complete`}
                    >
                      {togglingTaskId === task.id ? (
                        <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                      ) : task.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : null}
                    </button>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-zinc-100 group-hover:text-white transition-colors">
                          {task.title}
                        </span>

                        {/* Priority Badge */}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            task.priority === 'high'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : task.priority === 'medium'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-zinc-700/40 text-zinc-400 border border-zinc-700'
                          }`}
                        >
                          {task.priority}
                        </span>

                        {/* Due Date & Explicit/Inferred indicator */}
                        {task.dueDate && (
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 ${
                              task.dueDateType === 'explicit'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            }`}
                            title={
                              task.dueDateType === 'explicit'
                                ? 'Confirmed explicit deadline mentioned by client'
                                : 'Tentative inferred date window - verify with client'
                            }
                          >
                            <Calendar className="w-3 h-3" />
                            <span>{task.dueDate}</span>
                            <span className="text-[9px] uppercase tracking-wider opacity-80">
                              ({task.dueDateType || 'explicit'})
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Evidence quote */}
                      {task.evidence && (
                        <p className="text-xs text-zinc-400 italic flex items-start gap-1 bg-black/20 p-2 rounded-lg border border-white/5">
                          <Quote className="w-3 h-3 text-zinc-500 shrink-0 mt-0.5" />
                          <span>&ldquo;{task.evidence}&rdquo;</span>
                        </p>
                      )}

                      {/* Source Call Attribution */}
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500 pt-0.5">
                        <span>Source:</span>
                        <Link
                          href={`/notes/${noteId}`}
                          className="text-zinc-400 hover:text-emerald-400 font-medium inline-flex items-center gap-1 transition-colors"
                        >
                          <span>{noteTitle}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                        {client && (
                          <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                            {client}
                          </span>
                        )}
                        {project && (
                          <span className="text-zinc-500">({project})</span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}

              {filteredTasks.length > 10 && (
                <p className="text-xs text-center text-zinc-500 pt-2">
                  Showing 10 of {filteredTasks.length} incomplete tasks. Use Export Tasks (CSV) for complete roster.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Right Column: Upcoming Deadlines & Open Client Questions */}
        <div className="space-y-6">
          {/* Upcoming Deadlines */}
          <section aria-labelledby="deadlines-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="deadlines-heading" className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Upcoming Deadlines</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-mono">
                  {upcomingDeadlines.length}
                </span>
              </h2>
            </div>

            {loading ? (
              <div className="card-base p-6 text-center text-zinc-500 text-xs animate-pulse rounded-2xl">
                Checking schedule...
              </div>
            ) : upcomingDeadlines.length === 0 ? (
              <div className="p-6 rounded-2xl card-base border-dashed text-center space-y-1">
                <p className="text-xs font-medium text-zinc-300">No scheduled deadlines</p>
                <p className="text-[11px] text-zinc-500">
                  No confirmed dates or timeframes recorded in your client calls.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.slice(0, 6).map((item, idx) => (
                  <article
                    key={`${item.noteId}-${idx}`}
                    className="p-3 rounded-xl card-base hover:border-zinc-700 transition-all space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded ${
                          item.dueDateType === 'explicit'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}
                      >
                        {item.dueDate}
                      </span>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                        {item.dueDateType === 'explicit' ? 'Confirmed' : 'Tentative'}
                      </span>
                    </div>

                    <p className="font-medium text-zinc-200 line-clamp-2">{item.title}</p>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-white/5">
                      <span className="truncate max-w-[140px] text-zinc-400">
                        {item.client || item.noteTitle}
                      </span>
                      <Link
                        href={`/notes/${item.noteId}`}
                        className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                      >
                        <span>View</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Open Client Questions */}
          <section aria-labelledby="questions-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="questions-heading" className="text-base font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-purple-400" />
                <span>Open Client Questions</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-mono">
                  {openQuestions.length}
                </span>
              </h2>
            </div>

            {loading ? (
              <div className="card-base p-6 text-center text-zinc-500 text-xs animate-pulse rounded-2xl">
                Loading questions...
              </div>
            ) : openQuestions.length === 0 ? (
              <div className="p-6 rounded-2xl card-base border-dashed text-center space-y-1">
                <p className="text-xs font-medium text-zinc-300">All questions answered</p>
                <p className="text-[11px] text-zinc-500">
                  No open client questions or ambiguities flagged from your calls.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {openQuestions.slice(0, 5).map(({ question, noteId, client, project }, idx) => (
                  <article
                    key={`${noteId}-${idx}`}
                    className="p-3 rounded-xl card-base hover:border-zinc-700 transition-all space-y-1.5 text-xs"
                  >
                    <p className="font-semibold text-zinc-200 leading-snug">
                      {question.question}
                    </p>

                    {question.askedBy && (
                      <p className="text-[11px] text-purple-300">
                        Asked by: <span className="font-medium text-purple-200">{question.askedBy}</span>
                      </p>
                    )}

                    {question.evidence && (
                      <p className="text-[11px] text-zinc-400 italic bg-black/20 p-1.5 rounded border border-white/5 line-clamp-2">
                        &ldquo;{question.evidence}&rdquo;
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                      <span>{client || 'Client Call'}{project ? ` (${project})` : ''}</span>
                      <Link
                        href={`/notes/${noteId}`}
                        className="text-purple-400 hover:text-purple-300 flex items-center gap-0.5"
                      >
                        <span>Follow up</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Recent Client Calls Section */}
      <section aria-labelledby="recent-calls-heading" className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="recent-calls-heading" className="text-lg font-bold text-white flex items-center gap-2">
              <FileAudio className="w-5 h-5 text-emerald-400" />
              <span>Recent Client Calls</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Transcriptions, client commitments, decisions, and follow-up email drafts
            </p>
          </div>

          {notes.length > 0 && (
            <Link
              href="/notes"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              <span>View all ({stats.totalNotes})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-zinc-500 text-sm animate-pulse">
            Loading recent client calls...
          </div>
        ) : notes.length === 0 ? (
          /* Empty State */
          <div className="p-12 rounded-3xl card-base border-dashed text-center space-y-4 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-white/5 text-zinc-400 flex items-center justify-center mx-auto">
              <Mic className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-base text-zinc-200">No client calls recorded yet</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                Record your first client conversation or load the sample freelance redesign call to immediately explore tasks, commitments, and email generation.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                href="/record"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-xs hover:bg-emerald-400 transition-all cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Record a Client Call</span>
              </Link>
              <button
                onClick={async () => {
                  await fetch('/api/demo', { method: 'POST', body: JSON.stringify({ action: 'load' }) });
                  window.location.reload();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 border border-white/10 transition-all cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Load Freelance Demo Call</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
