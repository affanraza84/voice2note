# Voice2Note: 3-Minute Hackathon Demo Script

**Target Duration**: 2 minutes 45 seconds (Buffer: 15s)  
**Tone**: Confident, authentic, crisp, product-focused.  
**Presenter**: Builder presenting to hackathon judges.

---

### [0:00 – 0:20] The Problem & The Friend

**Action**: Camera on presenter, or screen showing a messy smartphone voice memos folder with 40+ generic recordings (`New Recording 14`, `New Recording 28`).

**Narration**:
> *"Meet my friend Alex. Alex is a product designer who talks to think. Every day during commutes and brainstorms, Alex records 5 to 10 voice memos.  
> But the problem was never recording. The problem was what happened afterward.  
> Brilliant ideas disappeared into a black hole of audio files. Commitments made out loud were completely forgotten. And finding what was decided two weeks ago was basically impossible.  
> So I built **Voice2Note** specifically for Alex."*

---

### [0:20 – 0:40] The Product & Calm Design

**Action**: Switch screen share to Voice2Note Dashboard (`http://localhost:3000`). Show clean, calm interface with hero headline: *"Your thoughts, organized automatically."*

**Narration**:
> *"This is Voice2Note. We deliberately rejected neon AI gimmicks in favor of a calm, productivity-focused workspace.  
> Everything you see—the speech recognition, the intelligence extraction, the vector database, and the semantic retrieval—runs **100% locally on this machine**. Zero cloud egress, zero subscription fees."*

---

### [0:40 – 1:10] The Live Recording Experience

**Action**: Click the primary CTA **"Record a Note"** (`/record`). Show the live microphone authorization and start speaking a realistic memo:

**Spoken Memo Example**:
> *"Hey, quick update on the mobile onboarding flow. We decided to ship the beta release to the design team next Wednesday. I need to complete the landing page redesign before Friday afternoon, and make sure to invite David from engineering to the staging walkthrough. Also, Sarah suggested we test a dark mode toggle as a retention experiment."*

**Action**: Click **Stop**. Preview waveform appears with elapsed duration (18s). Click **"Save & Process"**.

---

### [1:10 – 1:30] Real-Time Local AI Processing

**Action**: The screen displays the real-time processing progression cards:
```text
Your note is being processed locally...
Transcribing (Whisper ONNX) → Analyzing (Llama 3.2) → Indexing (MiniLM Embeddings) → Ready
```

**Narration**:
> *"Notice the feedback. Voice2Note immediately transcribes the audio in-process using local Whisper ONNX in less than two seconds.  
> Then our local Llama 3.2 model extracts structured knowledge, while all-MiniLM generates 384-dimensional embeddings into SQLite.  
> And just like that—it's ready."*

---

### [1:30 – 1:50] Structured Intelligence & Action Items

**Action**: Note detail page opens. Point out the elements:
- Executive Summary card
- Action Items with checkbox completion and confidence scores
- Ideas vs. Decisions separation
- The new **"Copy Checklist"** button (feedback-driven improvement!)

**Narration**:
> *"Instead of a giant wall of messy text, Alex gets immediate clarity.  
> Here is the executive summary. Here are the exact action items with quoted evidence. Notice that ideas like 'dark mode toggle' are strictly separated from finalized decisions like 'ship beta next Wednesday'.  
> And based directly on Alex's feedback, this one-click 'Copy Checklist' button formats everything into Markdown ready to paste into Slack or Linear."*

---

### [1:50 – 2:20] Conversational RAG & Grounded Search

**Action**: Navigate to **"Ask My Notes"** (`/ask`). Click the suggested prompt pill:  
*"What tasks did I mention recently?"*  
Then type:  
*"Where and when are we deploying the project?"*

**Action**: Show the streaming answer synthesize with local Llama 3.2. Expand the **Source Citation** card showing the verbatim transcript quote, timestamp, and jump link.

**Narration**:
> *"Now for the magic: conversational memory. When Alex asks, 'What tasks did I mention recently?' or 'Where and when are we deploying?', Voice2Note uses local vector search to retrieve only verified excerpts.  
> It cites the exact note title and timestamp. And if you ask something not in your recordings—like a cookie recipe—it strictly refuses rather than hallucinating."*

---

### [2:20 – 2:40] Privacy Center & Model Transparency

**Action**: Click **Privacy Center** (`/privacy`). Show the air-gap architecture diagram and Model Transparency table:
- Speech: `whisper-tiny.en` (MIT)
- LLM: `Llama 3.2 3B` (Meta Community)
- Embeddings: `all-MiniLM-L6-v2` (Apache 2.0)
- Storage: Local SQLite + Local Audio Directory

**Narration**:
> *"Under the hood, we provide full technical transparency. No hidden proprietary API calls. All open-weight models with documented open licenses. You can turn off Wi-Fi entirely, and Voice2Note continues to record, extract, and search with 100% functionality."*

---

### [2:40 – 3:00] Friend Feedback & Closing

**Action**: Switch to Notes Archive (`/notes`), showing the topic tag filter pills (`#Mobile`, `#Design`, `#Engineering`).

**Narration**:
> *"When Alex tested Voice2Note, they said:  
> 'Before, my voice memos felt like chores I was accumulating. Now, as soon as I finish talking, my tasks are already extracted and waiting for me.'  
> I built Voice2Note because my friend didn't need another chatbot.  
> They needed a better memory for the things they already said. Thank you."*
