'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileAudio, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

interface AudioUploaderProps {
  onSuccess?: (noteId: string) => void;
}

export function AudioUploader({ onSuccess }: AudioUploaderProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supportedExtensions = ['.webm', '.wav', '.mp3', '.m4a', '.mp4', '.aac', '.ogg', '.flac'];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    setErrorMessage(null);

    // Validate size (< 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed is 50MB.`);
      return;
    }

    if (file.size === 0) {
      setErrorMessage('Selected file is empty (0 bytes).');
      return;
    }

    setSelectedFile(file);
    // Suggest clean title from filename
    const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    setTitle(cleanTitle);
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('audio', selectedFile);
      if (title.trim()) {
        formData.append('title', title.trim());
      }

      const res = await fetch('/api/notes', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload audio');
      }

      if (onSuccess) {
        onSuccess(data.note.id);
      } else {
        router.push(`/notes/${data.note.id}`);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setErrorMessage(err.message || 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
          <UploadCloud className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-white">Upload Audio File</h3>
          <p className="text-xs text-zinc-400">Import existing voice memos from phone or computer.</p>
        </div>
      </div>

      {/* Drag & Drop Target */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-emerald-400 bg-emerald-500/10'
            : 'border-white/10 hover:border-white/20 bg-white/[0.01]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={supportedExtensions.join(',')}
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-400 mb-3">
          <FileAudio className="w-6 h-6 text-zinc-300" />
        </div>

        {selectedFile ? (
          <div className="space-y-1">
            <span className="text-sm font-medium text-emerald-400 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              {selectedFile.name}
            </span>
            <span className="text-xs text-zinc-500">
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click or drop another file to replace
            </span>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-zinc-300">
              <span className="text-emerald-400 font-medium">Click to browse</span> or drag audio file here
            </p>
            <p className="text-xs text-zinc-500">
              Supports MP3, M4A, WAV, WebM, AAC, OGG (up to 50MB)
            </p>
          </div>
        )}
      </div>

      {/* Title Input & Upload Action */}
      {selectedFile && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Note Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Brainstorm with Sarah regarding pricing"
              className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <button
            onClick={uploadFile}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-semibold text-sm shadow-lg shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading & Triggering Local Transcription...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Upload & Transcribe Note</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}
    </div>
  );
}
