# Local AI Setup & Model Diagnostics — Voice2Note

Voice2Note is built with a **100% on-device, local-first AI architecture**. No raw audio recordings, transcripts, or personal knowledge vectors leave your machine.

---

## 1. Speech-to-Text: Local Whisper

### Engine
- **Provider:** `LocalSpeechProvider` (implements `SpeechProvider`)
- **Runtime:** ONNX Runtime via `@xenova/transformers` (running in Node.js process)
- **Model:** `Xenova/whisper-tiny.en` (quantized ONNX, ~40MB)
- **Fallback / Swappable:** `whisper.cpp` / `faster-whisper`

### Audio Processing Pipeline
1. Ingestion via browser microphone (`audio/webm` via MediaRecorder) or file upload (`.webm`, `.wav`, `.mp3`, `.m4a`, `.aac`, `.ogg`).
2. Transcoding: Handled locally via FFmpeg to 16kHz mono 16-bit PCM WAV.
3. Decoding: PCM Float32Array extracted via `wavefile`.
4. Inference: Local Whisper model transcribes speech with chunked timestamp detection.
5. Storage: Transcript and timestamped segments saved to local SQLite (`data/voice2note.db`).

---

## 2. LLM Engine: Local Ollama

Voice2Note connects locally to [Ollama](https://ollama.ai) over `http://localhost:11434`.

### Recommended Models
- **`llama3.2:3b`** (Default — fastest and highly capable structured output)
- **`llama3.2:1b`** (Low-resource machines)
- **`qwen2.5:3b`** (Alternative high-precision reasoning)

### Checking Ollama Status
```bash
# Verify Ollama is running
curl -s http://localhost:11434/api/tags

# Pull recommended model
ollama pull llama3.2:latest
```

When Ollama is online, Voice2Note automatically detects the active model and marks the system as `● Local AI Ready`.

---

## 3. Supported Audio Formats

| Format | Extension | Ingestion Method | Transcoding Strategy |
|---|---|---|---|
| **WebM** | `.webm` | Browser MediaRecorder / Upload | Transcoded to 16kHz WAV via FFmpeg |
| **WAV** | `.wav` | Native microphone / Upload | Decoded directly or normalized |
| **M4A / AAC** | `.m4a`, `.aac` | Voice Memos / Mobile Upload | Transcoded via FFmpeg |
| **MP3** | `.mp3` | Upload | Transcoded via FFmpeg |
| **OGG / FLAC** | `.ogg`, `.flac` | Upload | Transcoded via FFmpeg |

**Size Limit:** 50MB per recording.

---

## 4. Environment & Prerequisites

* **Node.js:** v18+ (tested on Node v25.2.0 on Apple Silicon M4).
* **FFmpeg / FFprobe:** Required for audio transcoding and duration detection (`brew install ffmpeg`).
* **Ollama (Optional for Phase 2, Required for Phase 3):** Available at `http://localhost:11434`.

---

## 5. Troubleshooting

### Issue: Microphone Permission Denied
* **Cause:** Browser blocked access to `navigator.mediaDevices.getUserMedia`.
* **Fix:** Click the lock icon in the browser address bar, set "Microphone" to "Allow", and reload. Alternatively, record on your phone and use the "Upload File" tab.

### Issue: Transcription Fails with "Audio file not found"
* **Cause:** Missing file in `data/audio/`.
* **Fix:** Ensure write permissions exist on the `data/audio/` directory.

### Issue: Ollama Shows Offline in Local AI Badge
* **Cause:** Ollama background service is not running.
* **Fix:** Run `ollama serve` in a terminal window.
