'use client';

import React from 'react';
import {
  ShieldCheck,
  Cpu,
  WifiOff,
  CheckCircle2,
  Lock,
  Cloud,
  Download,
  AlertTriangle,
} from 'lucide-react';

export default function PrivacyCenterPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-150">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Local-Private vs Cloud-Assisted Architecture</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Privacy Architecture & Transparency Center
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl leading-relaxed">
          Voice2Note is engineered with verifiable privacy boundaries. Spoken audio recordings and personal reflections should never be harvested for third-party model training without explicit, conscious consent.
        </p>
      </div>

      {/* Two Operating Modes Explained */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-base p-6 rounded-3xl space-y-3 border-emerald-500/20 bg-emerald-950/[0.08]">
          <div className="flex items-center gap-2.5 text-emerald-400">
            <Lock className="w-5 h-5" />
            <h2 className="font-bold text-base text-white">1. Local-Private Mode (Default)</h2>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Strict fail-closed architecture. All audio files, transcripts, vector embeddings, and LLM reasoning prompts remain on your physical device. If a local service (like Ollama) is not running, the system fails closed rather than leaking data to remote endpoints.
          </p>
          <ul className="text-xs text-zinc-400 space-y-1.5 pt-1">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Speech: On-Device Whisper ONNX (0 bytes uploaded)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Reasoning: Local Ollama on localhost:11434</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Storage: Local filesystem (./data/audio/)</span>
            </li>
          </ul>
        </div>

        <div className="card-base p-6 rounded-3xl space-y-3 border-amber-500/20 bg-amber-950/[0.08]">
          <div className="flex items-center gap-2.5 text-amber-400">
            <Cloud className="w-5 h-5" />
            <h2 className="font-bold text-base text-white">2. Cloud-Assisted Mode (Opt-In Only)</h2>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Designed for low-resource serverless deployments (such as Vercel) where local weights cannot run. Requires explicit user opt-in before any external cloud inference or object storage is contacted.
          </p>
          <ul className="text-xs text-zinc-400 space-y-1.5 pt-1">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Speech: Groq / OpenAI Whisper API</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Reasoning: OpenAI-compatible LLM endpoint</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Storage: Vercel Blob object storage</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Model Downloads Disclosure */}
      <div className="card-base p-6 sm:p-8 rounded-3xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <Download className="w-5 h-5 text-teal-400" />
            <h2 className="font-bold text-lg text-white">Initial Model Downloads Disclosure</h2>
          </div>
          <span className="text-xs font-mono text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-full border border-teal-500/20">
            Setup Requirement
          </span>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          To achieve complete air-gapped local execution, Voice2Note requires an initial one-time model weight download while connected to the internet. Do not claim complete offline operation until these models have been downloaded and verified on your machine.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl card-raised space-y-2">
            <span className="text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">Speech Recognition</span>
            <div className="text-sm font-bold text-zinc-100 font-mono">Whisper Tiny</div>
            <div className="text-zinc-400">Download Size: ~39 MB</div>
            <div className="text-zinc-400">Source: HuggingFace (Xenova)</div>
            <div className="text-zinc-500 text-[11px]">Cached in local Node/browser runtime on first run.</div>
          </div>

          <div className="p-4 rounded-xl card-raised space-y-2">
            <span className="text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">Vector Embeddings</span>
            <div className="text-sm font-bold text-zinc-100 font-mono">all-MiniLM-L6-v2</div>
            <div className="text-zinc-400">Download Size: ~90 MB</div>
            <div className="text-zinc-400">Source: HuggingFace (Xenova)</div>
            <div className="text-zinc-500 text-[11px]">Cached locally for in-process float32 cosine similarity.</div>
          </div>

          <div className="p-4 rounded-xl card-raised space-y-2">
            <span className="text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">Reasoning & Extraction</span>
            <div className="text-sm font-bold text-zinc-100 font-mono">Llama 3.2 (3B)</div>
            <div className="text-zinc-400">Download Size: ~2.0 GB</div>
            <div className="text-zinc-400">Source: Ollama Model Registry</div>
            <div className="text-zinc-500 text-[11px]">Pulled via <code className="bg-white/10 px-1 py-0.5 rounded font-mono">ollama pull llama3.2</code>.</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 flex items-start gap-3 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Offline Readiness Verification Notice:</strong> Complete offline operation is verified only after confirming that <code className="bg-white/10 px-1 py-0.5 rounded font-mono">ollama serve</code> is active and the Whisper ONNX weights have completed downloading. Attempting to record offline prior to initial downloads will trigger a fail-closed notification.
          </p>
        </div>
      </div>

      {/* What Works Offline After Setup */}
      <div className="card-base p-6 sm:p-8 rounded-3xl space-y-5">
        <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
          <WifiOff className="w-5 h-5 text-emerald-400" />
          <h2 className="font-bold text-lg text-white">What Works Completely Offline After Setup</h2>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Once the initial model downloads have settled, the following operations function 100% offline with zero network connectivity:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-300">
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-zinc-100 block">High-Fidelity Audio Recording</strong>
              <span className="text-zinc-400 text-[11px]">Web Audio API microphone capture saved to local disk.</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-zinc-100 block">On-Device Whisper Transcription</strong>
              <span className="text-zinc-400 text-[11px]">WASM/WebGPU and Node ONNX speech-to-text without internet.</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-zinc-100 block">Structured Extraction & Task Mining</strong>
              <span className="text-zinc-400 text-[11px]">Ollama extracts commitments, ideas, and decisions on localhost.</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-zinc-100 block">Semantic Vector Search & Grounded RAG</strong>
              <span className="text-zinc-400 text-[11px]">MiniLM embeddings and SQLite vector similarity query answering.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Data Flow Transparency Matrix */}
      <div className="card-base p-6 sm:p-8 rounded-3xl space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
          <Cpu className="w-5 h-5 text-indigo-400" />
          <h2 className="font-bold text-lg text-white">Data Flow Transparency Matrix</h2>
        </div>

        <div className="rounded-2xl border border-white/5 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-zinc-400 border-b border-white/5">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Data Asset</th>
                <th className="py-2.5 px-4 font-semibold">Local-Private Destination</th>
                <th className="py-2.5 px-4 font-semibold">Cloud-Assisted Destination</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              <tr>
                <td className="py-2.5 px-4 font-medium text-zinc-200">Audio Memos (.wav/.webm)</td>
                <td className="py-2.5 px-4 font-mono text-[11px] text-emerald-400">./data/audio/ (Local disk)</td>
                <td className="py-2.5 px-4 font-mono text-[11px] text-amber-400">Groq / OpenAI Whisper API + Vercel Blob</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-zinc-200">Raw Transcripts</td>
                <td className="py-2.5 px-4 font-mono text-[11px] text-emerald-400">SQLite: transcripts table</td>
                <td className="py-2.5 px-4 font-mono text-[11px] text-amber-400">Transmitted to Remote LLM for extraction</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-zinc-200">Extraction Prompts</td>
                <td className="py-2.5 px-4 font-mono text-[11px] text-emerald-400">Local Ollama (localhost:11434)</td>
                <td className="py-2.5 px-4 font-mono text-[11px] text-amber-400">Remote LLM (Groq / OpenAI Chat Endpoint)</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-zinc-200">Vector Embeddings</td>
                <td className="py-2.5 px-4 font-mono text-[11px] text-emerald-400">SQLite: note_embeddings table</td>
                <td className="py-2.5 px-4 font-mono text-[11px] text-emerald-400">SQLite: note_embeddings table (local index)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
