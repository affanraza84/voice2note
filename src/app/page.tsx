'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { VoiceNote } from '@/types';
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
  Sparkles,
  Database,
} from 'lucide-react';

export default function DashboardPage() {
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [stats, setStats] = useState({
    totalNotes: 0,
    totalDurationSeconds: 0,
    processingCount: 0,
    readyCount: 0,
    failedCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/notes?limit=12');
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatTotalTime = (secs: number) => {
    if (!secs || secs <= 0) return '0 min';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ${Math.floor(secs % 60)}s`;
    const hrs = (mins / 60).toFixed(1);
    return `${hrs} hrs`;
  };

  // Calculate total pending tasks across visible notes
  const totalTasks = notes.reduce((sum, n) => sum + (n.taskCount || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Redesigned Hero Section (Requirement #2) */}
      <div className="card-base p-8 sm:p-10 rounded-3xl relative overflow-hidden">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>100% On-Device Privacy</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Your thoughts,<br />
            organized automatically.
          </h1>

          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-xl">
            Record anything. Voice2Note turns it into searchable knowledge, tasks, ideas, and decisions — without sending your audio or transcripts to external servers.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/record"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Mic className="w-4 h-4" />
              <span>Record a Note</span>
            </Link>

            <Link
              href="/ask"
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 font-semibold text-sm transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>Ask My Notes</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl card-base space-y-1">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <FileAudio className="w-3.5 h-3.5 text-emerald-400" />
            Total Voice Notes
          </span>
          <div className="text-2xl font-bold font-mono text-zinc-100">{stats.totalNotes}</div>
        </div>

        <div className="p-5 rounded-2xl card-base space-y-1">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            Audio Recorded
          </span>
          <div className="text-2xl font-bold font-mono text-zinc-100">{formatTotalTime(stats.totalDurationSeconds)}</div>
        </div>

        <div className="p-5 rounded-2xl card-base space-y-1">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
            Actionable Tasks
          </span>
          <div className="text-2xl font-bold font-mono text-zinc-100">{totalTasks}</div>
        </div>

        <div className="p-5 rounded-2xl card-base space-y-1">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            AI Intelligence
          </span>
          <div className="text-base font-semibold text-zinc-200 mt-1">Llama 3.2 + Whisper</div>
        </div>
      </div>

      {/* Active Processing Queue */}
      <ProcessingQueue notes={notes} />

      {/* Recent Notes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Recent Voice Notes</h2>
            <p className="text-xs text-zinc-400">Transcribed and indexed on-device</p>
          </div>

          {notes.length > 0 && (
            <Link
              href="/notes"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              <span>View all ({stats.totalNotes})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-zinc-500 text-sm">Loading recent notes...</div>
        ) : notes.length === 0 ? (
          /* Human-readable Empty State (Requirement #11) */
          <div className="p-12 rounded-3xl card-base border-dashed text-center space-y-4 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-white/5 text-zinc-400 flex items-center justify-center mx-auto">
              <Mic className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-base text-zinc-200">No voice notes yet</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                Record your first thought and let Voice2Note turn it into something useful. Or load the sample demo dataset to explore immediately.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                href="/record"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-xs hover:bg-emerald-400 transition-all cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Record a Note</span>
              </Link>
              <button
                onClick={async () => {
                  await fetch('/api/demo', { method: 'POST', body: JSON.stringify({ action: 'load' }) });
                  window.location.reload();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 border border-white/10 transition-all cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Load Demo Data</span>
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
      </div>
    </div>
  );
}
