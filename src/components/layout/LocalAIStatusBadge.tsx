'use client';

import React, { useEffect, useState } from 'react';
import { LocalAIStatus } from '@/types';
import { ShieldCheck, Cpu, HardDrive } from 'lucide-react';

export function LocalAIStatusBadge() {
  const [status, setStatus] = useState<LocalAIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const getDotColor = () => {
    if (!status) return 'bg-zinc-500';
    if (status.status === 'processing') return 'bg-amber-400 animate-ping';
    if (status.status === 'ready') return 'bg-emerald-400 shadow-[0_0_8px_#10b981]';
    return 'bg-zinc-400';
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium glass-panel hover:bg-white/5 transition-all text-zinc-300"
      >
        <span className="relative flex h-2 w-2">
          <span className={`rounded-full h-2 w-2 ${getDotColor()}`}></span>
        </span>
        <span>{status?.label || (loading ? 'Checking Local AI...' : 'Local AI')}</span>
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />
      </button>

      {showTooltip && (
        <div className="absolute right-0 mt-2 w-72 p-3.5 rounded-xl glass-panel shadow-2xl z-50 text-xs text-zinc-200 border border-white/10 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-400" />
              Local AI Engine
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              100% On-Device
            </span>
          </div>

          <div className="space-y-2 text-zinc-400">
            <div className="flex justify-between">
              <span>Speech Model:</span>
              <span className="font-mono text-zinc-200">whisper-tiny.en</span>
            </div>
            <div className="flex justify-between">
              <span>Speech Engine:</span>
              <span className="text-zinc-200">ONNX / Local</span>
            </div>
            <div className="flex justify-between">
              <span>Ollama (LLM):</span>
              <span className={status?.details?.ollamaOnline ? 'text-emerald-400' : 'text-amber-400'}>
                {status?.details?.ollamaOnline ? 'Online (Llama 3.2)' : 'Standby / Local'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Active Tasks:</span>
              <span className="text-zinc-200 font-mono">{status?.details?.activeJobs || 0}</span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-white/10 text-[11px] text-zinc-500 flex items-center gap-1">
            <HardDrive className="w-3 h-3 text-zinc-400" />
            Audio & transcripts remain on local disk.
          </div>
        </div>
      )}
    </div>
  );
}
