'use client';

import React from 'react';
import Link from 'next/link';
import { VoiceNote } from '@/types';
import { Clock, Calendar, CheckCircle2, Loader2, AlertCircle, Play } from 'lucide-react';

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
          <span className="flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 animate-pulse">
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
      className="block glass-panel p-5 rounded-2xl glass-card-hover border border-white/5 relative group"
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <h3 className="font-semibold text-base text-zinc-100 group-hover:text-emerald-400 transition-colors line-clamp-1">
          {note.title}
        </h3>
        {getStatusBadge()}
      </div>

      {/* Preview snippet */}
      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-4 min-h-[32px]">
        {note.summaryPreview ||
          (note.status === 'ready'
            ? 'Note processed and ready to read.'
            : note.status === 'failed'
            ? note.errorMessage || 'Transcription encountered an issue.'
            : 'Audio is being processed locally by Whisper...')}
      </p>

      {/* Metadata footer */}
      <div className="flex items-center justify-between text-[11px] text-zinc-500 border-t border-white/5 pt-3">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-zinc-400" />
          <span>{formatDate(note.createdAt)}</span>
        </div>

        <div className="flex items-center gap-2">
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
