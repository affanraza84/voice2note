'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SearchResult } from '@/types';
import { Search, Sparkles, Clock, ArrowRight, FileAudio, ShieldCheck, Loader2 } from 'lucide-react';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch (err) {
      console.error('Semantic search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatSeconds = (secs?: number) => {
    if (!secs || secs <= 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Sparkles className="w-6 h-6 text-emerald-400" />
          Semantic Knowledge Search
        </h1>
        <p className="text-sm text-zinc-400">
          Search across concepts, ideas, and spoken phrases — powered by local vector embeddings.
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="e.g. 'website deployment', 'pricing discussions', 'Sarah onboarding'..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-28 py-4 rounded-2xl glass-panel border border-white/10 text-base text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 shadow-2xl"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-emerald-500 text-black font-semibold text-xs hover:bg-emerald-400 transition-all cursor-pointer disabled:opacity-40"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </button>
      </form>

      {/* Local Vector Badge */}
      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Vector search computes cosine similarity on-device using MiniLM (384-d). No external queries.</span>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="p-12 text-center text-zinc-500 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Generating query embedding & searching vector index...</span>
        </div>
      ) : searched && results.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-panel border border-white/5 space-y-2">
          <p className="text-zinc-300 text-sm font-semibold">No relevant notes found for &quot;{query}&quot;</p>
          <p className="text-xs text-zinc-500">
            Vector similarity threshold was not met. Try searching with conceptual or related words.
          </p>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 uppercase tracking-wider font-semibold">
            <span>Semantic Matches ({results.length})</span>
            <span>Ranked by Concept Similarity</span>
          </div>

          <div className="space-y-3">
            {results.map((item) => (
              <Link
                key={item.noteId}
                href={`/notes/${item.noteId}`}
                className="block p-5 rounded-2xl glass-panel glass-card-hover border border-white/5 group space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base text-zinc-100 group-hover:text-emerald-400 transition-colors">
                    {item.noteTitle}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      {item.score}% match
                    </span>
                    <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                  </div>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed font-sans line-clamp-3 bg-black/20 p-2.5 rounded-xl border border-white/5">
                  &ldquo;{item.matchedText}&rdquo;
                </p>

                <div className="flex items-center gap-3 text-[11px] text-zinc-500 pt-1">
                  <div className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>Timestamp: {formatSeconds(item.startTime)}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <FileAudio className="w-3 h-3" />
                    <span>Open Note</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
