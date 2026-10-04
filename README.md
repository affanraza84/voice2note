# Voice2Note 🎙️ ➔ 🧠

> *Turn messy voice recordings into searchable, actionable personal knowledge — privately.*

Voice2Note is a local-first voice intelligence platform built for people who record spontaneous voice notes throughout the day but struggle to organize, search, or act on what they said.

Unlike cloud-based transcription tools, Voice2Note executes **100% on-device**: local speech recognition (Whisper ONNX), local intelligence extraction (Ollama Llama 3.2), and local vector search (SQLite) — ensuring your personal reflections never leave your machine.

---

## ✨ Features (Phase 2 Implemented)

- **🎙️ Live In-Browser Recorder:** HTML5 Canvas waveform visualizer, pause/resume, timer, playback preview, and discard/save.
- **📁 Universal Audio Uploader:** Drag-and-drop support for `.webm`, `.wav`, `.mp3`, `.m4a`, `.aac`, `.ogg` with format & size validation.
- **⚡ Local Speech-to-Text:** In-process Whisper (`whisper-tiny.en`) running via ONNX Runtime without cloud dependencies or API keys.
- **⏱️ Timestamped Segments:** Read transcripts as continuous prose or interactive timestamped segments that jump playback.
- **🔒 Zero Cloud Egress:** Audio files stay in `data/audio/`, metadata in `data/voice2note.db`. Streaming happens via secure internal endpoints (`/api/audio/[id]`).
- **🟢 Real-Time Local AI Diagnostics:** Status badge monitoring on-device Whisper engine, Ollama connectivity, and background queues.
- **👤 Configurable Friend Persona:** Customize the target friend's name, problem statement, and workflow in Settings.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** v20+ (tested on Node v25 on macOS Apple Silicon M4)
- **FFmpeg & FFprobe:** `brew install ffmpeg`
- **Ollama (for LLM reasoning):** `ollama pull llama3.2:latest`

### 2. Install & Run
```bash
# Clone and enter repo
cd voice2note

# Install dependencies
npm install

# Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Code Quality

```bash
# Run unit & integration tests
npm test

# Run TypeScript typecheck
npm run typecheck

# Run ESLint
npm run lint

# Build production bundle
npm run build
```

---

## 📁 Repository Structure

```text
voice2note/
├── src/
│   ├── app/                    # Next.js App Router (pages & API routes)
│   │   ├── api/
│   │   │   ├── audio/[id]/     # Secure audio streaming with Range headers
│   │   │   ├── notes/          # Notes listing & audio upload
│   │   │   ├── notes/[id]/     # Note detail, title update & delete
│   │   │   ├── settings/       # Friend persona configuration
│   │   │   └── status/         # Local AI diagnostics
│   │   ├── notes/              # Notes archive view
│   │   ├── notes/[id]/         # Note detail (player + transcript)
│   │   ├── record/             # Audio recording & upload studio
│   │   ├── search/             # Knowledge search
│   │   ├── ask/                # Ask My Notes conversational RAG
│   │   └── settings/           # Persona & AI settings
│   ├── components/
│   │   ├── layout/             # AppShell, Sidebar, LocalAIStatusBadge
│   │   ├── recorder/           # AudioRecorder with Canvas waveform
│   │   ├── uploader/           # Drag-and-drop AudioUploader
│   │   └── notes/              # AudioPlayer, TranscriptView, NoteCard
│   ├── lib/
│   │   ├── ai/                 # Decoupled AI abstractions (Speech, LLM, Embeddings)
│   │   │   ├── types.ts        # Provider interfaces
│   │   │   └── speech/         # LocalSpeechProvider (Whisper ONNX)
│   │   ├── db/                 # SQLite database & data access layer
│   │   ├── storage/            # Audio file storage & FFmpeg transcoding
│   │   └── processing/         # Background transcription pipeline
│   └── types/                  # Domain entity definitions
├── tests/                      # Vitest test suite
├── docs/
│   ├── architecture.md         # Full system architecture & Mermaid diagrams
│   └── local-ai.md             # Local AI models & troubleshooting
└── data/                       # Local database & audio storage (git-ignored)
```

---

## 🗺️ Roadmap
- [x] **Phase 1:** Product Discovery, Requirements & System Architecture
- [x] **Phase 2:** Core Application + Voice Recording + Local Transcription
- [ ] **Phase 3:** Open-Weight LLM Intelligence Extraction (Tasks, Ideas, Decisions)
- [ ] **Phase 4:** Local Knowledge Base + "Ask My Notes" RAG Interface
- [ ] **Phase 5:** Final UX Polish, Differentiator & Demonstration
