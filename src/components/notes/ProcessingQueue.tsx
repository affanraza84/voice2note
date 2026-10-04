'use client';

import React from 'react';
import Link from 'next/link';
import { VoiceNote } from '@/types';
import { Loader2, Radio } from 'lucide-react';

interface ProcessingQueueProps {
  notes: VoiceNote[];
}

export function ProcessingQueue({ notes }: ProcessingQueueProps) {
  const processingNotes = notes.filter((n) =>
    ['uploading', 'processing', 'transcribing', 'analyzing'].includes(n.status)
  );

  if (processingNotes.length === 0) return null;

  return (
    <div className="glass-panel p-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          <span>Processing Locally in Background ({processingNotes.length})</span>
        </div>
        <span className="text-[11px] text-zinc-500">Whisper Local Engine</span>
      </div>

      <div className="space-y-2">
        {processingNotes.map((note) => (
          <Link
            key={note.id}
            href={`/notes/${note.id}`}
            className="flex items-center justify-between p-3 rounded-xl bg-black/40 hover:bg-black/60 border border-white/5 transition-all text-xs"
          >
            <div className="flex items-center gap-2.5">
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="font-medium text-zinc-200">{note.title}</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {note.status}...
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
