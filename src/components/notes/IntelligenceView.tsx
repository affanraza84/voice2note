'use client';

import React, { useState } from 'react';
import { Extraction, TaskItem } from '@/types';
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
} from 'lucide-react';

interface IntelligenceViewProps {
  extraction: Extraction | null;
  noteId: string;
  onTaskToggle?: (taskId: string, completed: boolean) => void;
}

export function IntelligenceView({ extraction, noteId, onTaskToggle }: IntelligenceViewProps) {
  const [tasks, setTasks] = useState<TaskItem[]>(extraction?.tasks || []);
  const [showEvidenceFor, setShowEvidenceFor] = useState<Record<string, boolean>>({});
  const [copiedChecklist, setCopiedChecklist] = useState(false);

  if (!extraction) {
    return (
      <div className="p-8 rounded-2xl glass-panel text-center text-zinc-500 space-y-2">
        <Sparkles className="w-6 h-6 mx-auto text-zinc-600" />
        <p className="text-sm">Structured intelligence has not been extracted yet.</p>
        <p className="text-xs text-zinc-600">Local Llama 3.2 will extract tasks, ideas, and decisions during background analysis.</p>
      </div>
    );
  }

  const copyChecklist = () => {
    if (tasks.length === 0) return;
    const lines = [
      `### Action Items: ${extraction.title}`,
      ...tasks.map(
        (t) => `- [${t.completed ? 'x' : ' '}] ${t.title}${t.dueDate ? ` (Due: ${t.dueDate})` : ''}`
      ),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedChecklist(true);
    setTimeout(() => setCopiedChecklist(false), 2000);
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

  const toggleEvidence = (id: string) => {
    setShowEvidenceFor((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Executive Summary Card */}
      <div className="p-5 sm:p-6 rounded-2xl glass-panel border border-white/5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Executive Summary
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">Factual & Concise</span>
        </div>
        <p className="text-sm text-zinc-200 leading-relaxed font-sans">{extraction.summary}</p>
      </div>

      {/* Grid: Tasks & Decisions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Action Items / Tasks */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-amber-400" />
              Action Items ({tasks.filter((t) => !t.completed).length} pending)
            </span>
            {tasks.length > 0 && (
              <button
                onClick={copyChecklist}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[11px] font-medium transition-all cursor-pointer border border-white/5"
                title="Copy all tasks as Markdown checklist"
              >
                {copiedChecklist ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-zinc-400" />
                    <span>Copy Checklist</span>
                  </>
                )}
              </button>
            )}
          </div>

          {tasks.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">No explicit tasks detected in this recording.</p>
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
                  <div className="flex items-start gap-2.5">
                    <button
                      onClick={() => toggleTask(task.id, task.completed)}
                      className="mt-0.5 text-zinc-400 hover:text-emerald-400 cursor-pointer"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>

                    <div className="flex-1 space-y-1">
                      <span className={`text-xs font-medium text-zinc-100 ${task.completed ? 'line-through text-zinc-500' : ''}`}>
                        {task.title}
                      </span>

                      <div className="flex items-center gap-2 flex-wrap text-[10px]">
                        {task.dueDate && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                            Due: {task.dueDate}
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
                            {showEvidenceFor[task.id] ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ideas & Brainstorming */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-teal-400" />
              Ideas & Brainstorming ({extraction.ideas.length})
            </span>
          </div>

          {extraction.ideas.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">No specific ideas or concepts brainstormed.</p>
          ) : (
            <div className="space-y-2.5">
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

      {/* Grid: Decisions & Dates */}
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

        {/* Important Dates & Deadlines */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-purple-400" />
            Important Dates ({extraction.importantDates.length})
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
      </div>

      {/* People & Topics Tags */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
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

      {/* AI Transparency Banner */}
      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Generated locally using <strong className="text-zinc-200 font-mono">{extraction.modelUsed || 'Llama 3.2'}</strong>
        </span>
        <span className="text-[11px] text-zinc-500">100% On-Device Reasoning</span>
      </div>
    </div>
  );
}
