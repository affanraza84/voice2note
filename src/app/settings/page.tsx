'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings,
  Cpu,
  User,
  HardDrive,
  ShieldCheck,
  Save,
  Check,
  RefreshCw,
  Sparkles,
  Database,
  Trash2,
  ExternalLink,
  AlertCircle,
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
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);

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

  const handleLoadDemo = async () => {
    setDemoLoading(true);
    setDemoMessage(null);
    try {
      const res = await fetch('/api/demo', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setDemoMessage(`Loaded ${data.notesCreated} realistic demo notes successfully!`);
        window.dispatchEvent(new CustomEvent('demo-dataset-changed'));
      } else {
        setDemoMessage(data.error || 'Failed to load demo data');
      }
    } catch (err: any) {
      setDemoMessage(err.message || 'Network error');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleClearDemo = async () => {
    setDemoLoading(true);
    setDemoMessage(null);
    try {
      const res = await fetch('/api/demo', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setDemoMessage(`Cleared ${data.deletedCount} demo notes.`);
        window.dispatchEvent(new CustomEvent('demo-dataset-changed'));
      } else {
        setDemoMessage(data.error || 'Failed to clear demo data');
      }
    } catch (err: any) {
      setDemoMessage(err.message || 'Network error');
    } finally {
      setDemoLoading(false);
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
          Configure model parameters, demo dataset, storage, and the primary friend persona.
        </p>
      </div>

      {/* Demo Mode Management */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold text-base text-white">Interactive Demo Dataset</h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Demo Mode Available
          </span>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Instantly populate Voice2Note with a realistic 6-note dataset (engineering syncs, product pricing, marathon training, home renovation) containing pre-indexed vector embeddings and extracted tasks to test search and grounded RAG immediately.
        </p>

        {demoMessage && (
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-emerald-300">
            {demoMessage}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={handleLoadDemo}
            disabled={demoLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{demoLoading ? 'Processing...' : 'Load 6 Demo Notes'}</span>
          </button>
          <button
            onClick={handleClearDemo}
            disabled={demoLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Demo Data Only</span>
          </button>
        </div>
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
          Configure the primary user persona. The structured intelligence extraction tailors summaries and task prioritizations to this workflow.
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

      {/* Model Transparency & Technical Stack */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h2 className="font-semibold text-base text-white">Technical Model Transparency</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchSettings}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Refresh Local AI Status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <Link
              href="/privacy"
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
            >
              <span>Privacy Center</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-zinc-500">Speech Model</span>
            <div className="font-mono text-zinc-200 font-semibold">whisper-tiny.en</div>
            <p className="text-[11px] text-zinc-400">License: MIT License</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-zinc-500">Language Model (LLM)</span>
            <div className="font-mono text-zinc-200 font-semibold">Llama 3.2 (3B)</div>
            <p className="text-[11px] text-zinc-400">License: Meta Llama Community License</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-zinc-500">Embedding Model</span>
            <div className="font-mono text-zinc-200 font-semibold">all-MiniLM-L6-v2 (384-d)</div>
            <p className="text-[11px] text-zinc-400">License: Apache 2.0</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-zinc-500">Inference Runtime & Vector Store</span>
            <div className="font-mono text-zinc-200 font-semibold">ONNX Node + Ollama + SQLite</div>
            <p className="text-[11px] text-zinc-400">In-process float32 cosine similarity</p>
          </div>
        </div>

        {!aiStatus?.details?.ollamaOnline && (
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 text-xs text-amber-300 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Local AI Service Offline</span>
            </div>
            <p className="text-zinc-300 leading-relaxed">
              Ollama could not be contacted at <code className="bg-black/40 px-1 py-0.5 rounded">http://127.0.0.1:11434</code>. To enable intelligence extraction and RAG queries, run:
            </p>
            <pre className="p-2.5 rounded-xl bg-black/60 font-mono text-[11px] text-emerald-400 overflow-x-auto">
              ollama run llama3.2
            </pre>
          </div>
        )}
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
              <strong className="text-zinc-200">Strict Path & Magic-Byte Validation:</strong> Uploaded audio files reject traversal attempts (`..`, `/`) and verify non-executable magic headers before disk writes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
