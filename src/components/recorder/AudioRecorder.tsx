'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic,
  Square,
  Pause,
  Play,
  RotateCcw,
  Check,
  AlertCircle,
  Volume2,
  Loader2,
  Radio,
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

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Start recording
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

      // Setup Web Audio API analyser for waveform visualization
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      // Setup MediaRecorder
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = ''; // Let browser choose
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

      recorder.start(250); // Slice every 250ms
      setStatus('recording');
      setElapsedSeconds(0);

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      // Start canvas waveform visualizer
      drawWaveform();
    } catch (err: any) {
      console.error('Microphone access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Microphone permission was denied. Please allow microphone access in your browser site settings.'
        );
      } else if (err.name === 'NotFoundError') {
        setErrorMessage('No microphone device was detected on your system.');
      } else {
        setErrorMessage(`Failed to start recording: ${err.message || 'Unknown device error'}`);
      }
      setStatus('idle');
    }
  };

  // Pause recording
  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setStatus('paused');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Resume recording
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

  // Stop recording
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

  // Discard recording and reset
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

  // Draw audio visualizer bars on canvas
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
        const barHeight = Math.max(4, percent * canvas.height * 0.9);
        const x = i * (barWidth + barGap);
        const y = (canvas.height - barHeight) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, '#10b981');
        gradient.addColorStop(1, '#059669');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    };

    render();
  };

  // Save recording to server
  const saveRecording = async () => {
    if (!audioBlob) return;

    setStatus('saving');
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

      if (onSuccess) {
        onSuccess(data.note.id);
      } else {
        router.push(`/notes/${data.note.id}`);
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setErrorMessage(err.message || 'Error saving recording');
      setStatus('stopped');
    }
  };

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${status === 'recording' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            <Radio className={`w-5 h-5 ${status === 'recording' ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-white">Live Voice Recorder</h3>
            <p className="text-xs text-zinc-400">Audio is recorded in-browser and transcribed 100% locally.</p>
          </div>
        </div>

        {/* Live Indicator */}
        {status === 'recording' && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            RECORDING
          </div>
        )}
      </div>

      {/* Waveform Visualizer & Timer */}
      <div className="h-32 rounded-2xl bg-black/40 border border-white/5 flex flex-col items-center justify-center relative px-4">
        {status === 'recording' || status === 'paused' ? (
          <canvas ref={canvasRef} width={600} height={80} className="w-full h-20 max-w-lg" />
        ) : (
          <div className="flex flex-col items-center text-zinc-500 gap-1.5">
            <Volume2 className="w-6 h-6 opacity-40" />
            <span className="text-xs">Click record to start speaking</span>
          </div>
        )}

        {/* Timer display */}
        <div className="text-2xl font-mono font-bold tracking-wider text-zinc-200 mt-1">
          {formatTime(elapsedSeconds)}
        </div>
      </div>

      {/* Audio Playback Preview (if stopped) */}
      {audioUrl && status === 'stopped' && (
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Audio Preview</span>
            <span>Duration: {formatTime(elapsedSeconds)}</span>
          </div>
          <audio src={audioUrl} controls className="w-full h-10 accent-emerald-500" />
          <input
            type="text"
            placeholder="Name your note (optional)..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
          />
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
      <div className="flex items-center justify-center gap-4 pt-2">
        {status === 'idle' && (
          <button
            onClick={startRecording}
            className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-semibold text-sm shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            <span>Start Recording</span>
          </button>
        )}

        {status === 'recording' && (
          <>
            <button
              onClick={pauseRecording}
              className="p-3.5 rounded-2xl bg-white/10 text-zinc-200 hover:bg-white/20 transition-all cursor-pointer"
              title="Pause"
            >
              <Pause className="w-5 h-5" />
            </button>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-red-500 text-white font-semibold text-sm shadow-lg shadow-red-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer recording-pulse"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>Stop</span>
            </button>
          </>
        )}

        {status === 'paused' && (
          <>
            <button
              onClick={resumeRecording}
              className="p-3.5 rounded-2xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-all cursor-pointer"
              title="Resume"
            >
              <Play className="w-5 h-5 fill-black" />
            </button>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-red-500 text-white font-semibold text-sm hover:scale-105 transition-all cursor-pointer"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>Done</span>
            </button>
          </>
        )}

        {status === 'stopped' && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={resetRecording}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/10 text-zinc-300 text-sm hover:bg-white/15 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Discard</span>
            </button>
            <button
              onClick={saveRecording}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-emerald-500 text-black font-semibold text-sm shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save & Transcribe</span>
            </button>
          </div>
        )}

        {status === 'saving' && (
          <div className="flex items-center gap-3 px-8 py-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Saving & Queuing Local Transcription...</span>
          </div>
        )}
      </div>
    </div>
  );
}
