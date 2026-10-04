'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, FileAudio } from 'lucide-react';

interface RelatedNotesProps {
  noteId: string;
}

export function RelatedNotes({ noteId }: RelatedNotesProps) {
  const [related, setRelated] = useState<Array<{ noteId: string; noteTitle: string; score: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRelated = async () => {
      try {
        const res = await fetch(`/api/notes/${noteId}/related`);
        if (res.ok) {
          const data = await res.json();
          setRelated(data.related || []);
        }
      } catch (err) {
        console.error('Failed to fetch related notes:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRelated();
  }, [noteId]);

  if (loading || related.length === 0) return null;

  return (
    <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Related Voice Notes
        </span>
        <span className="text-[10px] text-zinc-500 font-mono">Vector Cosine Match</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {related.map((item) => (
          <Link
            key={item.noteId}
            href={`/notes/${item.noteId}`}
            className="p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/5 hover:border-white/15 transition-all space-y-1.5 block group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200 group-hover:text-emerald-400 transition-colors line-clamp-1">
                {item.noteTitle}
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {Math.round(item.score * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-zinc-500">
              <FileAudio className="w-3 h-3" />
              <span>Open Note</span>
              <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
