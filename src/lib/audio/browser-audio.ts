/**
 * Browser Audio Preprocessing & Normalization Engine
 * 
 * Converts raw browser MediaRecorder Blobs (WebM/Opus, MP4/AAC, etc.)
 * into standardized 16kHz Mono Float32Array and standard 16-bit PCM WAV Blobs.
 * 
 * Uses Web Audio API (AudioContext + OfflineAudioContext) for hardware-accelerated
 * anti-aliased sinc resampling and mono downmixing with zero FFmpeg dependencies.
 */

export interface PreprocessedAudio {
  pcmFloat32: Float32Array;
  wavBlob: Blob;
  durationSeconds: number;
  sampleRate: number;
  channelCount: number;
}

export function validateRecordedBlob(blob: Blob | null): { valid: boolean; error?: string } {
  if (!blob) {
    return { valid: false, error: 'No audio data was recorded.' };
  }

  if (blob.size === 0) {
    return { valid: false, error: 'Recorded audio is empty (0 bytes).' };
  }

  if (blob.size < 1024) {
    return { valid: false, error: 'Recording is too short to contain audible speech.' };
  }

  const maxBytes = 50 * 1024 * 1024; // 50MB
  if (blob.size > maxBytes) {
    return { valid: false, error: `Recording exceeds 50MB limit (${(blob.size / (1024 * 1024)).toFixed(1)}MB).` };
  }

  return { valid: true };
}

/**
 * Decodes and resamples any browser audio blob to 16,000 Hz Mono Float32 PCM.
 */
export async function preprocessAudioForWhisper(blob: Blob): Promise<PreprocessedAudio> {
  const validation = validateRecordedBlob(blob);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const arrayBuffer = await blob.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error('Audio ArrayBuffer is empty.');
  }

  // 1. Decode audio using native AudioContext
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API is not supported in this browser.');
  }

  const audioCtx = new AudioContextClass();
  let decodedBuffer: AudioBuffer;

  try {
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (decodeErr: any) {
    console.error('[Voice2Note] AudioContext decodeAudioData error:', decodeErr);
    throw new Error(`Failed to decode recorded audio: ${decodeErr?.message || 'Unsupported format'}`);
  } finally {
    if (audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  }

  const durationSeconds = Math.max(0.1, Math.round(decodedBuffer.duration * 10) / 10);
  const targetSampleRate = 16000;

  // 2. Resample and mixdown to 16kHz Mono using OfflineAudioContext
  let pcmFloat32: Float32Array;

  try {
    const OfflineContextClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (OfflineContextClass) {
      const targetFrames = Math.ceil(decodedBuffer.duration * targetSampleRate);
      const offlineCtx = new OfflineContextClass(1, targetFrames, targetSampleRate);

      const bufferSource = offlineCtx.createBufferSource();
      bufferSource.buffer = decodedBuffer;
      bufferSource.connect(offlineCtx.destination);
      bufferSource.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      pcmFloat32 = renderedBuffer.getChannelData(0);
    } else {
      // Fallback: manual channel downmix + linear resampling
      pcmFloat32 = manualResampleTo16kMono(decodedBuffer, targetSampleRate);
    }
  } catch (renderErr) {
    console.warn('[Voice2Note] OfflineAudioContext resampling failed, using fallback:', renderErr);
    pcmFloat32 = manualResampleTo16kMono(decodedBuffer, targetSampleRate);
  }

  // 3. Encode into 16-bit 16kHz WAV Blob
  const wavBlob = encode16BitWavBlob(pcmFloat32, targetSampleRate);

  return {
    pcmFloat32,
    wavBlob,
    durationSeconds,
    sampleRate: targetSampleRate,
    channelCount: 1,
  };
}

/**
 * Manual downmixing and linear interpolation resampler fallback
 */
function manualResampleTo16kMono(buffer: AudioBuffer, targetRate: number): Float32Array {
  const numChannels = buffer.numberOfChannels;
  const inRate = buffer.sampleRate;
  const inLength = buffer.length;

  // Downmix to mono float32
  const mono = new Float32Array(inLength);
  for (let c = 0; c < numChannels; c++) {
    const channelData = buffer.getChannelData(c);
    for (let i = 0; i < inLength; i++) {
      mono[i] += channelData[i] / numChannels;
    }
  }

  if (inRate === targetRate) {
    return mono;
  }

  // Linear interpolation
  const ratio = inRate / targetRate;
  const outLength = Math.round(inLength / ratio);
  const resampled = new Float32Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const origIndex = i * ratio;
    const lower = Math.floor(origIndex);
    const upper = Math.min(lower + 1, inLength - 1);
    const weight = origIndex - lower;
    resampled[i] = mono[lower] * (1 - weight) + mono[upper] * weight;
  }

  return resampled;
}

/**
 * Encodes Float32Array audio samples into standard 16-bit PCM WAV Blob
 */
export function encode16BitWavBlob(samples: Float32Array, sampleRate = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(view, 8, 'WAVE');

  // fmt chunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample

  // data chunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write Float32 to 16-bit PCM samples with clipping guard
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeAscii(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
