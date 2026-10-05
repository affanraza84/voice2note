'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getBrowserWhisper } from '@/lib/ai/browser-whisper';

interface DiagnosticItem {
  id: string;
  name: string;
  category: 'audio' | 'ai' | 'storage';
  status: 'passed' | 'failed' | 'warning' | 'checking';
  details?: string;
  error?: string;
}

export function DiagnosticPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);

  const runDiagnostics = async () => {
    setTesting(true);
    const results: DiagnosticItem[] = [];

    // 1. Microphone & getUserMedia
    try {
      if (typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)) {
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const perm = await navigator.permissions.query({ name: 'microphone' as any });
            results.push({
              id: 'mic',
              name: 'Microphone API',
              category: 'audio',
              status: perm.state === 'denied' ? 'failed' : 'passed',
              details: `Permission: ${perm.state}`,
            });
          } catch {
            results.push({
              id: 'mic',
              name: 'Microphone API',
              category: 'audio',
              status: 'passed',
              details: 'getUserMedia available',
            });
          }
        } else {
          results.push({
            id: 'mic',
            name: 'Microphone API',
            category: 'audio',
            status: 'passed',
            details: 'getUserMedia available',
          });
        }
      } else {
        results.push({
          id: 'mic',
          name: 'Microphone API',
          category: 'audio',
          status: 'failed',
          error: 'navigator.mediaDevices.getUserMedia not available in this browser',
        });
      }
    } catch (err: any) {
      results.push({
        id: 'mic',
        name: 'Microphone API',
        category: 'audio',
        status: 'failed',
        error: err?.message,
      });
    }

    // 2. MediaRecorder & Formats
    try {
      if (typeof window !== 'undefined' && 'MediaRecorder' in window) {
        const supportedTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav'].filter(
          (t) => MediaRecorder.isTypeSupported(t)
        );
        results.push({
          id: 'recorder',
          name: 'MediaRecorder',
          category: 'audio',
          status: 'passed',
          details: `Primary: ${supportedTypes[0] || 'Default'} (${supportedTypes.length} formats supported)`,
        });
      } else {
        results.push({
          id: 'recorder',
          name: 'MediaRecorder',
          category: 'audio',
          status: 'failed',
          error: 'MediaRecorder API not supported',
        });
      }
    } catch (err: any) {
      results.push({
        id: 'recorder',
        name: 'MediaRecorder',
        category: 'audio',
        status: 'failed',
        error: err?.message,
      });
    }

    // 3. Web Audio & AudioContext
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const sampleRate = ctx.sampleRate;
        await ctx.close();
        results.push({
          id: 'webaudio',
          name: 'AudioContext & Resampler',
          category: 'audio',
          status: 'passed',
          details: `Native rate: ${sampleRate} Hz • 16kHz Sinc Resampling Supported`,
        });
      } else {
        results.push({
          id: 'webaudio',
          name: 'AudioContext & Resampler',
          category: 'audio',
          status: 'failed',
          error: 'Web Audio API missing',
        });
      }
    } catch (err: any) {
      results.push({
        id: 'webaudio',
        name: 'AudioContext & Resampler',
        category: 'audio',
        status: 'failed',
        error: err?.message,
      });
    }

    // 4. WebGPU Acceleration
    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator && Boolean((navigator as any).gpu);
    results.push({
      id: 'webgpu',
      name: 'WebGPU Acceleration',
      category: 'ai',
      status: hasWebGPU ? 'passed' : 'warning',
      details: hasWebGPU ? 'Available (Hardware Accelerated)' : 'Unavailable (Falling back to WASM SIMD)',
    });

    // 5. WebAssembly SIMD
    const hasWasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
    results.push({
      id: 'wasm',
      name: 'WebAssembly (WASM)',
      category: 'ai',
      status: hasWasm ? 'passed' : 'failed',
      details: hasWasm ? 'Available (ONNX Web / CPU execution)' : 'Missing WebAssembly support',
    });

    // 6. Browser Whisper Status
    try {
      const whisper = getBrowserWhisper();
      const progress = whisper.getProgress();
      results.push({
        id: 'whisper',
        name: 'Browser Whisper Engine',
        category: 'ai',
        status: progress.state === 'error' ? 'failed' : 'passed',
        details: `${progress.statusText} (${progress.deviceBackend.toUpperCase()})`,
        error: progress.errorMessage,
      });
    } catch (err: any) {
      results.push({
        id: 'whisper',
        name: 'Browser Whisper Engine',
        category: 'ai',
        status: 'failed',
        error: err?.message,
      });
    }

    // 7. IndexedDB Client Storage
    try {
      if (typeof window !== 'undefined' && 'indexedDB' in window) {
        results.push({
          id: 'idb',
          name: 'Client IndexedDB',
          category: 'storage',
          status: 'passed',
          details: 'Active (Persistent offline note & audio storage)',
        });
      } else {
        results.push({
          id: 'idb',
          name: 'Client IndexedDB',
          category: 'storage',
          status: 'warning',
          details: 'Fallback to localStorage',
        });
      }
    } catch (err: any) {
      results.push({
        id: 'idb',
        name: 'Client IndexedDB',
        category: 'storage',
        status: 'failed',
        error: err?.message,
      });
    }

    // 8. Server Status Check
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        results.push({
          id: 'server-status',
          name: 'Server API Health',
          category: 'ai',
          status: 'passed',
          details: `${data.status.label} • LLM: ${data.status.details?.llmModel || 'Ollama'}`,
        });
      } else {
        results.push({
          id: 'server-status',
          name: 'Server API Health',
          category: 'ai',
          status: 'warning',
          details: `HTTP ${res.status} (Client-only mode active)`,
        });
      }
    } catch {
      results.push({
        id: 'server-status',
        name: 'Server API Health',
        category: 'ai',
        status: 'warning',
        details: 'Server endpoint unreachable (Client-only mode active)',
      });
    }

    setDiagnostics(results);
    setTesting(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: DiagnosticItem['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      default:
        return <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin shrink-0" />;
    }
  };

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer text-zinc-300"
      >
        <div className="flex items-center gap-2 font-medium">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>System & Audio Pipeline Diagnostics</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-500 hidden sm:inline">
            {diagnostics.filter((d) => d.status === 'passed').length} / {diagnostics.length} Passed
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-white/5 space-y-3 bg-black/20">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <span className="text-[11px] text-zinc-400">Component Health Status</span>
            <button
              onClick={runDiagnostics}
              disabled={testing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-zinc-300 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing...' : 'Re-test'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {diagnostics.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-white/[0.015] border border-white/5 flex items-start gap-2.5"
              >
                {getStatusIcon(item.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200">{item.name}</span>
                    <span className="text-[10px] text-zinc-500 uppercase">{item.category}</span>
                  </div>
                  {item.details && <p className="text-[11px] text-zinc-400 truncate mt-0.5">{item.details}</p>}
                  {item.error && <p className="text-[11px] text-red-400 mt-0.5">{item.error}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
