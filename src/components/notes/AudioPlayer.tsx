'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react';

interface AudioPlayerProps {
  noteId: string;
  durationSeconds?: number;
  onTimeUpdate?: (currentTime: number) => void;
  seekTime?: number | null;
}

import { getClientAudioBlob } from '@/lib/storage/client-db';

export function AudioPlayer({ noteId, durationSeconds = 0, onTimeUpdate, seekTime }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioSource, setAudioSource] = useState<string>(`/api/audio/${noteId}`);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    const resolveAudio = async () => {
      try {
        const res = await fetch(`/api/audio/${noteId}`, { method: 'HEAD' });
        if (res.ok) {
          setAudioSource(`/api/audio/${noteId}`);
          return;
        }
      } catch {}

      // Fallback to offline/client IndexedDB blob
      const localBlob = await getClientAudioBlob(noteId);
      if (localBlob) {
        objectUrl = URL.createObjectURL(localBlob);
        setAudioSource(objectUrl);
      }
    };

    resolveAudio();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [noteId]);

  // Sync seekTime from parent (e.g. clicking a timestamp in the transcript)
  useEffect(() => {
    if (seekTime !== null && seekTime !== undefined && audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
      if (!isPlaying) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekTime]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      if (onTimeUpdate) onTimeUpdate(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && (!duration || duration === 0)) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const skipSeconds = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    }
  };

  const changeRate = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-white/10 shadow-xl space-y-3">
      <audio
        ref={audioRef}
        src={audioSource}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />

      {/* Progress Slider */}
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
        />
        <div className="flex justify-between text-[11px] font-mono text-zinc-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {/* Skip -5s */}
          <button
            onClick={() => skipSeconds(-5)}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all"
            title="Rewind 5 seconds"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center font-bold shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
          </button>

          {/* Skip +5s */}
          <button
            onClick={() => skipSeconds(5)}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all"
            title="Fast forward 5 seconds"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Speed Selector */}
          <button
            onClick={changeRate}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-zinc-300 transition-all"
            title="Playback Speed"
          >
            {playbackRate}x
          </button>

          {/* Mute */}
          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.muted = !isMuted;
                setIsMuted(!isMuted);
              }
            }}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
