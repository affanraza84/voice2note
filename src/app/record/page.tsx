'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AudioRecorder } from '@/components/recorder/AudioRecorder';
import { AudioUploader } from '@/components/uploader/AudioUploader';
import { Mic, UploadCloud, Info, Loader2 } from 'lucide-react';

function RecordContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'upload' ? 'upload' : 'record';
  const [activeTab, setActiveTab] = useState<'record' | 'upload'>(initialTab);

  useEffect(() => {
    if (searchParams.get('tab') === 'upload') {
      setActiveTab('upload');
    }
  }, [searchParams]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Page Title */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Audio Studio</h1>
        <p className="text-sm text-zinc-400">
          Capture speech in real time or import existing audio files for local transcription.
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="flex p-1.5 rounded-2xl glass-panel border border-white/5 max-w-sm">
        <button
          onClick={() => setActiveTab('record')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'record'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>Microphone</span>
        </button>

        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'upload'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload File</span>
        </button>
      </div>

      {/* Main Studio View */}
      {activeTab === 'record' ? <AudioRecorder /> : <AudioUploader />}

      {/* Privacy Notice Box */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-3 text-xs text-zinc-400">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-medium text-zinc-300">How your audio is processed</span>
          <p className="leading-relaxed">
            When you stop or upload a recording, it is converted on your machine using FFmpeg and passed directly to an in-process local Whisper speech recognition model. No audio or text is transmitted to external cloud APIs.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RecordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-20 text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading Audio Studio...</span>
        </div>
      }
    >
      <RecordContent />
    </Suspense>
  );
}
