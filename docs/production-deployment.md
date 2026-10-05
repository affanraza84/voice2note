# Production Deployment & Serverless Architecture Guide

This guide details how Voice2Note is deployed to production serverless environments (such as Vercel or AWS Lambda), the root causes of serverless filesystem failures, and how the storage and AI architectures are decoupled between Local and Production modes.

---

## 1. Root Cause Analysis & Production Fixes

### Issue 1: Serverless Filesystem Immutability
```text
ENOENT: no such file or directory, mkdir '/var/task/data/audio'
```
- **Why Did This Occur?** On Vercel and AWS Lambda runtimes, the application code bundle is unpacked into `/var/task` as a **read-only** filesystem. Any call to create directories or files in `/var/task` fails immediately.
- **The Solution:** We decoupled audio storage using the `AudioStorageProvider` abstraction:
  - **Local Development:** Uses `LocalAudioStorage` writing to `./data/audio`.
  - **Production:** Uses `VercelBlobAudioStorage` (backed by `@vercel/blob`) with ephemeral, auto-cleaned temporary files in `/tmp` when necessary.

### Issue 2: Serverless FFmpeg Absence
- **Why Did This Occur?** In serverless containers, `ffmpeg` is not pre-installed in the runtime. Previous pipelines called `ffmpeg` to transcode incoming WebM/Opus blobs to 16kHz WAV, causing `ENOENT: spawn ffmpeg`.
- **The Solution:** We moved audio normalization entirely into the **browser's native Web Audio API** (`src/lib/audio/browser-audio.ts`). The client resamples and encodes audio directly into 16-bit 16kHz mono WAV before uploading. The server receives a clean WAV file and never needs FFmpeg.

### Issue 3: Status Badge Stuck on "Initializing"
- **Why Did This Occur?** The status badge polled `GET /api/status`, which invoked `LocalSpeechProvider.isReady()`. That method attempted to download the full 150MB ONNX model from Hugging Face on every check, hitting serverless execution timeouts and returning `false` continuously.
- **The Solution:**
  1. `isReady()` was updated to perform an instantaneous module/runtime check without blocking model downloads.
  2. The status badge reflects transparent states (`Local AI Ready`, `Local Speech Ready (Cloud LLM Standby)`, or clear offline badges) with manual refresh buttons and detailed diagnostic breakdown.

---

## 2. Audio Processing Lifecycle

```text
               1. Browser Microphone Recording
                              │
                              ▼
        2. Client Web Audio Preprocessing & Normalization
         (AudioContext.decodeAudioData + sinc resampling)
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
   [In-Browser Whisper]             [Upload 16kHz WAV]
    Transcribes directly              (To /api/notes)
    in tab (zero egress)                     │
               │                             ▼
               │                3. Persistent Storage
               │                  • Local Disk (Localhost)
               │                  • Vercel Blob (Production)
               │                             │
               └──────────────┬──────────────┘
                              ▼
                  4. Note Persistence
                   • Server Database (SQLite)
                   • Client IndexedDB (Resilience mirror)
                              │
                              ▼
                  5. AI Extraction & RAG
                   • Ollama (Localhost)
                   • OpenAI/Groq API (Production)
```

---

## 3. Observable State Machine

To eliminate opaque freezes and ensure every stage of processing is visible to the user, Voice2Note implements an explicit state machine:

```text
idle
 ↓
loading-model
 ↓
model-ready
 ↓
recording
 ↓
recording-stopped
 ↓
preparing-audio
 ↓
transcribing
 ↓
transcription-complete
 ↓
saving
 ↓
analyzing
 ↓
indexing
 ↓
ready
```

**Recoverable Failure States:**
- `model-load-failed`: Model assets could not be downloaded; user is provided with a one-click Retry button.
- `audio-processing-failed`: Recording could not be decoded by Web Audio API; raw audio is preserved.
- `transcription-failed`: Transcription encountered an error; audio is preserved in IndexedDB with a "Retry Processing" option.
- `storage-failed`: Cloud network request failed; note and audio remain intact in client IndexedDB.

---

## 4. Dual-Mode AI Strategy

| Component | Local Development Mode | Production Serverless Mode |
| :--- | :--- | :--- |
| **Speech Recognition** | In-Browser Whisper (WebGPU/WASM) or Local Node.js ONNX | In-Browser Whisper or Cloud Whisper (Groq/OpenAI) |
| **Audio Preprocessing** | Browser Web Audio API (16kHz Mono Float32 + WAV) | Browser Web Audio API (Zero server FFmpeg needed) |
| **LLM Synthesis** | Local Ollama (`llama3.2:3b` at `127.0.0.1:11434`) | Remote OpenAI-compatible API (Groq `llama-3.3-70b-versatile` or OpenAI) |
| **Embeddings** | In-Process MiniLM (`Xenova/all-MiniLM-L6-v2` via ONNX) | In-Process MiniLM (`env.cacheDir = '/tmp/transformers-cache'`) |
| **Audio Storage** | Local Disk (`./data/audio`) | Vercel Blob Object Storage |
| **Client Persistence** | IndexedDB (`voice2note_client_db`) | IndexedDB (`voice2note_client_db`) |

---

## 5. Environment Variables for Production

To deploy to Vercel, configure these environment variables in your project settings:

```bash
# Required: Persistent object storage for audio files
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# Required for Production AI: API key for remote model inference
# (Supports Groq, OpenAI, Together AI, or any OpenAI-compatible provider)
GROQ_API_KEY=gsk_...
# OR
AI_API_KEY=...
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=llama-3.3-70b-versatile
```

---

## 6. Health & Diagnostics Endpoint

Voice2Note exposes an unauthenticated health check endpoint:

```http
GET /api/health
```

### Sample Response:
```json
{
  "status": "ok",
  "service": "Voice2Note",
  "environment": "production",
  "serverless": true,
  "storage": {
    "provider": "vercel-blob",
    "persistent": true
  },
  "ai": {
    "speech": {
      "provider": "local-whisper",
      "ready": true
    },
    "llm": {
      "provider": "remote-llm",
      "ready": true
    },
    "embeddings": {
      "provider": "local-minilm",
      "dimensions": 384
    }
  },
  "timestamp": "2026-10-05T15:45:00.000Z"
}
```

No secrets, keys, or internal filesystem paths are exposed.

---

## 7. Step-by-Step Vercel Deployment

1. **Push to GitHub**:
   ```bash
   git push origin main
   ```

2. **Import Project into Vercel**:
   - Framework Preset: **Next.js**
   - Root Directory: `./`

3. **Enable Vercel Blob**:
   - In the Vercel Dashboard, go to **Storage** → **Create Database** → **Blob**.
   - Connect the Blob store to your Voice2Note project. Vercel automatically injects `BLOB_READ_WRITE_TOKEN`.

4. **Add AI Environment Variables**:
   - Go to **Project Settings** → **Environment Variables**.
   - Add `GROQ_API_KEY` (or `AI_API_KEY` + `AI_BASE_URL`).

5. **Deploy & Verify**:
   - Trigger deployment.
   - Once complete, verify at `https://<your-project>.vercel.app/api/health`.
