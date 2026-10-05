# Local Development Guide — Voice2Note

Voice2Note is designed from the ground up to be a **local-first, privacy-respecting AI knowledge base**. In Local Mode, all audio processing, speech recognition, structured extraction, embedding generation, and vector search occur entirely on your local machine with zero external API calls.

---

## 1. Prerequisites

- **Node.js**: v20 or higher
- **FFmpeg**: Required locally for audio format conversion and sample rate normalization:
  - macOS: `brew install ffmpeg`
  - Linux: `sudo apt install ffmpeg`
  - Windows: `winget install Gyan.FFmpeg`
- **Ollama**: Required for local LLM extraction and RAG synthesis:
  - Install from [ollama.ai](https://ollama.ai)
  - Pull the target open-weight model:
    ```bash
    ollama run llama3.2:latest
    ```

---

## 2. Quick Start

1. **Clone & Install Dependencies**:
   ```bash
   git clone git@github.com:affanraza84/voice2note.git
   cd voice2note
   npm install
   ```

2. **Start Ollama Service**:
   ```bash
   ollama serve
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```

4. **Open in Browser**:
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## 3. Local Architecture & Data Flow

```text
Browser Microphone (MediaRecorder)
       │
       ▼
Next.js API Route (/api/notes)
       │
       ▼
Local Filesystem Storage (./data/audio/<uuid>.webm)
       │
       ▼
Local FFmpeg (Transcodes to 16kHz WAV in ./data/audio/<uuid>_16k.wav)
       │
       ▼
Local Whisper (Xenova/whisper-tiny.en running via ONNX in Node process)
       │
       ▼
Local SQLite DB (./data/voice2note.db)
       │
       ▼
Local Ollama (Llama 3.2 via http://127.0.0.1:11434)
       │
       ▼
Local MiniLM (Xenova/all-MiniLM-L6-v2 via ONNX in Node process)
       │
       ▼
Local Vector Chunks (SQLite with dot-product cosine similarity)
```

---

## 4. Privacy & Offline Guarantees

In Local Mode:
- **No telemetry or external network calls**: Your recordings and transcripts never leave your machine.
- **Persistent local database**: Notes, tags, tasks, ideas, decisions, and embeddings are stored in `./data/voice2note.db`.
- **Zero API keys**: No third-party API keys or accounts are required.

---

## 5. Verification Commands

Run the full test suite and quality checks locally:

```bash
# Typecheck
npm run typecheck

# Code formatting and linting
npm run lint

# Unit and integration test suites
npm run test

# Production build verification
npm run build
```
