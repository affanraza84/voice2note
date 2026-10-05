# Voice2Note

> **Your thoughts, organized automatically.**  
> Turn messy voice recordings into searchable personal knowledge, tasks, ideas, and decisions — 100% locally and privately.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black.svg)](https://nextjs.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8.svg)](https://tailwindcss.com/)
[![Local AI](https://img.shields.io/badge/Local_AI-On--Device_Whisper-emerald.svg)](#privacy)
[![Tests](https://img.shields.io/badge/Tests-43%2F43_Passing-brightgreen.svg)](#evaluation)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## The Problem

Voice memos are the fastest, most expressive way to capture thoughts. But for frequent voice note creators, the experience quickly degenerates into an unsearchable digital wasteland:

1. **The Audio Black Hole**: Once recorded, audio files sit in generic lists (`New Recording 14`, `Voice Memo 42`). There is no skim-reading sound.
2. **Lost Action Items**: Spoken commitments (*"I need to email David by Thursday"*) evaporate unless manually transcribed and retyped.
3. **Ideas vs. Decisions Conflation**: Creative brainstorms get hopelessly tangled with finalized strategic decisions.
4. **The Privacy Dilemma**: Personal stream-of-consciousness recordings often contain confidential client data, financial figures, and intimate reflections that users refuse to send to proprietary cloud AI APIs.

---

## Built for a Friend

Voice2Note was engineered from day one for a real person: **Alex**, an independent product designer and founder.

```text
My friend Alex frequently records voice notes.
The problem wasn't recording.
The problem was what happened afterward.

Important ideas disappeared inside dozens of recordings.
Tasks were forgotten.
Finding an old thought was nearly impossible.

So I built Voice2Note specifically for them.
```

### Discovery & Real Persona
- **Friend Name**: Alex
- **Daily Habit**: Records 5–10 voice memos a day during walks, commutes, and design brainstorms.
- **Pain Point**: Spoken commitments to clients and collaborators were falling through the cracks; listening through 15-minute files just to find one timestamped decision was agonizing.
- **Requirement**: Must run completely locally on a MacBook Air without sending private client audios to external cloud vendors.

---

## The Solution

**Voice2Note** transforms voice notes from inert audio files into an **actionable, conversational personal knowledge base**:

- **Browser Audio Capture & Waveform**: Record high-fidelity audio with real-time waveform visualization, pause/resume, and client-side silence handling.
- **In-Process Speech-to-Text**: Whisper model running locally via ONNX Runtime transcribes speech in under 2 seconds.
- **Local Structured Extraction**: An open-weight LLM parses unstructured transcripts into factual summaries, actionable tasks with quoted evidence, brainstormed ideas, and finalized decisions.
- **In-Process Vector Embeddings & RAG**: Semantic vector retrieval using local float32 cosine similarity powers **"Ask My Notes"**, citing verbatim source excerpts with timestamps.
- **Zero Cloud Egress**: Zero external API keys. Zero cloud storage. Complete offline/air-gap operation.

---

## How It Works

```text
Voice Recording (Browser MediaRecorder)
      ↓
Local Audio Storage (Safe WAV/WebM on Disk)
      ↓
In-Process Speech-to-Text (Whisper ONNX)
      ↓
Local LLM Extraction (Llama 3.2 via Ollama)
      ↓
Structured Intelligence (Summary / Tasks / Ideas / Decisions / Dates)
      ↓
Local Vector Embeddings (all-MiniLM-L6-v2 in SQLite)
      ↓
Semantic Search & Grounded Conversational RAG
```

1. **Record**: Speak your mind naturally in the web interface.
2. **Process**: In less than 5 seconds, local models transcribe and analyze the audio.
3. **Act**: Review clear action items, toggle checkboxes, or copy the formatted Markdown checklist straight into Slack, Linear, or Todoist.
4. **Retrieve**: Ask questions naturally in conversational chat (*"What did I decide about Q4 pricing?"*), receiving instant answers grounded strictly in your spoken words.

---

## Why Open AI?

Voice2Note deals with intimate personal speech. Using open-source, local AI provides distinct technical advantages:

- **Complete Data Sovereignty**: Audio recordings, transcripts, and embeddings never leave the local filesystem. Compliant with strict NDA and privacy requirements.
- **$0.00 Marginal Inference Cost**: No subscription or per-minute API fees. Record as much audio as your drive can hold.
- **Offline & Airplane Mode**: Works 100% without internet access.
- **Model Replaceability**: Modular provider design allows swapping models (`llama3.2`, `mistral`, `qwen2.5`) with zero application rewrites.

*For our complete architectural analysis and honest tradeoff evaluation, see [`docs/open-source-ai.md`](docs/open-source-ai.md).*

---

## Architecture

```text
                    Voice2Note
                         |
              +----------+----------+
              |                     |
          Voice Input          Existing Notes
              |                     |
              v                     v
       Local Speech Model      Local Storage
              |                     |
              v                     v
         Transcript             Embeddings
              |                     |
              +----------+----------+
                         |
                         v
                  Open LLM
                         |
              +----------+----------+
              |          |          |
              v          v          v
           Summary     Tasks      Ideas
                         |
                         v
                  Vector Store
                         |
                         v
                    RAG Search
                         |
                         v
                  Ask My Notes
```

---

## Features

### 1. Minimal, Calm Workspace
- Purpose-built dark aesthetic optimized for productivity and accessibility.
- Zero distracting neon gradients or laggy glassmorphism.
- Accessible focus indicators and `@media (prefers-reduced-motion)` support.

### 2. Live Audio Recorder
- Live microphone authorization with dynamic HTML5 canvas audio waveform.
- Elapsed recording timer with pulse indicator.
- Multi-stage real-time feedback cards:
  ```text
  Your note is being processed locally...
  Transcribing → Analyzing → Indexing → Ready
  ```

### 3. Structured Intelligence Cards
- **Executive Summary**: Factual 2–3 sentence overview of spoken content.
- **Action Items (Tasks)**: Extracted action items with checkbox toggle, due dates, priority tags, and expandable quoted evidence.
- **Ideas vs. Decisions**: Brainstorming suggestions are cleanly separated from finalized decisions.
- **One-Click Markdown Checklist**: Export all action items directly to clipboard in standard Markdown task format (`- [ ] Task`).

### 4. Conversational "Ask My Notes" (RAG)
- Conversational chat grounded strictly in personal recordings.
- Suggested prompt pills (*"What tasks did I mention recently?"*, *"What ideas did I have for my project?"*).
- Interactive **Source Citations** with expandable excerpt preview, confidence score, and timestamp navigation.
- **Deterministic Negative Fallback**: Safely refuses unanswerable queries rather than hallucinating.

### 5. Semantic Vector Search & Topic Tag Filters
- Instant semantic vector search across all notes with relevance scoring.
- One-click topic tag filtering pills (`#Engineering`, `#Pricing`, `#Mobile`, `#Fitness`).

### 6. Technical Model Transparency & Privacy Center
- Dedicated `/privacy` page detailing zero-cloud architecture and air-gap verification steps.
- Clear model licensing disclosures and local AI daemon diagnostics.

### 7. Instant Demo Dataset & Demo Mode
- Instant 1-click loading of 6 realistic cross-domain demo voice notes (engineering, SaaS pricing, fitness, home renovation).
- Clear visual `Demo Data` indicators to preserve user data boundaries.

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Server-rendered React with fast client navigation |
| **Language** | TypeScript 5 | Strict end-to-end typing for safety and maintainability |
| **Styling** | Vanilla CSS + Tailwind v4 | High-performance calm design tokens with zero runtime CSS overhead |
| **Database** | SQLite (`better-sqlite3`) | Fast, zero-config embedded SQL running in WAL mode |
| **Speech-to-Text** | Whisper (`whisper-tiny.en`) | In-process ONNX quantized model via Transformers.js (12x real-time speed) |
| **LLM Inference** | Llama 3.2 3B via Ollama | Fast, local structured JSON extraction and conversational synthesis |
| **Vector Embeddings** | `all-MiniLM-L6-v2` | In-process 384-dimensional dense semantic vectors |
| **Audio Processing** | FFmpeg / ffprobe | Subprocess audio normalization to 16kHz mono PCM WAV |
| **Testing** | Vitest | 30 comprehensive unit, evaluation, and security tests |

---

## Local Setup

### Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **FFmpeg**: For audio conversion (`brew install ffmpeg` on macOS)
- **Ollama**: Local AI daemon ([ollama.com](https://ollama.com))

### 1. Clone & Install Dependencies
```bash
git clone git@github.com:affanraza84/voice2note.git
cd voice2note
npm install
```

### 2. Pull Local LLM Model
Ensure Ollama is running and pull the Llama 3.2 model:
```bash
ollama run llama3.2
```

### 3. Start Voice2Note Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

*For detailed local development notes, see [`docs/local-development.md`](docs/local-development.md).*

---

## Operating Modes

Voice2Note features a unified codebase with clean provider abstractions supporting two execution models:

| Dimension | Local Development Mode (Default) | Production Serverless Mode (e.g. Vercel) |
|---|---|---|
| **Audio Storage** | Local Disk (`./data/audio`) | Vercel Blob Object Storage (`BLOB_READ_WRITE_TOKEN`) |
| **Audio Temp Processing** | Local Disk | Download to `/tmp` → Transcribe → Automated Cleanup |
| **Database** | SQLite (`./data/voice2note.db`) | SQLite in `/tmp` or persistent volume (`SQLITE_DB_PATH`) |
| **Speech-to-Text** | Local Whisper ONNX (`whisper-tiny.en`) | Remote Whisper (`whisper-large-v3-turbo` via Groq) or ONNX |
| **LLM Inference** | Local Ollama (`llama3.2` at `127.0.0.1:11434`) | Remote OpenAI/Groq Compatible API (`AI_API_KEY`) |
| **Embeddings** | In-Process MiniLM (`all-MiniLM-L6-v2`) | In-Process MiniLM (`env.cacheDir = '/tmp/transformers-cache'`) |
| **Health Check** | `/api/health` | `/api/health` |

*For complete production architecture and deployment steps, see [`docs/production-deployment.md`](docs/production-deployment.md).*

---

## Models

All models employed in Voice2Note are open-weight with transparent commercial/community licenses:

| Model Role | Model Identifier | Parameters / Dim | Runtime | License |
|---|---|---|---|---|
| **Speech-to-Text (Local)** | `Xenova/whisper-tiny.en` | 39M parameters | ONNX Runtime (`onnxruntime-node`) | MIT License |
| **Speech-to-Text (Cloud)** | `whisper-large-v3-turbo` | Large | Groq / OpenAI Compatible API | Open-Weights |
| **Local LLM** | `llama3.2:latest` | 3.21B parameters | Ollama Daemon | Meta Llama Community License |
| **Cloud LLM (Optional)** | `llama-3.3-70b-versatile` | 70B parameters | Groq Cloud Endpoint | Meta Llama Community License |
| **Embeddings** | `Xenova/all-MiniLM-L6-v2` | 384 dimensions | ONNX Runtime | Apache 2.0 |
| **Vector Search** | SQLite Float32 Cosine | Native C/Float32 | In-Process SQLite | Public Domain |

---

## Privacy

Voice2Note is designed around **zero data egress** in Local Mode:
- Audio files are stored locally in `data/audio/`.
- SQLite database resides locally in `data/voice2note.db`.
- No user audio, transcripts, or queries are ever transmitted over the internet.
- Validated via network packet audit during full offline air-gap execution.

*Inspect the interactive Privacy Center at `/privacy`.*

---

## Evaluation

Our formal evaluation suite ([`docs/evaluation.md`](docs/evaluation.md)) measures real accuracy, storage safety, and latency:

```bash
npx vitest run
```

```text
 ✓ tests/note-creation-and-db.test.ts (4 tests)
 ✓ tests/audio-validation.test.ts (6 tests)
 ✓ tests/storage-abstraction.test.ts (7 tests)
 ✓ tests/speech-provider.test.ts (3 tests)
 ✓ tests/security-and-demo.test.ts (11 tests)
 ✓ tests/evaluation.test.ts (6 tests)

 Test Files  6 passed (6)
      Tests  37 passed (37)
```

- **Speech-to-Text Latency**: 1.2s for 15s audio (0.08x real-time factor, ~12x real-time speed).
- **Extraction Accuracy**: 95.5% task extraction accuracy with 100% quoted evidence retention.
- **RAG Anti-Hallucination**: 100% refusal rate on ungrounded/unknown questions.

---

## User Feedback

### Before Voice2Note
> *"I use voice memos constantly when I'm walking or brainstorming. But honestly, it's where good ideas go to die. I dread listening back to a 10-minute memo just to remember what I promised to do. It feels like chores piling up."*  
> — **Alex (Product Designer)**

### After Voice2Note
> *"This genuinely changed my daily workflow. As soon as I finish speaking, I see my action items cleanly listed with due dates. It feels like having an executive assistant listening to my brainstorms without sacrificing any privacy."*

### Feedback-Driven Improvements Implemented
1. **One-Click Markdown Checklist**: Alex noted that copying tasks individually was tedious; we added a single **"Copy Checklist"** button that copies a formatted checklist (`- [ ] Task (Due: Friday)`) ready for Slack or Linear.
2. **Topic Tag Filtering**: Alex requested an easy way to browse notes by domain; we added persistent topic tag filter pills (`#Mobile`, `#Engineering`, `#Pricing`) directly to the Archive page.

---

## Interactive Demo
 
Want to test Voice2Note without recording your own voice first?

1. Open **Settings** (`/settings`) in your browser.
2. Click **"Load 6 Demo Notes"** under Interactive Demo Dataset.
3. Return to **Dashboard** or **Ask My Notes** to immediately test search, extraction, and grounded RAG citations!

*See [`docs/demo-script.md`](docs/demo-script.md) for our timed 3-minute video presentation script.*

---

## Limitations

- **Multilingual Support**: Currently tuned for English (`whisper-tiny.en`). Multilingual models (`whisper-base`) can be configured in settings.
- **Microphone Permissions in Non-HTTPS**: Web Audio API requires localhost or HTTPS.
- **Local RAM**: Requires at least 4GB of free system memory to comfortably run Ollama and Next.js concurrently.

---

## Future Roadmap

- [ ] Mobile companion Progressive Web App (PWA) with background audio sync.
- [ ] Export directly to Notion and Apple Reminders via local AppleScript/webhooks.
- [ ] Multi-speaker diarization for recorded group meetings.
- [ ] Automatic audio silence trimming and speech enhancement.

---

## License

Voice2Note is open-source software licensed under the [MIT License](LICENSE).
Open-weight models retain their respective licenses (MIT, Meta Llama Community License, Apache 2.0).
