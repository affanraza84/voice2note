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
  Loader2,
  RefreshCw,
  AlertCircle,
  FileAudio,
  Sparkles,
  Download,
  Building2,
  FolderGit2,
  FileSpreadsheet,
} from 'lucide-react';

import { getClientNote, getClientAudioBlob, deleteClientNote } from '@/lib/storage/client-db';
import { preprocessAudioForWhisper } from '@/lib/audio/browser-audio';
import { getBrowserWhisper } from '@/lib/ai/browser-whisper';
import { generateMeetingMarkdown, generateTasksCSV, downloadFile } from '@/lib/export/meeting-export';

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [note, setNote] = useState<VoiceNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'intelligence' | 'transcript'>('intelligence');
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [clientInput, setClientInput] = useState('');
  const [projectInput, setProjectInput] = useState('');
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
        if (!isEditingMetadata) {
          setTitleInput(data.note.title);
          setClientInput(data.note.client || '');
          setProjectInput(data.note.project || '');
        }
      } else {
        // Fallback to client IndexedDB storage if server returned 404 (e.g. serverless cold start)
        const localNote = await getClientNote(id);
        if (localNote) {
          setNote(localNote);
          if (!isEditingMetadata) {
            setTitleInput(localNote.title);
            setClientInput(localNote.client || '');
            setProjectInput(localNote.project || '');
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
        if (!isEditingMetadata) {
          setTitleInput(localNote.title);
          setClientInput(localNote.client || '');
          setProjectInput(localNote.project || '');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id, isEditingMetadata]);

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

  const handleSaveMetadata = async () => {
    if (!titleInput.trim()) return;
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titleInput.trim(),
          client: clientInput.trim(),
          project: projectInput.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNote(data.note);
        setIsEditingMetadata(false);
      }
    } catch (err) {
      console.error('Failed to update note metadata:', err);
    }
  };

  const handleExportMarkdown = () => {
    if (!note) return;
    const md = generateMeetingMarkdown(note);
    const filename = `${note.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-followup.md`;
    downloadFile(md, filename, 'text/markdown');
  };

  const handleExportTasksCSV = () => {
    if (!note) return;
    const tasks = note.extraction?.tasks || [];
    const csv = generateTasksCSV(tasks, note.title, note.client, note.project);
    const filename = `${note.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-tasks.csv`;
    downloadFile(csv, filename, 'text/csv');
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to permanently delete this voice note and its audio?')) {
      return;
    }
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      await deleteClientNote(id);
      if (res.ok) {
        router.push('/notes');
      }
    } catch (err) {
      console.error('Delete failed:', err);
      await deleteClientNote(id);
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          href="/notes"
          className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Notes</span>
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          {note.status === 'ready' && (
            <>
              <button
                onClick={handleExportMarkdown}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-medium border border-white/10 transition cursor-pointer"
                title="Download full meeting summary as Markdown"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export Markdown</span>
              </button>

              <button
                onClick={handleExportTasksCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-medium border border-white/10 transition cursor-pointer"
                title="Download action items as CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                <span>Export Tasks (CSV)</span>
              </button>
            </>
          )}

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
        {/* Title & Client / Project Editing */}
        <div className="space-y-3">
          {isEditingMetadata ? (
            <div className="space-y-3 p-4 rounded-2xl bg-black/40 border border-emerald-500/30">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Meeting Title</label>
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-1.5 rounded-xl bg-black/60 border border-emerald-500/50 text-lg font-bold text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-sky-400" />
                    Client Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Health Tech"
                    value={clientInput}
                    onChange={(e) => setClientInput(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1 flex items-center gap-1">
                    <FolderGit2 className="w-3 h-3 text-emerald-400" />
                    Project Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Patient Portal Redesign"
                    value={projectInput}
                    onChange={(e) => setProjectInput(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  onClick={() => {
                    setTitleInput(note.title);
                    setClientInput(note.client || '');
                    setProjectInput(note.project || '');
                    setIsEditingMetadata(false);
                  }}
                  className="px-3 py-1 rounded-lg bg-white/10 text-zinc-300 hover:bg-white/20 text-xs transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMetadata}
                  className="px-4 py-1 rounded-lg bg-emerald-500 text-black font-semibold text-xs hover:bg-emerald-400 transition"
                >
                  Save Metadata
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-1 group">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                  {note.title}
                </h1>
                <button
                  onClick={() => setIsEditingMetadata(true)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Edit title, client, or project"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {/* Client & Project Badges */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {note.client ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Client: {note.client}</span>
                  </span>
                ) : null}

                {note.project ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <FolderGit2 className="w-3.5 h-3.5" />
                    <span>Project: {note.project}</span>
                  </span>
                ) : null}

                {(!note.client || !note.project) && (
                  <button
                    onClick={() => setIsEditingMetadata(true)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
                  >
                    + Tag client/project
                  </button>
                )}
              </div>
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
            noteTitle={note.title}
            client={note.client}
            project={note.project}
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
