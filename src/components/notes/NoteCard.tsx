'use client';

import React from 'react';
import Link from 'next/link';
import { VoiceNote } from '@/types';
import { Clock, Calendar, CheckCircle2, Loader2, AlertCircle, Play, CheckSquare, Tag } from 'lucide-react';

interface NoteCardProps {
  note: VoiceNote;
}

export function NoteCard({ note }: NoteCardProps) {
  const formatDuration = (secs: number) => {
    if (!secs || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getStatusBadge = () => {
    switch (note.status) {
      case 'ready':
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Ready
          </span>
        );
      case 'transcribing':
      case 'processing':
      case 'uploading':
      case 'analyzing':
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            <Loader2 className="w-3 h-3 animate-spin" />
            {note.status.charAt(0).toUpperCase() + note.status.slice(1)}
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
            <AlertCircle className="w-3 h-3" />
            Failed
          </span>
        );
    }
  };

  return (
    <Link
      href={`/notes/${note.id}`}
      className="block card-base p-5 rounded-2xl hover:border-white/20 transition-all relative group"
    >
      {/* Title & Status Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-base text-zinc-100 group-hover:text-emerald-400 transition-colors line-clamp-1">
          {note.title}
        </h3>
        {getStatusBadge()}
      </div>

      {/* Summary preview */}
      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-3 min-h-[32px]">
        {note.summaryPreview ||
          (note.status === 'ready'
            ? 'Note processed and ready to read.'
            : note.status === 'failed'
            ? note.errorMessage || 'Transcription encountered an issue.'
            : 'Audio is being processed locally by Whisper...')}
      </p>

      {/* Task Count & Topic Tags (Requirement #3) */}
      <div className="flex items-center gap-2 flex-wrap mb-3.5">
        {note.taskCount !== undefined && note.taskCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <CheckSquare className="w-3 h-3" />
            {note.taskCount} {note.taskCount === 1 ? 'task' : 'tasks'}
          </span>
        )}

        {note.topicTags && note.topicTags.slice(0, 2).map((tag, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-0.5 text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/5 text-zinc-300 border border-white/10"
          >
            <Tag className="w-2.5 h-2.5 text-zinc-500" />
            {tag}
          </span>
        ))}
      </div>

      {/* Footer: Date, Duration, and Play Action */}
      <div className="flex items-center justify-between text-[11px] text-zinc-500 border-t border-white/5 pt-3">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-zinc-500" />
          <span>{formatDate(note.createdAt)}</span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 font-mono text-zinc-400">
            <Clock className="w-3 h-3" />
            <span>{formatDuration(note.durationSeconds)}</span>
          </div>

          <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 group-hover:bg-emerald-500 group-hover:text-black transition-colors">
            <Play className="w-3 h-3 fill-current ml-0.5" />
          </div>
        </div>
      </div>
    </Link>
  );
}
