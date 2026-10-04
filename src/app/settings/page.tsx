'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Cpu,
  User,
  HardDrive,
  ShieldCheck,
  Save,
  Check,
  RefreshCw,
} from 'lucide-react';
import { LocalAIStatus } from '@/types';

export default function SettingsPage() {
  const [persona, setPersona] = useState({
    name: 'Alex (Product Designer)',
    problem: 'Records 5-10 unstructured memos a day, losing commitments and ideas.',
    workflow: 'Captures quick audio on phone/laptop, needs instant action items.',
  });
  const [aiStatus, setAiStatus] = useState<LocalAIStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.persona) setPersona(data.persona);
      }
      const statusRes = await fetch('/api/status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setAiStatus(statusData.status);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(persona),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-150">
      {/* Page Title */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-emerald-400" />
          Settings & Local AI Configuration
        </h1>
        <p className="text-sm text-zinc-400">
          Configure model parameters, storage, and the primary friend persona.
        </p>
      </div>

      {/* Friend Persona Config */}
      <form onSubmit={handleSave} className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-400" />
            <h2 className="font-semibold text-base text-white">Target Friend Persona</h2>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Build for a Friend
          </span>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Configure the primary user persona. The structured intelligence extraction in Phase 3 tailors summaries and task prioritizations to this workflow.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">FRIEND_NAME</label>
            <input
              type="text"
              value={persona.name}
              onChange={(e) => setPersona({ ...persona, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">FRIEND_PROBLEM</label>
            <textarea
              rows={2}
              value={persona.problem}
              onChange={(e) => setPersona({ ...persona, problem: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">FRIEND_WORKFLOW</label>
            <textarea
              rows={2}
              value={persona.workflow}
              onChange={(e) => setPersona({ ...persona, workflow: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-xs shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all cursor-pointer disabled:opacity-50"
        >
          {saved ? <Check className="w-3.5 h-3.5 text-black" /> : <Save className="w-3.5 h-3.5" />}
          <span>{saved ? 'Saved!' : saving ? 'Saving...' : 'Save Persona'}</span>
        </button>
      </form>

      {/* Local AI Engine Status */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <h2 className="font-semibold text-base text-white">Local AI Diagnostics</h2>
          </div>
          <button
            onClick={fetchSettings}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-zinc-500">Speech-to-Text Model</span>
            <div className="font-mono text-zinc-200 font-semibold">whisper-tiny.en</div>
            <p className="text-[11px] text-zinc-400">In-process ONNX Runtime (Transformers.js)</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-zinc-500">LLM Inference (Ollama)</span>
            <div className="font-mono text-zinc-200 font-semibold">
              {aiStatus?.details?.llmModel || 'llama3.2:latest'}
            </div>
            <p className="text-[11px] text-zinc-400">
              {aiStatus?.details?.ollamaOnline ? 'Connected at localhost:11434' : 'Offline / Standby'}
            </p>
          </div>
        </div>
      </div>

      {/* Storage & Privacy Status */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-white/5">
          <HardDrive className="w-4 h-4 text-teal-400" />
          <h2 className="font-semibold text-base text-white">Storage & Security Policy</h2>
        </div>

        <div className="space-y-3 text-xs text-zinc-400">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              <strong className="text-zinc-200">Zero Cloud Egress:</strong> All audio files are saved in{' '}
              <code className="bg-white/10 px-1.5 py-0.5 rounded text-zinc-300">data/audio/</code> and database records are stored in{' '}
              <code className="bg-white/10 px-1.5 py-0.5 rounded text-zinc-300">data/voice2note.db</code>.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              <strong className="text-zinc-200">Secure Audio Streaming:</strong> Audio files are accessed via secure internal endpoints (<code className="bg-white/10 px-1.5 py-0.5 rounded text-zinc-300">/api/audio/[id]</code>) without exposing raw filesystem paths.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
