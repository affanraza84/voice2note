# Production Deployment & Serverless Architecture Guide

This guide details how Voice2Note is deployed to production serverless environments (such as Vercel or AWS Lambda), the root causes of serverless filesystem failures, and how the storage and AI architectures are decoupled between Local and Production modes.

---

## 1. Root Cause Analysis

### The Error
```text
ENOENT: no such file or directory, mkdir '/var/task/data/audio'
```

### Why Did This Occur?
1. **Serverless Filesystem Immutability**: On Vercel (and underlying AWS Lambda runtimes), the application code bundle is unpacked into `/var/task`. This entire directory tree is mounted as **read-only**. Any call to `fs.mkdirSync('/var/task/data/audio')` or `fs.writeFileSync(...)` immediately fails with `ENOENT` or `EROFS` (Read-only file system).
2. **Untracked Directories**: The `data/` directory was appropriately listed in `.gitignore`. Consequently, `/var/task/data` did not exist in the deployed bundle, causing `mkdir` to fail when attempting to write to the read-only bundle root.
3. **Application Code vs. Persistent Storage**: Application code must never assume that the local container filesystem is persistent. Serverless functions spin up and terminate ephemerally. Files saved on local disk do not persist between invocations or across different lambda worker instances.

---

## 2. The Architectural Fix

We introduced a clean separation of concerns using the **Provider Pattern**:

```text
                     AudioStorageProvider (Interface)
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
   LocalAudioStorage                              VercelBlobAudioStorage
   (Used on Localhost)                            (Used in Production)
   • Writes to ./data/audio                       • Writes to Vercel Blob Object Storage
   • Normalized WAV cached on disk                • Returns durable CDN URLs
   • Zero cloud dependencies                      • Ephemerally downloads to /tmp for processing
```

### Serverless Audio Processing Lifecycle
When audio needs to be processed by a speech recognition model requiring a local file handle:

```text
Persistent Object Storage (Vercel Blob)
                  │
                  ▼ (Download)
/tmp/voice2note-proc/<id>-recording.webm
                  │
                  ▼
          Speech Processing
                  │
                  ▼ (cleanup hook)
          Immediate Unlink / Deletion
```

The lifecycle is wrapped in a strict `try ... finally` block:
```typescript
const processingFile = await storage.getFilePathForProcessing(note.id, note.audioFileName);
try {
  result = await speechProvider.transcribe({ filePath: processingFile.filePath, ... });
} finally {
  await processingFile.cleanup(); // Guarantees /tmp file is deleted
}
```

---

## 3. Database Persistence

### Current Implementation
- **Localhost**: Writes to `./data/voice2note.db` using `better-sqlite3` with WAL mode.
- **Serverless Fallback**: Detects `process.env.VERCEL` and writes to `/tmp/voice2note-data/voice2note.db`. If shared-memory WAL is unsupported in the serverless environment, it falls back safely to standard `DELETE` journal mode.
- **Custom Persistent Volume**: Supports `SQLITE_DB_PATH` to allow mounting persistent storage or network filesystems.

> [!WARNING]
> While SQLite in `/tmp` enables serverless testing and demo execution without crashing, data in `/tmp` is ephemeral and is cleared when serverless container instances cold-restart. For permanent multi-user production persistence across cold restarts, set `SQLITE_DB_PATH` to a mounted volume or migrate SQLite queries to a hosted database such as Neon or Supabase Postgres.

---

## 4. Local AI vs. Production Serverless Reality

### The Fundamental Difference
- **Localhost**: Ollama runs on `http://127.0.0.1:11434` directly on the developer's computer.
- **Serverless**: Vercel executes code in isolated cloud containers. `127.0.0.1` refers to the container itself, **not** your development laptop. Local Ollama cannot be reached from Vercel unless exposed via an external public tunnel or remote endpoint.

### Dual-Mode AI Strategy

| Component | Local Development Mode | Production Serverless Mode |
| :--- | :--- | :--- |
| **Speech Recognition** | In-Process Whisper (`Xenova/whisper-tiny.en` via ONNX) + FFmpeg | Remote Whisper (`whisper-large-v3-turbo` via Groq/OpenAI API) or in-process ONNX |
| **LLM Synthesis** | Local Ollama (`llama3.2:latest` at `127.0.0.1:11434`) | Remote OpenAI-compatible API (Groq `llama-3.3-70b-versatile` or OpenAI) |
| **Embeddings** | In-Process MiniLM (`Xenova/all-MiniLM-L6-v2` via ONNX) | In-Process MiniLM (`env.cacheDir = '/tmp/transformers-cache'`) |
| **Audio Storage** | Local Disk (`./data/audio`) | Vercel Blob Object Storage |

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
      "provider": "remote-whisper",
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

5. **Deploy**:
   - Trigger deployment.
   - Once complete, verify at `https://<your-project>.vercel.app/api/health`.
