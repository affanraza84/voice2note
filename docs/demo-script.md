# Voice2Note: Freelancer Client-Call Workflow Demo Script

**Target Duration**: 3 minutes (180 seconds)  
**Persona**: Freelance Software Engineer / Consultant presenting to judges and users.  
**Focus**: Real-world client-call follow-up workflow, client confidentiality, explicit vs. inferred deadlines, and reproducible local AI execution.

---

### [0:00 – 0:25] The Freelancer's Challenge: Post-Call Chaos & Confidentiality

**Visual**: Camera on presenter, or screen showing a folder of recorded client consultation calls and messy scratchpad notes with half-typed deliverables.

**Narration**:
> *"As a freelance engineer, my client discovery and kickoff calls are where projects succeed or fail.  
> During a 45-minute consultation, clients share critical context: access credentials, design scope, technical constraints, and tentative schedules.  
> Afterward, I'd easily spend an hour listening through audio to extract what I promised to build, what the client promised to send me, and drafting the follow-up email.  
> Worse, client calls routinely contain confidential business logic, internal numbers, and NDA-protected roadmaps. Sending raw client audio to proprietary cloud APIs transfers custody to third-party servers and introduces legal and compliance risks under client NDAs.  
> That's why I built **Voice2Note**: a local-first meeting follow-up assistant engineered specifically for freelancers."*

---

### [0:25 – 0:50] The Open-Source Local AI Foundation

**Visual**: Switch screen share to the Voice2Note Dashboard (`http://localhost:3000`). Show clean, calm interface with headline: *"Client Calls & Deliverables, Handled with Precision."*

**Narration**:
> *"Voice2Note replaces generic note-taking with structured client-call workflows.  
> Everything you see runs locally on this workstation:
> - Speech transcription via local **Whisper ONNX**.
> - Structured intelligence extraction via local **Llama 3.2** through Ollama.
> - Semantic vector search via **all-MiniLM** inside an embedded SQLite database.  
> All audio, transcripts, and embeddings stay strictly on local loopback (`127.0.0.1`). There are zero recurring per-minute audio fees, zero per-token LLM charges, and zero cloud vector database subscriptions."*

---

### [0:50 – 1:25] Live Workflow: Processing a Client Redesign Call

**Visual**: Click **"Record Client Call"** (`/record`) or demonstrate loading the realistic demo client call (`Acme Corp Website Kickoff`). Show the multi-stage local processing progress cards:
```text
Transcribing (Whisper ONNX) → Analyzing (Llama 3.2) → Indexing (MiniLM Embeddings) → Ready
```

**Narration**:
> *"When a client call finishes, Voice2Note immediately processes the recording locally.  
> Notice the feedback pipeline: the audio is normalized to 16kHz PCM, transcribed in-process with Whisper ONNX in ~2 seconds, structured through local Llama 3.2, and indexed into SQLite with 384-dimensional vector embeddings.  
> In under five seconds, an unstructured 45-minute client discussion is transformed into structured project assets."*

---

### [1:25 – 2:05] Structured Intelligence: Deliverables, Deadlines & Email Drafts

**Visual**: Open the note detail page for **Acme Corp Website Kickoff**. Walk through the structured cards:
1. **Executive Call Summary**: 2-sentence overview of project goals.
2. **Client Commitments**: Separates what *the client* promised (e.g. *"Sarah promised to upload brand photography to Google Drive by Monday"*) from what the freelancer must build.
3. **Action Items & Deadline Classification**:
   - Highlight task *"Send updated Figma mockups"* with green badge: **Confirmed Due: 2026-10-20 (Explicit)**.
   - Highlight task *"Draft preliminary IA diagram"* with amber badge: **Tentative (Inferred: Late next week)**.
   - Point out the verbatim quoted evidence from the transcript.
4. **Open Client Questions**: Highlighting unresolved questions (e.g. *"Will we need multi-currency checkout for Canadian visitors in v1?"*).
5. **Editable Follow-Up Email Draft**: Complete email pre-populated with client commitments and next steps, with a **"Open in Email Client"** `mailto:` button.

**Narration**:
> *"Look at how the intelligence is separated.  
> In freelance consulting, confusing a client commitment with a developer task causes missed deliverables. Here, client deliverables like brand assets are strictly categorized under Client Commitments.  
> Notice the deadline handling: Voice2Note enforces an anti-hallucination rule where it distinguishes confirmed explicit dates from tentative inferred timeframes. If a client casually says 'sometime late next week', Voice2Note never invents a confirmed deadline.  
> It surfaces open client questions that need answers before coding begins.  
> And down here: a complete follow-up email draft ready to review, edit, and send directly through my default email client."*

---

### [2:05 – 2:35] The Freelancer Dashboard & One-Click Exports

**Visual**: Navigate back to Dashboard (`/`). Show:
- Factual Metrics: Active Clients, Incomplete Tasks, Upcoming Deadlines (with confirmed vs tentative breakdown), Open Client Questions, Total Audio Duration.
- Inline task checkboxes toggling tasks complete without leaving the dashboard.
- Click **"Export Tasks (CSV)"** and **"Export Summaries (MD)"**; show the files downloading instantly.

**Narration**:
> *"Back on the dashboard, freelancers get an instant operational overview across all active clients.  
> Notice that we show strictly factual metrics: real active clients, actual incomplete tasks, and upcoming deadlines. We never display fabricated 'hours saved' or fake 'accuracy percentages'.  
> I can mark tasks complete directly with inline checkboxes.  
> And with one click, I can export all pending client tasks to a formatted CSV spreadsheet for my billing tracker, or export full client call summaries as Markdown for my project archive."*

---

### [2:35 – 2:55] Grounded Search & Anti-Hallucination Refusal ("Ask My Notes")

**Visual**: Navigate to **"Ask My Notes"** (`/ask`).
1. Ask factual query: *"Where are we deploying Project Apollo and when?"*
   - Show grounded response citing Vercel on November 15, with expandable source transcript quote and note link.
2. Ask adversarial out-of-domain query: *"What is the secret recipe for baking chocolate chip cookies?"*
   - Show instant deterministic fallback refusal: *"I couldn't find enough information in your voice notes to answer that."*

**Narration**:
> *"For cross-meeting memory, our Ask My Notes interface uses local vector retrieval.  
> When I ask about a deployment decision, it retrieves the relevant excerpt with float32 cosine similarity and provides a verifiable citation linking to the exact source recording.  
> But just as importantly: when asked something completely unmentioned—like a cookie recipe—it strictly refuses rather than hallucinating an answer. When managing client deliverables, knowing what was not said is just as critical as knowing what was said."*

---

### [2:55 – 3:15] Open Licenses, Local Setup & Conclusion

**Visual**: Open the **Privacy Center** (`/privacy`), showing open model disclosures:
- `Xenova/whisper-tiny.en` (MIT License)
- `llama3.2:3b` (Meta Llama Community License)
- `Xenova/all-MiniLM-L6-v2` (Apache 2.0)
- Local SQLite database (Public Domain)

**Narration**:
> *"Under the hood, Voice2Note is built entirely on open-weight models with transparent licenses: MIT Whisper, Apache 2.0 MiniLM, and Meta Llama Community Llama 3.2.  
> Anyone can clone the repository, run `npm install`, pull `llama3.2`, and have a private, $0-marginal-cost client assistant running in minutes.  
> Voice2Note proves that freelancers don't need to leak client data or pay expensive monthly cloud fees to work with precision. Thank you."*
