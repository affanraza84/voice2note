'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { VoiceNote } from '@/types';
import { AudioPlayer } from '@/components/notes/AudioPlayer';
import { TranscriptView } from '@/components/notes/TranscriptView';
import { IntelligenceView } from '@/components/notes/IntelligenceView';
import { RelatedNotes } from '@/components/notes/RelatedNotes';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  FileAudio,
  Sparkles,
} from 'lucide-react';

import { getClientNote, getClientAudioBlob } from '@/lib/storage/client-db';
import { preprocessAudioForWhisper } from '@/lib/audio/browser-audio';
import { getBrowserWhisper } from '@/lib/ai/browser-whisper';

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [note, setNote] = useState<VoiceNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'intelligence' | 'transcript'>('intelligence');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [seekTime, setSeekTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [retranscribing, setRetranscribing] = useState(false);
  const [processingSeconds, setProcessingSeconds] = useState(0);
  const [retryStatusText, setRetryStatusText] = useState<string | null>(null);

  const fetchNote = React.useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/notes/${id}`);
      if (res.ok) {
        const data = await res.json();
        setNote(data.note);
        if (!isEditingTitle) {
          setTitleInput(data.note.title);
        }
      } else {
        // Fallback to client IndexedDB storage if server returned 404 (e.g. serverless cold start)
        const localNote = await getClientNote(id);
        if (localNote) {
          setNote(localNote);
          if (!isEditingTitle) {
            setTitleInput(localNote.title);
          }
        } else {
          setNote(null);
        }
      }
    } catch (err) {
      console.warn('[Voice2Note] Note fetch warning, checking client storage:', err);
      const localNote = await getClientNote(id);
      if (localNote) {
        setNote(localNote);
        if (!isEditingTitle) {
          setTitleInput(localNote.title);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id, isEditingTitle]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  // Poll while processing/transcribing
  useEffect(() => {
    if (!note) return;
    if (['uploading', 'processing', 'transcribing', 'analyzing'].includes(note.status)) {
      const interval = setInterval(fetchNote, 2000);
      return () => clearInterval(interval);
    }
  }, [note?.status, fetchNote, note]);

  // Track active processing elapsed seconds
  useEffect(() => {
    const isActivelyProcessing = note && ['uploading', 'processing', 'transcribing', 'analyzing'].includes(note.status);
    let interval: NodeJS.Timeout | null = null;
    if (isActivelyProcessing) {
      interval = setInterval(() => {
        setProcessingSeconds((s) => s + 1);
      }, 1000);
    } else {
      setProcessingSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [note?.status, note]);

  const handleSaveTitle = async () => {
    if (!titleInput.trim()) return;
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNote(data.note);
        setIsEditingTitle(false);
      }
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to permanently delete this voice note and its audio?')) {
      return;
    }
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/notes');
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleRetryTranscription = async () => {
    setRetranscribing(true);
    setRetryStatusText('Checking local audio cache...');

    try {
      // 1. Check if we have the audio blob cached in client IndexedDB
      const clientBlob = await getClientAudioBlob(id);
      if (clientBlob) {
        setRetryStatusText('Decoding audio on device...');
        const prep = await preprocessAudioForWhisper(clientBlob);
        
        setRetryStatusText('Transcribing with on-device Whisper...');
        const whisper = getBrowserWhisper();
        const result = await whisper.transcribe(prep.pcmFloat32, 90000);

        if (result.text && result.text.length > 0) {
          setRetryStatusText('Saving transcript and extracting knowledge...');
          await fetch(`/api/notes/${id}/transcribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcriptText: result.text,
              transcriptSegments: result.segments,
              processingTimeMs: result.processingTimeMs,
            }),
          });
          fetchNote();
          setRetryStatusText(null);
          return;
        }
      }

      // 2. Server-side retry fallback
      setRetryStatusText('Submitting retry to server...');
      await fetch(`/api/notes/${id}/transcribe`, { method: 'POST' });
      fetchNote();
      setRetryStatusText(null);
    } catch (err: any) {
      console.error('Retry failed:', err);
      setRetryStatusText(err?.message || 'Retry failed');
    } finally {
      setRetranscribing(false);
    }
  };

  const formatDuration = (secs: number) => {
    if (!secs || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-zinc-500 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-sm">Loading voice note...</span>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="p-12 text-center glass-panel rounded-3xl space-y-4 max-w-md mx-auto">
        <h2 className="text-lg font-bold text-white">Voice Note Not Found</h2>
        <p className="text-xs text-zinc-400">The requested voice note does not exist or has been deleted.</p>
        <Link
          href="/notes"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-xs text-zinc-200 hover:bg-white/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Notes</span>
        </Link>
      </div>
    );
  }

  const isProcessing = ['uploading', 'processing', 'transcribing', 'analyzing'].includes(note.status);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation & Action Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/notes"
          className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Notes</span>
        </Link>

        <div className="flex items-center gap-2">
          {note.status === 'failed' && (
            <button
              onClick={handleRetryTranscription}
              disabled={retranscribing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-medium border border-amber-500/20 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${retranscribing ? 'animate-spin' : ''}`} />
              <span>Retry Transcription</span>
            </button>
          )}

          <button
            onClick={handleDelete}
            className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
            title="Delete Voice Note"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Note Header */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-4">
        {/* Title Editing */}
        <div className="flex items-start justify-between gap-4">
          {isEditingTitle ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                autoFocus
                className="flex-1 px-3 py-1.5 rounded-xl bg-black/40 border border-emerald-500/50 text-xl font-bold text-white focus:outline-none"
              />
              <button
                onClick={handleSaveTitle}
                className="p-2 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition-all"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setTitleInput(note.title);
                  setIsEditingTitle(false);
                }}
                className="p-2 rounded-lg bg-white/10 text-zinc-300 hover:bg-white/20 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 flex-1 group">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                {note.title}
              </h1>
              <button
                onClick={() => setIsEditingTitle(true)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                title="Edit title"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Note Metadata Badges */}
        <div className="flex items-center flex-wrap gap-4 text-xs text-zinc-400 pt-1 border-t border-white/5">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            {formatDate(note.createdAt)}
          </span>
          <span className="flex items-center gap-1.5 font-mono">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            {formatDuration(note.durationSeconds)}
          </span>
          <span className="flex items-center gap-1.5">
            <FileAudio className="w-3.5 h-3.5 text-zinc-400" />
            {(note.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
          </span>
        </div>

        {/* Processing Banner if active */}
        {isProcessing && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span className="font-semibold">
                  {note.status === 'transcribing'
                    ? `Transcribing speech locally • Whisper ONNX • ${processingSeconds}s elapsed`
                    : note.status === 'analyzing'
                    ? `Analyzing intelligence • Llama 3.2 • ${processingSeconds}s elapsed`
                    : `Processing audio on your device... • ${processingSeconds}s elapsed`}
                </span>
              </div>
              <span className="font-mono text-[10px] text-amber-400/80">Local ONNX Engine</span>
            </div>

            {processingSeconds > 20 && processingSeconds <= 45 && (
              <div className="flex items-center justify-between text-[11px] text-amber-400/90 pt-1.5 border-t border-amber-500/15">
                <span>Still processing locally... Longer recordings and initial model compilation may take extra time.</span>
                <button
                  onClick={handleRetryTranscription}
                  disabled={retranscribing}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium transition cursor-pointer shrink-0 ml-3"
                >
                  <RefreshCw className={`w-3 h-3 ${retranscribing ? 'animate-spin' : ''}`} />
                  <span>{retranscribing ? 'Retrying...' : 'Retry Processing'}</span>
                </button>
              </div>
            )}

            {processingSeconds > 45 && (
              <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/30 text-[11px] text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span>Processing is taking longer than expected. Click &quot;Retry Processing&quot; to transcribe immediately on-device with local Whisper.</span>
                <button
                  onClick={handleRetryTranscription}
                  disabled={retranscribing}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition cursor-pointer shrink-0 self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${retranscribing ? 'animate-spin' : ''}`} />
                  <span>{retranscribing ? 'Retrying...' : 'Retry Processing'}</span>
                </button>
              </div>
            )}

            {retryStatusText && (
              <p className="text-[11px] text-emerald-400 font-mono">
                {retryStatusText}
              </p>
            )}
          </div>
        )}

        {/* Error Banner if failed */}
        {note.status === 'failed' && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-white">Transcription Incomplete</span>
                <p>{note.errorMessage || 'An error occurred during local speech processing. Your audio is safely saved.'}</p>
                {retryStatusText && <p className="text-emerald-400 font-mono text-[11px]">{retryStatusText}</p>}
              </div>
            </div>
            <button
              onClick={handleRetryTranscription}
              disabled={retranscribing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-white font-medium transition cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${retranscribing ? 'animate-spin' : ''}`} />
              <span>{retranscribing ? 'Retrying...' : 'Retry Processing'}</span>
            </button>
          </div>
        )}

        {/* Audio Player */}
        <AudioPlayer
          noteId={note.id}
          durationSeconds={note.durationSeconds}
          onTimeUpdate={(t) => setCurrentTime(t)}
          seekTime={seekTime}
        />
      </div>

      {/* Main Tabs: Structured Intelligence vs Raw Transcript */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
          <button
            onClick={() => setActiveTab('intelligence')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'intelligence'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Structured Intelligence</span>
            {note.extraction?.tasks && note.extraction.tasks.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('transcript')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'transcript'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Full Transcript</span>
          </button>
        </div>

        {activeTab === 'intelligence' ? (
          <IntelligenceView
            extraction={note.extraction || null}
            noteId={note.id}
            onTaskToggle={(_tId, _st) => {}}
          />
        ) : (
          <TranscriptView
            transcript={note.transcript || null}
            currentTime={currentTime}
            onSeek={(sec) => setSeekTime(sec)}
          />
        )}
      </div>

      {/* Related Notes (Vector Similarity) */}
      <RelatedNotes noteId={note.id} />
    </div>
  );
}
