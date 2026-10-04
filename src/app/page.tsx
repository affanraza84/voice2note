'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { VoiceNote } from '@/types';
import { NoteCard } from '@/components/notes/NoteCard';
import { ProcessingQueue } from '@/components/notes/ProcessingQueue';
import { Mic, UploadCloud, Clock, FileAudio, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

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
    // Poll every 3 seconds to catch ongoing transcription status updates
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

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Hero Quick Record CTA */}
      <div className="relative rounded-3xl overflow-hidden glass-panel border border-white/10 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-2xl relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>100% Local Voice Intelligence</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Turn messy voice recordings into <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">searchable personal knowledge</span>.
          </h1>

          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
            Record spontaneous thoughts or upload audio memos. Whisper transcribes them on-device, extracting key tasks, ideas, and decisions without sending your voice to external servers.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <Link
              href="/record"
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-semibold text-sm shadow-xl shadow-emerald-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>Record a Voice Note</span>
            </Link>

            <Link
              href="/record?tab=upload"
              className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 font-medium text-sm transition-all cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-zinc-400" />
              <span>Upload Audio</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-1">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <FileAudio className="w-3.5 h-3.5 text-emerald-400" />
            Total Voice Notes
          </span>
          <div className="text-2xl font-bold font-mono text-zinc-100">{stats.totalNotes}</div>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-1">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            Audio Recorded
          </span>
          <div className="text-2xl font-bold font-mono text-zinc-100">{formatTotalTime(stats.totalDurationSeconds)}</div>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-1">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            Transcribed Ready
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-400">{stats.readyCount}</div>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-1">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            Privacy Mode
          </span>
          <div className="text-lg font-bold text-zinc-200">Zero Cloud Egress</div>
        </div>
      </div>

      {/* Active Processing Queue Banner */}
      <ProcessingQueue notes={notes} />

      {/* Recent Notes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Recent Voice Notes</h2>
            <p className="text-xs text-zinc-400">Audio recordings processed by local speech recognition</p>
          </div>

          {notes.length > 0 && (
            <Link
              href="/notes"
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              <span>View all ({stats.totalNotes})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-zinc-500">Loading recent voice notes...</div>
        ) : notes.length === 0 ? (
          <div className="p-12 rounded-3xl glass-panel border border-dashed border-white/10 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-white/5 text-zinc-400 flex items-center justify-center mx-auto">
              <Mic className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-base text-zinc-200">No voice notes recorded yet</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Record your first voice note or upload an audio file to see local speech recognition in action.
              </p>
            </div>
            <Link
              href="/record"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-xs shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Record First Note</span>
            </Link>
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
