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
} from 'lucide-react';

interface AudioRecorderProps {
  onSuccess?: (noteId: string) => void;
}

export function AudioRecorder({ onSuccess }: AudioRecorderProps) {
  const router = useRouter();

  // Recording states: 'idle' | 'recording' | 'paused' | 'stopped' | 'saving'
  const [status, setStatus] = useState<'idle' | 'recording' | 'paused' | 'stopped' | 'saving'>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Granular processing feedback state
  const [processingStage, setProcessingStage] = useState<'saving' | 'transcribing' | 'analyzing' | 'indexing' | 'ready'>('saving');

  // Refs for audio handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

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

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage(
        'Your browser does not support audio recording. Please use modern Chrome, Safari, Firefox, or Edge.'
      );
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

      recorder.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        setAudioBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);
        setStatus('stopped');
        if (timerRef.current) clearInterval(timerRef.current);
      };

      recorder.start(250);
      setStatus('recording');
      setElapsedSeconds(0);

      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      drawWaveform();
    } catch (err: any) {
      console.error('Microphone access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Microphone permission was denied. Please allow microphone access in your browser site settings and try again.'
        );
      } else if (err.name === 'NotFoundError') {
        setErrorMessage('No microphone device was detected on your system.');
      } else {
        setErrorMessage(`Failed to start recording: ${err.message || 'Unknown device error'}`);
      }
      setStatus('idle');
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
    setElapsedSeconds(0);
    setTitle('');
    setStatus('idle');
    setErrorMessage(null);
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
    const maxAttempts = 15;

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/notes/${noteId}`);
        if (res.ok) {
          const data = await res.json();
          const noteStatus = data.note.status;

          if (noteStatus === 'transcribing') {
            setProcessingStage('transcribing');
          } else if (noteStatus === 'analyzing') {
            setProcessingStage('analyzing');
          } else if (noteStatus === 'ready') {
            setProcessingStage('ready');
            setTimeout(() => {
              if (onSuccess) {
                onSuccess(noteId);
              } else {
                router.push(`/notes/${noteId}`);
              }
            }, 800);
            return;
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
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

    setTimeout(poll, 800);
  };

  const saveRecording = async () => {
    if (!audioBlob) return;

    setStatus('saving');
    setProcessingStage('saving');
    setErrorMessage(null);

    try {
      const formData = new FormData();
      const ext = audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
      const fileName = `Recording-${Date.now()}.${ext}`;

      formData.append('audio', audioBlob, fileName);
      if (title.trim()) {
        formData.append('title', title.trim());
      }
      formData.append('duration', elapsedSeconds.toString());

      const res = await fetch('/api/notes', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save recording');
      }

      setProcessingStage('transcribing');
      pollNoteProgression(data.note.id);

    } catch (err: any) {
      console.error('Save error:', err);
      setErrorMessage(err.message || 'Error saving recording');
      setStatus('stopped');
    }
  };

  return (
    <div className="card-base p-6 sm:p-8 rounded-3xl space-y-6 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${status === 'recording' ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-zinc-300'}`}>
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-white">Live Voice Recorder</h2>
            <p className="text-xs text-zinc-400">Audio recorded directly in-browser and processed on-device.</p>
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
      {audioUrl && status === 'stopped' && (
        <div className="p-4 rounded-2xl card-raised space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Audio Preview</span>
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

      {/* Post-Recording Processing Feedback (Requirement #4) */}
      {status === 'saving' && (
        <div className="p-6 rounded-2xl card-raised border border-emerald-500/20 space-y-4 animate-in fade-in duration-150">
          <div className="text-center space-y-1">
            <h3 className="font-bold text-sm text-white">Your note is being processed locally...</h3>
            <p className="text-xs text-zinc-400">Zero cloud egress • Executing Whisper & Llama 3.2 on-device</p>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-2">
            <div className={`p-2.5 rounded-xl text-center border text-xs space-y-1 ${
              processingStage === 'transcribing' || processingStage === 'analyzing' || processingStage === 'indexing' || processingStage === 'ready'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-white/[0.02] border-white/5 text-zinc-500'
            }`}>
              <Mic className="w-4 h-4 mx-auto" />
              <span className="block text-[10px] font-semibold">Transcribing</span>
            </div>

            <div className={`p-2.5 rounded-xl text-center border text-xs space-y-1 ${
              processingStage === 'analyzing' || processingStage === 'indexing' || processingStage === 'ready'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-white/[0.02] border-white/5 text-zinc-500'
            }`}>
              <Sparkles className="w-4 h-4 mx-auto" />
              <span className="block text-[10px] font-semibold">Analyzing</span>
            </div>

            <div className={`p-2.5 rounded-xl text-center border text-xs space-y-1 ${
              processingStage === 'indexing' || processingStage === 'ready'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-white/[0.02] border-white/5 text-zinc-500'
            }`}>
              <Database className="w-4 h-4 mx-auto" />
              <span className="block text-[10px] font-semibold">Indexing</span>
            </div>

            <div className={`p-2.5 rounded-xl text-center border text-xs space-y-1 ${
              processingStage === 'ready'
                ? 'bg-emerald-500 text-black font-bold border-emerald-400'
                : 'bg-white/[0.02] border-white/5 text-zinc-500'
            }`}>
              <CheckCircle2 className="w-4 h-4 mx-auto" />
              <span className="block text-[10px] font-semibold">Ready</span>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}

      {/* Controls */}
      {status !== 'saving' && (
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
                onClick={saveRecording}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-xs shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save & Transcribe</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
