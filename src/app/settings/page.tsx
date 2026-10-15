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
  Cloud,
  Lock,
  WifiOff,
  Radio,
  Info,
} from 'lucide-react';
import {
  LocalAIStatus,
  ProcessingMode,
  ModeDisclosure,
  ModeValidationResult,
} from '@/types';

export default function SettingsPage() {
  const [persona, setPersona] = useState({
    name: 'Alex (Product Designer)',
    problem: 'Records 5-10 unstructured memos a day, losing commitments and ideas.',
    workflow: 'Captures quick audio on phone/laptop, needs instant action items.',
  });
  const [aiStatus, setAiStatus] = useState<LocalAIStatus | null>(null);
  const [mode, setMode] = useState<ProcessingMode>('local-private');
  const [optIn, setOptIn] = useState<boolean>(false);
  const [disclosure, setDisclosure] = useState<ModeDisclosure | null>(null);
  const [validation, setValidation] = useState<ModeValidationResult | null>(null);
  const [modeError, setModeError] = useState<string | null>(null);

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
        if (data.mode) setMode(data.mode);
        if (data.cloudAssistedOptIn !== undefined) setOptIn(Boolean(data.cloudAssistedOptIn));
        if (data.disclosure) setDisclosure(data.disclosure);
        if (data.validation) setValidation(data.validation);
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
    setModeError(null);

    if (mode === 'cloud-assisted' && !optIn) {
      setModeError('Explicit opt-in is required before activating Cloud-Assisted mode.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...persona,
          mode,
          cloudAssistedOptIn: optIn,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaved(true);
        if (data.disclosure) setDisclosure(data.disclosure);
        if (data.validation) setValidation(data.validation);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setModeError(data.error || 'Failed to save settings.');
      }
    } catch (err: any) {
      console.error('Save failed:', err);
      setModeError(err?.message || 'Failed to save settings.');
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
          Settings & Processing Architecture
        </h1>
        <p className="text-sm text-zinc-400">
          Configure processing modes (local-private vs cloud-assisted), persona parameters, and demo data.
        </p>
      </div>

      {/* Processing Mode Selection & Disclosure */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <h2 className="font-semibold text-base text-white">Processing Mode & Privacy Enclosure</h2>
          </div>
          <span
            className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${
              mode === 'local-private'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            {mode === 'local-private' ? 'Local-Private Active' : 'Cloud-Assisted Mode'}
          </span>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Voice2Note enforces an explicit processing boundary. Choose whether inference runs strictly on-device with zero egress or with opted-in cloud assistance.
        </p>

        {/* Mode Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => setMode('local-private')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all space-y-3 ${
              mode === 'local-private'
                ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                : 'bg-white/[0.02] border-white/5 hover:border-white/15'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-sm text-zinc-100">Local-Private Mode</span>
              </div>
              <Radio className={`w-4 h-4 ${mode === 'local-private' ? 'text-emerald-400' : 'text-zinc-600'}`} />
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              <strong>Fail-Closed Guarantee:</strong> Enforces local Whisper, local Ollama, local MiniLM, and local disk storage. Never transmits audio or prompts to external APIs.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
              <Check className="w-3.5 h-3.5" />
              <span>Zero Cloud Egress</span>
            </div>
          </div>

          <div
            onClick={() => setMode('cloud-assisted')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all space-y-3 ${
              mode === 'cloud-assisted'
                ? 'bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-500/5'
                : 'bg-white/[0.02] border-white/5 hover:border-white/15'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-sm text-zinc-100">Cloud-Assisted Mode</span>
              </div>
              <Radio className={`w-4 h-4 ${mode === 'cloud-assisted' ? 'text-amber-400' : 'text-zinc-600'}`} />
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              <strong>Hybrid Performance:</strong> Uses external APIs (Groq, OpenAI, Vercel Blob) for ultra-fast serverless transcription and reasoning. Requires explicit opt-in.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-mono">
              <Info className="w-3.5 h-3.5" />
              <span>Requires Explicit Consent</span>
            </div>
          </div>
        </div>

        {/* Opt-In Checkbox for Cloud-Assisted Mode */}
        {mode === 'cloud-assisted' && (
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 space-y-3 animate-in fade-in">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="cloud-opt-in-checkbox"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-amber-500/50 text-amber-500 focus:ring-amber-500/20 cursor-pointer"
              />
              <label htmlFor="cloud-opt-in-checkbox" className="text-xs text-amber-200 leading-relaxed cursor-pointer select-none">
                <strong>Explicit Opt-In Required:</strong> I explicitly acknowledge and consent that my voice audio, generated transcripts, and intelligence prompts will be transmitted to external cloud providers (Groq, OpenAI, and/or Vercel Blob) for processing.
              </label>
            </div>
            {!optIn && (
              <p className="text-[11px] text-amber-400 pl-7">
                ⚠️ You must check this box to activate Cloud-Assisted mode. Without consent, system fails closed to Local-Private mode.
              </p>
            )}
          </div>
        )}

        {modeError && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{modeError}</span>
          </div>
        )}

        {/* Data Flow Transparency Matrix */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Data Destination Transparency Matrix ({mode === 'local-private' ? 'Local-Private' : 'Cloud-Assisted'})
          </h3>

          <div className="rounded-2xl border border-white/5 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-zinc-400 border-b border-white/5">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Data Category</th>
                  <th className="py-2.5 px-4 font-semibold">Destination</th>
                  <th className="py-2.5 px-4 font-semibold">Boundary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {disclosure?.destinations.map((dest, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.01]">
                    <td className="py-2.5 px-4 font-medium text-zinc-200">{dest.label}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-300">{dest.destination}</td>
                    <td className="py-2.5 px-4">
                      {dest.isExternal ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          External Cloud
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Local Machine
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Model Downloads Disclosure & Offline Verification Warning */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-200 font-semibold">
            <WifiOff className="w-4 h-4 text-teal-400" />
            <span>Initial Model Downloads & Offline Notice</span>
          </div>

          <p className="text-zinc-400 text-xs leading-relaxed">
            {disclosure?.offlineVerificationNote}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {disclosure?.modelDownloads.map((m, idx) => (
              <div key={idx} className="p-3 rounded-xl card-raised space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block">{m.name}</span>
                <span className="text-xs font-mono font-bold text-zinc-200 block">{m.component}</span>
                <span className="text-[10px] text-teal-400 font-mono block">Size: {m.sizeEstimate}</span>
              </div>
            ))}
          </div>
        </div>
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
          Instantly populate Voice2Note with a realistic 6-note dataset containing pre-indexed vector embeddings and extracted tasks to test search and grounded RAG immediately.
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
          <span>{saved ? 'Saved Settings & Mode!' : saving ? 'Saving...' : 'Save All Settings'}</span>
        </button>
      </form>

      {/* Model Transparency & Technical Stack */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h2 className="font-semibold text-base text-white">Active Provider Status</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchSettings}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Refresh AI Status"
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
            <span className="text-zinc-500">Speech Provider</span>
            <div className="font-mono text-zinc-200 font-semibold">{validation?.activeProviders.speech || 'Local Whisper'}</div>
            <p className="text-[11px] text-zinc-400">Runtime: ONNX Runtime (Transformers.js)</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-zinc-500">Language Model (LLM)</span>
            <div className="font-mono text-zinc-200 font-semibold">{validation?.activeProviders.llm || 'Local Ollama'}</div>
            <p className="text-[11px] text-zinc-400">Endpoint: localhost:11434</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-zinc-500">Embedding Engine</span>
            <div className="font-mono text-zinc-200 font-semibold">{validation?.activeProviders.embeddings || 'Local MiniLM'}</div>
            <p className="text-[11px] text-zinc-400">all-MiniLM-L6-v2 (384 dimensions)</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-zinc-500">Audio Storage Provider</span>
            <div className="font-mono text-zinc-200 font-semibold">{validation?.activeProviders.storage || 'Local Storage'}</div>
            <p className="text-[11px] text-zinc-400">Filesystem: ./data/audio/</p>
          </div>
        </div>

        {mode === 'local-private' && !aiStatus?.details?.ollamaOnline && (
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 text-xs text-amber-300 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Local Ollama Offline (Fail-Closed Active)</span>
            </div>
            <p className="text-zinc-300 leading-relaxed">
              Ollama could not be contacted at <code className="bg-black/40 px-1 py-0.5 rounded">http://127.0.0.1:11434</code>. In Local-Private mode, remote fallback is forbidden. Run:
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
              <strong className="text-zinc-200">Local-Private Invariant:</strong> In Local-Private mode, audio is saved exclusively in{' '}
              <code className="bg-white/10 px-1.5 py-0.5 rounded text-zinc-300">data/audio/</code> and metadata in{' '}
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
