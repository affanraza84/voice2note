'use client';

import React from 'react';
import {
  ShieldCheck,
  HardDrive,
  Cpu,
  WifiOff,
  CheckCircle2,
  Lock,
  ServerOff,
} from 'lucide-react';

export default function PrivacyCenterPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-150">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Local-First & Air-Gap Capable</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Privacy Center & Technical Transparency
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl leading-relaxed">
          Voice2Note is engineered from the ground up to respect your confidentiality. Spoken audio recordings and personal reflections should never be harvested for third-party model training.
        </p>
      </div>

      {/* Core Privacy Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-base p-6 rounded-2xl space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Cpu className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-base text-white">100% On-Device AI</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Speech-to-text, summarization, task extraction, and RAG vector search execute on your computer. Audio and prompts are never sent to external AI APIs.
          </p>
        </div>

        <div className="card-base p-6 rounded-2xl space-y-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-base text-white">Local Storage Only</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            All audio files are saved in <code className="bg-white/10 px-1 py-0.5 rounded text-zinc-300">data/audio/</code> and metadata in <code className="bg-white/10 px-1 py-0.5 rounded text-zinc-300">data/voice2note.db</code>. No cloud S3 buckets or remote databases.
          </p>
        </div>

        <div className="card-base p-6 rounded-2xl space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <ServerOff className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-base text-white">Zero Telemetry</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            No analytics SDKs, tracking pixels, or third-party cookies. The application functions cleanly even on an isolated network with zero egress.
          </p>
        </div>
      </div>

      {/* Technical Model Transparency Panel */}
      <div className="card-base p-6 sm:p-8 rounded-3xl space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold text-lg text-white">Model Architecture & Licenses</h2>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            AI Processing: Local
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl card-raised space-y-1.5">
            <span className="text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">Speech Recognition</span>
            <div className="text-sm font-bold text-zinc-100 font-mono">Whisper (whisper-tiny.en)</div>
            <div className="text-zinc-400">Runtime: In-Process ONNX Runtime (Transformers.js)</div>
            <div className="text-zinc-500 font-mono text-[10px]">License: MIT / Apache 2.0</div>
          </div>

          <div className="p-4 rounded-xl card-raised space-y-1.5">
            <span className="text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">Reasoning & Extraction</span>
            <div className="text-sm font-bold text-zinc-100 font-mono">Llama 3.2 (3B Instruct)</div>
            <div className="text-zinc-400">Runtime: Ollama Local Inference (localhost:11434)</div>
            <div className="text-zinc-500 font-mono text-[10px]">License: Meta Llama 3.2 Community License</div>
          </div>

          <div className="p-4 rounded-xl card-raised space-y-1.5">
            <span className="text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">Vector Embeddings</span>
            <div className="text-sm font-bold text-zinc-100 font-mono">all-MiniLM-L6-v2 (384-d)</div>
            <div className="text-zinc-400">Runtime: In-Process ONNX Feature Extraction</div>
            <div className="text-zinc-500 font-mono text-[10px]">License: Apache 2.0</div>
          </div>

          <div className="p-4 rounded-xl card-raised space-y-1.5">
            <span className="text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">Vector Database</span>
            <div className="text-sm font-bold text-zinc-100 font-mono">SQLite Float32Array Index</div>
            <div className="text-zinc-400">Runtime: In-Memory / Disk Cosine Similarity</div>
            <div className="text-zinc-500 font-mono text-[10px]">License: Public Domain (SQLite)</div>
          </div>
        </div>
      </div>

      {/* Offline Verification Guide */}
      <div className="card-base p-6 sm:p-8 rounded-3xl space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
          <WifiOff className="w-5 h-5 text-teal-400" />
          <h2 className="font-bold text-lg text-white">How to Verify Offline Operation</h2>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          You can test and demonstrate that Voice2Note works completely offline without network access:
        </p>

        <ol className="space-y-2.5 text-xs text-zinc-300">
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Ensure Ollama is running locally with <code className="bg-white/10 px-1 py-0.5 rounded font-mono">ollama serve</code>.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Disable your Wi-Fi or turn off your machine&apos;s network interface completely.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Navigate to <strong>Audio Studio</strong>, record a voice note, and click Save.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Observe Whisper transcription, Llama 3.2 extraction, and vector search execute on-device with zero network requests.</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
