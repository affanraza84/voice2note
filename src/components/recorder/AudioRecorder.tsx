'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic,
  Square,
  Pause,
  Play,
  X,
  RotateCcw,
  Check,
  AlertCircle,
  Volume2,
  Sparkles,
  Database,
  CheckCircle2,
  RefreshCw,
  Download,
} from 'lucide-react';
import { preprocessAudioForWhisper, PreprocessedAudio } from '@/lib/audio/browser-audio';
import { getBrowserWhisper, BrowserWhisperProgress } from '@/lib/ai/browser-whisper';
import { saveClientNote } from '@/lib/storage/client-db';
import { DiagnosticPanel } from '@/components/debug/DiagnosticPanel';

interface AudioRecorderProps {
  onSuccess?: (noteId: string) => void;
}

export type RecorderState =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'stopped'
  | 'preparing-audio'
  | 'transcribing'
  | 'saving'
  | 'analyzing'
  | 'indexing'
  | 'ready'
  | 'failed';

export type FailureStage =
  | 'recording-failed'
  | 'audio-processing-failed'
  | 'transcription-failed'
  | 'analysis-failed'
  | 'storage-failed';

export function AudioRecorder({ onSuccess }: AudioRecorderProps) {
  const router = useRouter();

  // State machine
  const [status, setStatus] = useState<RecorderState>('idle');
  const [failureStage, setFailureStage] = useState<FailureStage | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [preprocessed, setPreprocessed] = useState<PreprocessedAudio | null>(null);
  const [title, setTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusDetailText, setStatusDetailText] = useState<string>('');

  // Whisper model progress
  const [whisperProgress, setWhisperProgress] = useState<BrowserWhisperProgress | null>(null);

  // Refs for audio handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Subscribe to browser Whisper progress
  useEffect(() => {
    const whisper = getBrowserWhisper();
    const unsubscribe = whisper.subscribe((prog) => {
      setWhisperProgress(prog);
    });
    return () => unsubscribe();
  }, []);

  // Clean up timers and audio streams on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    setErrorMessage(null);
    setFailureStage(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setFailureStage('recording-failed');
      setErrorMessage(
        'Your browser does not support audio recording. Please use modern Chrome, Safari, Firefox, or Edge.'
      );
      setStatus('failed');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = '';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const rawBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        setAudioBlob(rawBlob);
        const url = URL.createObjectURL(rawBlob);
        setAudioUrl(url);
        setStatus('stopped');
        if (timerRef.current) clearInterval(timerRef.current);

        // Preprocess audio in background so 16kHz WAV is ready immediately
        try {
          const prep = await preprocessAudioForWhisper(rawBlob);
          setPreprocessed(prep);
        } catch (prepErr: any) {
          console.warn('[Voice2Note] Preprocessing warning on stop:', prepErr);
        }
      };

      recorder.start(250);
      setStatus('recording');
      setElapsedSeconds(0);

      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      drawWaveform();
    } catch (err: any) {
      console.error('[Voice2Note] Microphone access error:', err);
      setFailureStage('recording-failed');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Microphone permission was denied. Please allow microphone access in your browser site settings and try again.'
        );
      } else if (err.name === 'NotFoundError') {
        setErrorMessage('No microphone device was detected on your system.');
      } else {
        setErrorMessage(`Failed to start recording: ${err.message || 'Unknown device error'}`);
      }
      setStatus('failed');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setStatus('paused');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setStatus('recording');
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
      drawWaveform();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  const resetRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setAudioUrl(null);
    setAudioBlob(null);
    setPreprocessed(null);
    setElapsedSeconds(0);
    setTitle('');
    setStatus('idle');
    setFailureStage(null);
    setErrorMessage(null);
    setStatusDetailText('');
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      if (status === 'paused' || status === 'stopped') return;

      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = 4;
      const barGap = 3;
      const totalBars = Math.floor(canvas.width / (barWidth + barGap));
      const step = Math.floor(bufferLength / totalBars);

      for (let i = 0; i < totalBars; i++) {
        const value = dataArray[i * step] || 0;
        const percent = value / 255;
        const barHeight = Math.max(4, percent * canvas.height * 0.85);
        const x = i * (barWidth + barGap);
        const y = (canvas.height - barHeight) / 2;

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    };

    render();
  };

  // Poll note progression until ready
  const pollNoteProgression = async (noteId: string) => {
    let attempts = 0;
    const maxAttempts = 20;

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/notes/${noteId}`);
        if (res.ok) {
          const data = await res.json();
          const note = data.note;
          const noteStatus = note.status;

          // Save note update to local IndexedDB to guarantee persistence
          saveClientNote(note).catch(() => {});

          if (noteStatus === 'transcribing') {
            setStatus('transcribing');
            setStatusDetailText('Transcribing audio...');
          } else if (noteStatus === 'analyzing') {
            setStatus('analyzing');
            setStatusDetailText('Extracting tasks, ideas, and decisions...');
          } else if (noteStatus === 'ready') {
            setStatus('ready');
            setStatusDetailText('Note ready!');
            setTimeout(() => {
              if (onSuccess) {
                onSuccess(noteId);
              } else {
                router.push(`/notes/${noteId}`);
              }
            }, 600);
            return;
          } else if (noteStatus === 'failed') {
            setFailureStage('analysis-failed');
            setErrorMessage(note.errorMessage || 'AI processing encountered an issue, but your recording is saved.');
            setStatus('failed');
            return;
          }
        }
      } catch (err) {
        console.error('[Voice2Note] Polling error:', err);
      }

      if (attempts < maxAttempts) {
        setTimeout(poll, 1200);
      } else {
        // Fallback redirect if background takes longer
        if (onSuccess) {
          onSuccess(noteId);
        } else {
          router.push(`/notes/${noteId}`);
        }
      }
    };

    setTimeout(poll, 600);
  };

  const processAndSaveRecording = async () => {
    if (!audioBlob) return;

    setErrorMessage(null);
    setFailureStage(null);
    setStatus('preparing-audio');
    setStatusDetailText('Normalizing audio to 16kHz Mono PCM...');

    let prepData = preprocessed;
    if (!prepData) {
      try {
        prepData = await preprocessAudioForWhisper(audioBlob);
        setPreprocessed(prepData);
      } catch (prepErr: any) {
        console.error('[Voice2Note] Audio preprocessing failed:', prepErr);
        setFailureStage('audio-processing-failed');
        setErrorMessage(`Audio preprocessing failed: ${prepErr?.message || 'Unsupported audio'}`);
        setStatus('failed');
        return;
      }
    }

    // Step 2: Attempt in-browser Whisper transcription with fallback
    let clientTranscript: { text: string; segments: any[] } | null = null;
    const whisper = getBrowserWhisper();

    try {
      setStatus('transcribing');
      setStatusDetailText('Transcribing on-device with Whisper...');
      const result = await whisper.transcribe(prepData.pcmFloat32, 45000);
      if (result.text && result.text.length > 0) {
        clientTranscript = {
          text: result.text,
          segments: result.segments,
        };
        console.log('[Voice2Note] In-browser transcription succeeded:', clientTranscript.text);
      }
    } catch (whisperErr: any) {
      console.warn('[Voice2Note] Browser Whisper skipped/failed, will use server pipeline:', whisperErr);
      setStatusDetailText('Uploading 16kHz WAV for server transcription...');
    }

    // Step 3: Save to Server API + Client IndexedDB
    setStatus('saving');
    setStatusDetailText('Persisting note to knowledge base...');

    try {
      const formData = new FormData();
      // Always upload as normalized 16kHz WAV so server needs zero FFmpeg!
      const wavFileName = `Recording-${Date.now()}.wav`;
      formData.append('audio', prepData.wavBlob, wavFileName);

      if (title.trim()) {
        formData.append('title', title.trim());
      }
      formData.append('duration', prepData.durationSeconds.toString());

      if (clientTranscript) {
        formData.append('transcriptText', clientTranscript.text);
        formData.append('transcriptSegments', JSON.stringify(clientTranscript.segments));
      }

      const res = await fetch('/api/notes', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save recording to server');
      }

      // Persist in client IndexedDB immediately
      await saveClientNote(data.note, prepData.wavBlob);

      // Step 4: Follow progression
      setStatus('analyzing');
      setStatusDetailText('Extracting tasks, ideas, and decisions...');
      pollNoteProgression(data.note.id);
    } catch (saveErr: any) {
      console.error('[Voice2Note] Note save failed:', saveErr);
      setFailureStage('storage-failed');
      setErrorMessage(saveErr?.message || 'Could not save note to server. Your audio recording is preserved.');
      setStatus('failed');

      // Still persist locally in IndexedDB so audio is never lost
      try {
        const localId = `local-${Date.now()}`;
        await saveClientNote(
          {
            id: localId,
            title: title.trim() || `Local Recording ${new Date().toLocaleTimeString()}`,
            audioFileName: `Recording-${Date.now()}.wav`,
            mimeType: 'audio/wav',
            fileSizeBytes: prepData.wavBlob.size,
            durationSeconds: prepData.durationSeconds,
            status: 'failed',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          prepData.wavBlob
        );
        console.log('[Voice2Note] Saved recovery recording to client IndexedDB.');
      } catch {}
    }
  };

  const handleDownloadWav = () => {
    const blobToDownload = preprocessed?.wavBlob || audioBlob;
    if (!blobToDownload) return;
    const url = URL.createObjectURL(blobToDownload);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice2note-recording-${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card-base p-6 sm:p-8 rounded-3xl space-y-6 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl ${
              status === 'recording' ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-zinc-300'
            }`}
          >
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-white">Live Voice Recorder</h2>
            <p className="text-xs text-zinc-400">
              Audio normalized to 16kHz on-device. Executed locally with zero data loss.
            </p>
          </div>
        </div>

        {status === 'recording' && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500 recording-calm-pulse" />
            RECORDING
          </div>
        )}
      </div>

      {/* Waveform Visualizer & Timer */}
      <div className="h-28 rounded-2xl bg-black/40 border border-white/5 flex flex-col items-center justify-center relative px-4">
        {status === 'recording' || status === 'paused' ? (
          <canvas ref={canvasRef} width={600} height={70} className="w-full h-16 max-w-lg" />
        ) : (
          <div className="flex flex-col items-center text-zinc-500 gap-1.5">
            <Volume2 className="w-5 h-5 opacity-40" />
            <span className="text-xs">Click record to start speaking</span>
          </div>
        )}

        <div className="text-2xl font-mono font-bold tracking-wider text-zinc-200 mt-1">
          {formatTime(elapsedSeconds)}
        </div>
      </div>

      {/* Audio Playback Preview */}
      {audioUrl && (status === 'stopped' || status === 'failed') && (
        <div className="p-4 rounded-2xl card-raised space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Audio Preview (Recorded)</span>
            <span>Duration: {formatTime(elapsedSeconds)}</span>
          </div>
          <audio src={audioUrl} controls className="w-full h-10 accent-emerald-500" />
          <input
            type="text"
            placeholder="Add title (optional, or let AI generate one)..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      )}

      {/* Explicit Observable Processing State Machine */}
      {(status === 'preparing-audio' ||
        status === 'transcribing' ||
        status === 'saving' ||
        status === 'analyzing' ||
        status === 'indexing' ||
        status === 'ready') && (
        <div className="p-6 rounded-2xl card-raised border border-emerald-500/20 space-y-4 animate-in fade-in duration-150">
          <div className="text-center space-y-1">
            <h3 className="font-bold text-sm text-white">Processing your recording...</h3>
            <p className="text-xs text-emerald-400 font-medium">
              {statusDetailText || 'Executing pipeline...'}
            </p>
            {whisperProgress?.state === 'loading-model' && (
              <p className="text-[11px] text-zinc-400">
                {whisperProgress.statusText} ({whisperProgress.progressPercent}%)
              </p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 pt-2">
            <div
              className={`p-2.5 rounded-xl text-center border text-xs space-y-1 ${
                status === 'preparing-audio' ||
                status === 'transcribing' ||
                status === 'saving' ||
                status === 'analyzing' ||
                status === 'indexing' ||
                status === 'ready'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-white/[0.02] border-white/5 text-zinc-500'
              }`}
            >
              <Mic className="w-4 h-4 mx-auto" />
              <span className="block text-[10px] font-semibold">1. Transcribe</span>
            </div>

            <div
              className={`p-2.5 rounded-xl text-center border text-xs space-y-1 ${
                status === 'saving' || status === 'analyzing' || status === 'indexing' || status === 'ready'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-white/[0.02] border-white/5 text-zinc-500'
              }`}
            >
              <Database className="w-4 h-4 mx-auto" />
              <span className="block text-[10px] font-semibold">2. Store</span>
            </div>

            <div
              className={`p-2.5 rounded-xl text-center border text-xs space-y-1 ${
                status === 'analyzing' || status === 'indexing' || status === 'ready'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-white/[0.02] border-white/5 text-zinc-500'
              }`}
            >
              <Sparkles className="w-4 h-4 mx-auto" />
              <span className="block text-[10px] font-semibold">3. Extract</span>
            </div>

            <div
              className={`p-2.5 rounded-xl text-center border text-xs space-y-1 ${
                status === 'ready'
                  ? 'bg-emerald-500 text-black font-bold border-emerald-400'
                  : 'bg-white/[0.02] border-white/5 text-zinc-500'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 mx-auto" />
              <span className="block text-[10px] font-semibold">4. Ready</span>
            </div>
          </div>
        </div>
      )}

      {/* Failure State Banner with Retry Controls */}
      {status === 'failed' && (
        <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <span className="font-semibold text-white block">
                {failureStage === 'recording-failed' && 'Audio Recording Issue'}
                {failureStage === 'audio-processing-failed' && 'Audio Preprocessing Issue'}
                {failureStage === 'transcription-failed' && 'Transcription Failed'}
                {failureStage === 'storage-failed' && 'Storage / Network Issue'}
                {failureStage === 'analysis-failed' && 'AI Extraction Notice'}
                {!failureStage && 'Processing Issue'}
              </span>
              <p className="text-zinc-300 leading-relaxed">
                {errorMessage || 'An error occurred during audio processing.'}
              </p>
              <p className="text-[11px] text-zinc-400">
                Your audio recording is preserved on your device and has not been lost.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-red-500/20">
            <button
              onClick={processAndSaveRecording}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Processing</span>
            </button>
            <button
              onClick={handleDownloadWav}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Audio (.wav)</span>
            </button>
            <button
              onClick={resetRecording}
              className="px-3 py-2 rounded-xl text-zinc-400 hover:text-white text-xs transition-colors cursor-pointer"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      {status !== 'preparing-audio' &&
        status !== 'transcribing' &&
        status !== 'saving' &&
        status !== 'analyzing' &&
        status !== 'indexing' &&
        status !== 'ready' && (
          <div className="flex items-center justify-center gap-3 pt-2">
            {status === 'idle' && (
              <button
                onClick={startRecording}
                className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-emerald-500 text-black font-semibold text-xs hover:bg-emerald-400 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                <Mic className="w-4 h-4" />
                <span>Start Recording</span>
              </button>
            )}

            {status === 'recording' && (
              <>
                <button
                  onClick={resetRecording}
                  className="p-3 rounded-xl bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Cancel Recording"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={pauseRecording}
                  className="p-3 rounded-xl bg-white/10 text-zinc-200 hover:bg-white/20 transition-all cursor-pointer"
                  title="Pause"
                >
                  <Pause className="w-4 h-4" />
                </button>
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-500 text-white font-semibold text-xs hover:bg-red-400 transition-all cursor-pointer shadow-lg shadow-red-500/25"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>Stop</span>
                </button>
              </>
            )}

            {status === 'paused' && (
              <>
                <button
                  onClick={resetRecording}
                  className="p-3 rounded-xl bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={resumeRecording}
                  className="p-3 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-all cursor-pointer"
                  title="Resume"
                >
                  <Play className="w-4 h-4 fill-black" />
                </button>
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-500 text-white font-semibold text-xs hover:bg-red-400 transition-all cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>Done</span>
                </button>
              </>
            )}

            {status === 'stopped' && (
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={resetRecording}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Cancel / Discard</span>
                </button>
                <button
                  onClick={processAndSaveRecording}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-xs shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save & Transcribe</span>
                </button>
              </div>
            )}
          </div>
        )}

      {/* Collapsible Diagnostic & System Panel */}
      <div className="pt-2">
        <DiagnosticPanel />
      </div>
    </div>
  );
}
