'use client';

import React, { useState } from 'react';
import { Transcript } from '@/types';
import { Copy, Check, Clock, Cpu, ShieldCheck } from 'lucide-react';

interface TranscriptViewProps {
  transcript: Transcript | null;
  onSeek?: (seconds: number) => void;
  currentTime?: number;
}

export function TranscriptView({ transcript, onSeek, currentTime = 0 }: TranscriptViewProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'paragraphs' | 'timestamps'>('paragraphs');

  if (!transcript) {
    return (
      <div className="p-8 rounded-2xl glass-panel text-center text-zinc-500">
        No transcript available yet.
      </div>
    );
  }

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(transcript.rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSegmentActive = (start: number, end: number) => {
    return currentTime >= start && currentTime <= end;
  };

  return (
    <div className="space-y-4">
      {/* Transcript Header & Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('paragraphs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'paragraphs'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Readable Text
          </button>
          <button
            onClick={() => setViewMode('timestamps')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'timestamps'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Timestamped Segments
          </button>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied!' : 'Copy Text'}</span>
        </button>
      </div>

      {/* Main Transcript Body */}
      <div className="p-6 rounded-2xl glass-panel border border-white/5 text-zinc-200 leading-relaxed text-sm">
        {viewMode === 'paragraphs' ? (
          <div className="whitespace-pre-wrap font-sans text-zinc-200 text-base leading-relaxed">
            {transcript.rawText}
          </div>
        ) : (
          <div className="space-y-3">
            {transcript.segments.map((seg, idx) => {
              const active = isSegmentActive(seg.start, seg.end);
              return (
                <div
                  key={seg.id || idx}
                  onClick={() => onSeek && onSeek(seg.start)}
                  className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                    active
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-white'
                      : 'hover:bg-white/5 text-zinc-300'
                  }`}
                >
                  <span className="font-mono text-xs text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatSeconds(seg.start)}
                  </span>
                  <p className="text-sm flex-1 leading-normal">{seg.text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Processing Information Bar */}
      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between flex-wrap gap-2 text-xs text-zinc-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            Speech model: <span className="text-zinc-200 font-mono">{transcript.modelUsed}</span>
          </span>
          <span className="text-zinc-600">•</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            Processing: Local
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 font-mono">
          Processed in {(transcript.processingTimeMs / 1000).toFixed(1)}s
        </div>
      </div>
    </div>
  );
}
