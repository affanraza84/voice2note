# Voice2Note

> **The Local-First Meeting Follow-Up Assistant for Freelancers & Consultants.**  
> Turn client discovery and kickoff calls into verified commitments, action items with explicit vs. inferred deadlines, open client questions, and editable follow-up email drafts — 100% locally and privately.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black.svg)](https://nextjs.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8.svg)](https://tailwindcss.com/)
[![Local AI](https://img.shields.io/badge/Local_AI-Whisper_%2B_Llama_3.2-emerald.svg)](#privacy--data-custody)
[![Tests](https://img.shields.io/badge/Tests-93%2F93_Passing-brightgreen.svg)](#evaluation--benchmarks)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## Overview

Freelance developers, designers, and consultants spend hours every week on client consultations, discovery workshops, and project kickoff calls. These conversations are dense with operational details:
* Deliverables promised by the client (brand assets, API keys, credentials)
* Developer commitments and deadlines
* Scope agreements vs. speculative ideas
* Open questions that must be resolved before writing code

After a 45-minute call, organizing notes, tracking down deadlines, and drafting the follow-up email takes 30–60 minutes. Worse, client discussions frequently contain confidential business logic, unreleased roadmaps, and financial figures that freelancers cannot ethically or legally send to third-party cloud AI vendors under client Non-Disclosure Agreements (NDAs).

**Voice2Note** solves this entirely on the user's personal hardware using open-weight AI models. It captures or uploads client call audio, transcribes it locally, extracts structured action items and commitments with quoted transcript evidence, and drafts an editable follow-up email — with **$0.00 marginal cost per call** and complete data custody.

---

## Why Local Open-Weight AI Wins for Freelancers

| Operational Requirement | Proprietary Hosted Stack (Whisper API + GPT-4o + Cloud Vector DB) | Voice2Note Open Stack (Local Whisper ONNX + Llama 3.2 via Ollama + SQLite MiniLM) |
|---|---|---|
| **Client Confidentiality & NDA Compliance** | Raw audio, transcripts, and prompts transmitted over the internet to remote servers | **All audio, transcripts, SQLite records, and embeddings remain strictly on local loopback (`127.0.0.1`)** |
| **Marginal Cost per Call** | Compounding per-minute transcription fees + token input/output costs + $70+/mo vector DB hosting | **$0.00 marginal cost per call** on hardware the freelancer already owns |
| **Operational Longevity** | Vulnerable to provider price hikes, endpoint deprecation, and cloud outages | **Frozen local model weights run reliably indefinitely, even offline** |
| **Deadlines & Anti-Hallucination** | Commercial chatbots frequently invent plausible-sounding deadlines | **Anti-hallucination prompt guardrail strictly separates confirmed explicit dates from tentative inferred timeframes** |

*For our complete architectural analysis and legal breakdown, see [`docs/open-source-ai.md`](docs/open-source-ai.md).*

---

## Core Features

### 1. Freelancer Client Follow-Up Dashboard
* **Factual Operational Metrics**: Real-time counts for Active Clients, Incomplete Tasks, Upcoming Deadlines, Open Client Questions, and Recorded Audio. (Zero fabricated "hours saved" or fake "accuracy percentages".)
* **Incomplete Tasks Management**: Check off completed deliverables directly from the dashboard, filter by priority (`High`, `Medium`, `Low`), and view supporting transcript evidence quotes.
* **Deadline Urgency Tracker**: Sorts upcoming deadlines while explicitly distinguishing confirmed dates (`Confirmed: 2026-10-20 [Explicit]`) from tentative estimates (`Tentative [Inferred: Late next week]`).
* **Open Client Questions Panel**: Surfaces unresolved inquiries raised during calls with speaker attribution, preventing miscommunications before development starts.
* **One-Click Export Actions**:
  - **Export Tasks (CSV)**: Generates formatted spreadsheet with task IDs, priorities, due dates, date types, evidence quotes, client, and project.
  - **Export Summaries (Markdown)**: Generates clean, executive meeting summaries for client documentation.
* **Recoverable Failure Recovery**: Detects failed processing jobs and provides an immediate one-click retry that reuses existing transcripts without duplicating database records.

### 2. Multi-Stage In-Process Processing Pipeline
```text
Browser Audio Capture (WebM/WAV)
       ↓
Local Storage (`data/audio/`)
       ↓
Local Speech-to-Text (Whisper ONNX via Transformers.js)
       ↓
Local LLM Extraction (Llama 3.2 3B via Ollama)
       ↓
Structured Intelligence:
  ├─ Executive Call Summary
  ├─ Client Commitments (deliverables the client promised)
  ├─ Freelancer Action Items (with explicit vs. inferred due dates)
  ├─ Key Decisions Finalized
  ├─ Open Questions & Ambiguities
  └─ Editable Follow-Up Email Draft
       ↓
Local Vector Embeddings (`all-MiniLM-L6-v2` in SQLite)
       ↓
Grounded RAG Search ("Ask My Notes")
```

### 3. Client Commitments vs. Developer Tasks
Voice2Note prevents missed deliverables by strictly separating:
* **Client Commitments**: Deliverables promised by the client (e.g. *"Sarah to provide high-res logos and Stripe staging keys by Monday"*).
* **Freelancer Tasks**: Action items assigned to the developer, classified by priority and deadline type with verbatim transcript quotes.

### 4. Anti-Hallucination Deadline Classification
Small language models frequently confuse rough conversational estimates with firm commitments. Voice2Note enforces strict schema constraints:
* **Explicit Due Dates**: Confirmed calendar dates stated directly by the speaker (e.g. *"due by Tuesday, October 20th"*).
* **Inferred Due Dates**: Tentative approximations (e.g. *"probably sometime late next week"*). These are flagged as tentative to ensure freelancers never promise unconfirmed delivery windows.

### 5. Editable Follow-Up Email Drafts
Generates a professional, editable follow-up email draft summarizing discussed milestones and action items, complete with an **"Open in Email Client"** `mailto:` action for external, user-controlled sending.

### 6. Grounded Cross-Meeting Memory ("Ask My Notes")
* Semantic vector retrieval powered by local float32 cosine similarity over 384-dimensional MiniLM embeddings in SQLite.
* **Verifiable Source Citations**: Answers display expandable citations with verbatim transcript quotes and jump links to the source call.
* **Deterministic Negative Refusal**: Queries lacking factual support in recorded notes strictly return a deterministic refusal rather than hallucinating plausible answers.

---

## Technical Stack & Open Models

All models used in Voice2Note are open-weight with transparent licenses:

| Component | Technology / Model | Weight Specs | Runtime Engine | License |
|---|---|---|---|---|
| **Web Framework** | Next.js 16 (App Router) + React 19 | TypeScript 5 | Node.js 20 LTS | MIT |
| **Styling** | Vanilla CSS + TailwindCSS v4 | Calm dark aesthetic | In-Process CSS | MIT |
| **Local Database** | SQLite (`better-sqlite3`) | Embedded SQL in WAL mode | In-Process C Node Binding | Public Domain |
| **Speech-to-Text** | `Xenova/whisper-tiny.en` | 39M parameters, quantized ONNX (~39 MB) | `onnxruntime-node` via `@xenova/transformers` | **MIT License** |
| **Local LLM** | `llama3.2:3b` | 3.21B parameters, 4-bit `q4_K_M` (~2.0 GB) | Ollama daemon (`http://127.0.0.1:11434`) | **Meta Llama 3.2 Community License** |
| **Vector Embeddings** | `Xenova/all-MiniLM-L6-v2` | 384 dimensions (~90 MB) | `onnxruntime-node` via `@xenova/transformers` | **Apache 2.0 License** |
| **Audio Processing** | FFmpeg / ffprobe | Subprocess normalization | 16kHz mono PCM 16-bit WAV | LGPL / GPL |

---

## Evaluation & Benchmarks

Our evaluation report ([`docs/evaluation.md`](docs/evaluation.md)) details repeatable benchmarks executed on Apple Silicon (16GB RAM):

```bash
# Run the automated evaluation suite
npm run eval
```

* **Transcription Quality**: Evaluated on standardized audio samples with clear English achieving **≥ 95% word accuracy** and 100% critical named entity retention (e.g., "Vercel", "Figma", "Stripe"). Real-Time Factor (RTF) measured at **0.06x – 0.08x** (transcribing 30s of audio in 2.1–2.8s on Apple Silicon CPU).
* **Structured Extraction**: 100% Zod JSON schema validation and repair rate across all test runs; accurately separates client commitments from developer tasks.
* **Anti-Hallucination Refusal**: Queries without matching note context trigger deterministic refusal without hallucination.
* **Resource Stability**: Heap growth remains bounded under batch processing (< 18 MB growth over 10-chunk embeddings) with zero native memory leaks.

*Run all 93 tests across the full suite with `npm test`.*

---

## Privacy & Data Custody

* **Local Storage**: Audio files are saved to `data/audio/`; SQLite database resides in `data/voice2note.db`.
* **Network Boundaries**: In Local-Private mode, all processing executes on `127.0.0.1`. No audio, transcripts, or queries are transmitted to external cloud servers.
* **Initial Weight Download Disclosure**: Running Voice2Note requires downloading model weights during setup (~2.0 GB for Ollama Llama 3.2; ~130 MB for Whisper and MiniLM ONNX models). Once cached, the application functions completely offline.
* **Cloud-Assisted Mode**: An optional cloud-assisted mode is available for resource-constrained devices, but requires explicit user opt-in in Settings. Local mode fails closed if remote credentials exist without confirmed opt-in.

---

## Local Setup Instructions

### Prerequisites
1. **Node.js**: v18.17.0 or later (v20+ LTS recommended).
2. **FFmpeg**: Required for audio normalization:
   - macOS: `brew install ffmpeg`
   - Ubuntu/Debian: `sudo apt install ffmpeg`
   - Windows: `winget install Gyan.FFmpeg`
3. **Ollama**: Local model inference engine ([ollama.com](https://ollama.com)).

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/affanraza84/voice2note.git
cd voice2note
npm install
```

### 2. Pull the Open-Weight LLM
Ensure Ollama is running, then pull the compact Llama 3.2 model:
```bash
ollama run llama3.2
```
*(You can verify Ollama is active by visiting `http://127.0.0.1:11434` in your browser.)*

### 3. Launch Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## First-User Validation Checklist

Follow this 5-minute checklist to verify your local installation:

- [ ] **1. Health Check**: Visit [http://localhost:3000/api/health](http://localhost:3000/api/health) to confirm database, storage, and Ollama connections are healthy.
- [ ] **2. Load Sample Client Call**: On the dashboard, click **"Load Freelance Demo Call"** (or load from Settings) to populate the realistic Acme Corp redesign consultation.
- [ ] **3. Verify Deliverable Separation**: Open the Acme Corp note. Verify that **Client Commitments** (e.g. brand assets) are separated from **Action Items**, and that the follow-up email draft is populated.
- [ ] **4. Test Deadline Classification**: Check the action items list. Verify that explicit calendar dates display green **Confirmed [Explicit]** badges while approximations display amber **Tentative [Inferred]** badges.
- [ ] **5. Test Incomplete Task Toggle**: On the main dashboard, click the checkbox on an incomplete task. Confirm the task status toggles with instant optimistic UI feedback.
- [ ] **6. Test Export Actions**: Click **"Export Tasks (CSV)"** and **"Export Summaries (MD)"** on the dashboard. Verify that valid CSV and Markdown files download immediately.
- [ ] **7. Test Grounded RAG & Refusal**:
  - Visit **Ask My Notes** (`/ask`).
  - Ask: *"Where are we deploying Project Apollo and when?"* → Verify grounded answer with citation link.
  - Ask: *"What is the secret recipe for chocolate chip cookies?"* → Verify immediate refusal without hallucination.
- [ ] **8. Run Test Suite**: Run `npm test` in your terminal to verify all 93 automated tests pass.

---

## Honest Limitations

1. **Hardware Memory**: Concurrent execution of Ollama (`llama3.2:3b`), in-process Whisper, and the Next.js server requires **at least 4 GB of free RAM**.
2. **Audio Environment**: `whisper-tiny.en` is optimized for rapid local execution (~39M params). It can experience degraded accuracy on heavy ambient background noise or rapid multi-speaker cross-talk compared to larger models like `whisper-large-v3`.
3. **No Automatic Email Sending**: Follow-up email drafts are deliberately external and user-controlled via `mailto:` links or clipboard copy; Voice2Note never sends emails automatically on your behalf.
4. **Air-Gap Verification**: Full offline operation is supported *after* initial model weights are downloaded during setup.

---

## Documentation Links

* 📜 **Freelancer Product Demo Script**: [`docs/demo-script.md`](docs/demo-script.md)
* 🔬 **Repeatable Evaluation & Benchmarks**: [`docs/evaluation.md`](docs/evaluation.md)
* 🏛️ **Open-Source AI & Tradeoff Study**: [`docs/open-source-ai.md`](docs/open-source-ai.md)
* 🛠️ **Local Development Guide**: [`docs/local-development.md`](docs/local-development.md)
* 🚀 **Production Deployment Architecture**: [`docs/production-deployment.md`](docs/production-deployment.md)

---

## License

Voice2Note application code is open-source under the [MIT License](LICENSE).  
Open-weight models retain their respective community licenses (`whisper-tiny.en` MIT, `all-MiniLM-L6-v2` Apache 2.0, `Llama 3.2` Meta Llama Community License).
