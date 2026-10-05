# Local AI Setup, Browser Inference & Model Diagnostics — Voice2Note

Voice2Note is built with a **local-first, transparent AI architecture**. It delivers on-device processing where possible while remaining completely honest about model fetching, browser capabilities, and deployed execution.

---

## 1. Speech-to-Text: Dual-Mode Whisper Architecture

Voice2Note implements a dual-mode Whisper pipeline designed to work both on local developer machines and deployed serverless web environments:

```text
                           Audio Input
                                │
                                ▼
               Browser Web Audio Preprocessing
             (AudioContext decode + sinc resampling)
                                │
               ┌────────────────┴────────────────┐
               ▼                                 ▼
      [In-Browser Whisper]              [Server Whisper / API]
   • WebGPU / WASM SIMD               • Local Node.js ONNX
   • @xenova/transformers             • Or Remote Whisper fallback
   • 100% on-device audio             • 16kHz PCM WAV directly
```

### Mode A: In-Browser Whisper (Client-Side)
- **Engine:** `@xenova/transformers` running directly in the user's browser tab.
- **Model:** `Xenova/whisper-tiny.en` (quantized ONNX, ~40MB).
- **Execution Providers:**
  1. **WebGPU:** Hardware-accelerated via `navigator.gpu` (Chrome 113+, Edge 113+, Safari 18+).
  2. **WASM SIMD:** High-speed CPU fallback via WebAssembly when WebGPU is unavailable.
- **Audio Privacy:** Audio never leaves the browser. The raw PCM Float32Array is transcribed directly inside the tab.
- **Model Assets:** ONNX model weights and tokenizer configs are fetched **once** from the Hugging Face CDN and cached indefinitely in browser `CacheStorage`. Subsequent runs are 100% offline.
- **Watchdog Timer:** 45-second watchdog timer prevents indefinite hangs, displaying actionable troubleshooting guidance if device memory or acceleration is constrained.

### Mode B: Local Node.js Whisper (Server / Desktop)
- **Engine:** `LocalSpeechProvider` running in the Node.js backend.
- **Runtime:** ONNX Runtime via `@xenova/transformers`.
- **Model:** `Xenova/whisper-tiny.en` cached in local `./data/models/`.

---

## 2. Browser Audio Preprocessing (Zero FFmpeg Dependency)

In standard serverless deployments (such as Vercel), `ffmpeg` is not installed, which historically caused serverless audio transcoding crashes. 

Voice2Note solves this by performing **hardware-accelerated audio normalization natively in the browser** before upload:

```text
Browser MediaRecorder (WebM/Opus or MP4/AAC)
                   │
                   ▼
  AudioContext.decodeAudioData()
                   │
                   ▼
  Resample to 16,000 Hz Mono Float32Array (OfflineAudioContext)
                   │
                   ▼
  encode16BitWavBlob() (Pure JS RIFF/WAVE encoder)
                   │
  ┌────────────────┴────────────────┐
  ▼                                 ▼
Passed to Browser Whisper      Uploaded to Server as 16kHz WAV
(Float32Array)                (Requires zero server transcoding!)
```

This guarantees:
- **No FFmpeg required** on serverless environments.
- Fast, instantaneous client-side processing.
- Clean 16-bit 16kHz mono audio that any Whisper model expects.

---

## 3. LLM Intelligence Engine

### Local Development Mode
- **Engine:** Local [Ollama](https://ollama.ai) daemon over `http://localhost:11434`.
- **Model:** `llama3.2:3b` (default), `llama3.2:1b`, or `qwen2.5:3b`.
- **Privacy:** All prompt completions, entity extractions, and knowledge synthesis occur on your local GPU/CPU.

### Production Serverless Mode
- When deployed to cloud environments like Vercel, the server container cannot access your private `localhost:11434` without a secure tunnel.
- In production, configure an OpenAI-compatible remote provider (such as Groq with `llama-3.3-70b-versatile` or OpenAI) via `GROQ_API_KEY` or `AI_API_KEY`.
- If no remote key is configured, Voice2Note cleanly enters Standby mode, preserving the recording and transcript in IndexedDB without crashing.

---

## 4. Model Asset Downloads vs. Privacy Disclosure

We maintain a strict distinction between **model downloading** and **data transmission**:

| Concept | What It Means | Voice2Note Guarantee |
|---|---|---|
| **Model Download** | Downloading static model weights (e.g. 40MB ONNX files) from Hugging Face. | Occurs on initial load over HTTPS; weights are cached locally. |
| **Data Transmission** | Sending user recordings, transcripts, or notes to an external AI server. | **Zero audio transmission** when using in-browser Whisper or local Ollama. |

The application never misleadingly claims "100% offline from birth" without explaining that model files must first be downloaded into the browser cache.

---

## 5. Client Persistence via IndexedDB

To prevent loss of recordings or notes during serverless cold starts or network drops, Voice2Note maintains a complete **client-side IndexedDB storage layer** (`client-db.ts`):

- **Automatic Mirroring:** Every note recorded or transcribed in the browser is saved in IndexedDB (`voice2note_client_db`).
- **Audio Blob Preservation:** The raw 16kHz WAV audio blob is saved locally. If downstream network requests fail, the user can play back their recording and retry transcription with a single click.
- **Archive Resilience:** The `/notes` archive automatically merges server notes with locally cached client notes.

---

## 6. Built-in Diagnostics Panel

Voice2Note includes an integrated, real-time diagnostic panel accessible from the Recorder:

- **Microphone Access:** Validates `navigator.mediaDevices.getUserMedia` permissions.
- **MediaRecorder:** Verifies supported audio MIME types (`audio/webm`, `audio/mp4`).
- **Web Audio API:** Tests `AudioContext` and `OfflineAudioContext` for 16kHz resampling.
- **WebGPU Acceleration:** Queries `navigator.gpu` adapter status.
- **WebAssembly (WASM):** Validates WASM SIMD capability.
- **Browser Whisper:** Tests model readiness and execution provider fallback.
- **IndexedDB:** Confirms client-side persistence availability.
- **Server Health:** Checks `/api/status` backend connection.

---

## 7. Supported Browsers & System Requirements

| Browser | WebGPU Acceleration | WASM SIMD Fallback | Microphone Recording |
|---|---|---|---|
| **Google Chrome 113+** | Full Hardware Acceleration | Supported | Supported |
| **Microsoft Edge 113+** | Full Hardware Acceleration | Supported | Supported |
| **Apple Safari 18+ (macOS/iOS)** | Supported (macOS 15+ / iOS 18+) | Supported | Supported |
| **Mozilla Firefox 120+** | Experimental | Supported | Supported |

**Recommended Device Specifications:**
- **RAM:** Minimum 4GB (8GB+ recommended for snappy model execution).
- **Disk Space:** ~50MB for cached Whisper model assets.
