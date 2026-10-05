'use client';

import React, { useEffect, useState } from 'react';
import { LocalAIStatus } from '@/types';
import { ShieldCheck, Cpu, HardDrive, RefreshCw } from 'lucide-react';

export function LocalAIStatusBadge() {
  const [status, setStatus] = useState<LocalAIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const fetchStatus = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
      } else {
        setStatus({
          status: 'unavailable',
          label: 'Client-Only Mode',
          details: {
            speechModel: 'Xenova/whisper-tiny.en',
            speechEngine: 'Browser Whisper (ONNX)',
            ollamaOnline: false,
            activeJobs: 0,
          },
        });
      }
    } catch {
      setStatus({
        status: 'unavailable',
        label: 'Client-Only Mode',
        details: {
          speechModel: 'Xenova/whisper-tiny.en',
          speechEngine: 'Browser Whisper (ONNX)',
          ollamaOnline: false,
          activeJobs: 0,
        },
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  const getDotColor = () => {
    if (!status || loading) return 'bg-zinc-500';
    if (status.status === 'processing') return 'bg-amber-400 animate-ping';
    if (status.status === 'ready') return 'bg-emerald-400 shadow-[0_0_8px_#10b981]';
    if (status.status === 'starting') return 'bg-sky-400 animate-pulse';
    return 'bg-zinc-400';
  };

  const getDisplayLabel = () => {
    if (loading) return 'Checking AI...';
    if (!status) return 'Local AI Standby';
    return status.label;
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium glass-panel hover:bg-white/5 transition-all text-zinc-300 cursor-pointer"
      >
        <span className="relative flex h-2 w-2">
          <span className={`rounded-full h-2 w-2 ${getDotColor()}`}></span>
        </span>
        <span className="max-w-[200px] truncate">{getDisplayLabel()}</span>
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 ml-0.5 shrink-0" />
      </button>

      {showTooltip && (
        <div className="absolute right-0 mt-2 w-80 p-4 rounded-2xl glass-panel shadow-2xl z-50 text-xs text-zinc-200 border border-white/10 animate-in fade-in zoom-in-95 duration-150 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-400" />
              AI Runtime Architecture
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fetchStatus();
              }}
              className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-2 text-zinc-400">
            <div className="flex justify-between">
              <span>Speech Recognition:</span>
              <span className="font-medium text-zinc-200">Whisper ONNX</span>
            </div>
            <div className="flex justify-between">
              <span>Audio Processing:</span>
              <span className="text-emerald-400 font-medium">On-Device (16kHz PCM)</span>
            </div>
            <div className="flex justify-between">
              <span>LLM Synthesis:</span>
              <span className={status?.details?.ollamaOnline ? 'text-emerald-400' : 'text-amber-400'}>
                {status?.details?.ollamaOnline
                  ? `Active (${status?.details?.llmModel || 'Ollama'})`
                  : 'Standby / Local Ollama'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Active Jobs:</span>
              <span className="text-zinc-200 font-mono">{status?.details?.activeJobs || 0}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 text-[11px] text-zinc-400 space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-300">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Offline Persistence: IndexedDB Active</span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-normal">
              Recordings and transcripts are automatically preserved in browser storage.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
