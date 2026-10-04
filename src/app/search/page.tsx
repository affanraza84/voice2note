'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { VoiceNote } from '@/types';
import { Search, Sparkles, Clock } from 'lucide-react';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setNotes([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/notes?limit=100');
      if (res.ok) {
        const data = await res.json();
        const matches = (data.notes || []).filter((n: VoiceNote) => {
          const titleMatch = n.title.toLowerCase().includes(q.toLowerCase());
          const textMatch = n.summaryPreview && n.summaryPreview.toLowerCase().includes(q.toLowerCase());
          return titleMatch || textMatch;
        });
        setNotes(matches);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Knowledge Search</h1>
        <p className="text-sm text-zinc-400">
          Search across all your spoken thoughts, ideas, and transcribed recordings.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Search for a topic, task, person, or phrase..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 rounded-2xl glass-panel border border-white/10 text-base text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 shadow-xl"
        />
      </div>

      {/* Phase 4 RAG Banner */}
      <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>Currently performing local full-text matching. Semantic vector embeddings arrive in Phase 4.</span>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="p-8 text-center text-zinc-500 text-sm">Searching your notes...</div>
      ) : query && notes.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-panel border border-white/5 space-y-2">
          <p className="text-zinc-300 text-sm">No voice notes matched &quot;{query}&quot;</p>
          <p className="text-xs text-zinc-500">Try searching with a broader keyword or phrase.</p>
        </div>
      ) : notes.length > 0 ? (
        <div className="space-y-3">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {notes.length} {notes.length === 1 ? 'Match' : 'Matches'} Found
          </span>
          <div className="space-y-2.5">
            {notes.map((note) => (
              <Link
                key={note.id}
                href={`/notes/${note.id}`}
                className="block p-4 rounded-2xl glass-panel glass-card-hover border border-white/5"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-semibold text-sm text-zinc-100">{note.title}</h3>
                  <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{Math.floor(note.durationSeconds)}s</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {note.summaryPreview || 'Note ready'}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
