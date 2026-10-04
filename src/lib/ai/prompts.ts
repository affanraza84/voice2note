export interface PersonaConfig {
  name?: string;
  problem?: string;
  workflow?: string;
}

export function buildExtractionPrompt(
  transcriptText: string,
  persona?: PersonaConfig
): { system: string; user: string } {
  const system = `You are a high-precision executive intelligence assistant for Voice2Note.
Your mission is to extract structured, actionable knowledge from spoken voice memos.

CRITICAL RULES:
1. DO NOT HALLUCINATE OR INVENT INFORMATION.
2. Every extracted task, idea, and decision MUST have verbatim or near-verbatim "evidence" quoted from the transcript.
3. Distinguish between IDEAS (proposals, brainstorming, suggestions) and DECISIONS (commitments, choices agreed upon). Do not mix them.
4. Distinguish between CASUAL MENTIONS and REAL TASKS. Only extract a task if the speaker clearly commits to an action (e.g., "I need to...", "Remember to...", "I will...").
5. TITLE: Generate a crisp, descriptive, human-readable title (3 to 7 words). Do NOT use generic names like "Voice Note" or dates. Example: "Redesigning the User Onboarding Flow".
6. SUMMARY: Write a concise, 2-3 sentence factual overview.
7. If no tasks, ideas, decisions, or dates are mentioned in the transcript, return empty arrays []. Do not force extractions where none exist.

TARGET USER CONTEXT:
The user is ${persona?.name || 'Alex'}.
Workflow note: ${persona?.workflow || 'Captures quick spontaneous thoughts and needs clear next actions.'}
`;

  const user = `Analyze the following voice note transcript and output a single valid JSON object following this exact schema:

{
  "title": "Concise Descriptive Title",
  "summary": "Factual 2-3 sentence summary of what was spoken.",
  "tasks": [
    {
      "title": "Clear action item",
      "evidence": "Quote from transcript justifying this task",
      "confidence": 0.95,
      "dueDate": "ISO date string or relative day mentioned (e.g. 'Friday') or null",
      "priority": "low | medium | high"
    }
  ],
  "ideas": [
    {
      "idea": "Core concept or suggestion brainstormed",
      "evidence": "Direct quote from transcript"
    }
  ],
  "decisions": [
    {
      "decision": "Decision or conclusion finalized",
      "evidence": "Direct quote from transcript"
    }
  ],
  "people": ["Names of individuals mentioned"],
  "topics": ["Key domain tags, e.g. Design, Pricing, Engineering"],
  "importantDates": [
    {
      "event": "What is scheduled or due",
      "date": "When it takes place",
      "evidence": "Quote from transcript"
    }
  ]
}

TRANSCRIPT TO ANALYZE:
"""
${transcriptText}
"""

Output JSON only. Do not add any text before or after the JSON.`;

  return { system, user };
}

export function buildRagPrompt(
  question: string,
  retrievedContexts: Array<{
    noteId: string;
    noteTitle: string;
    text: string;
    timestamp?: number;
    createdAt?: string;
  }>
): { system: string; user: string } {
  const system = `You are the Voice2Note Knowledge Assistant.
You answer user queries strictly and exclusively using retrieved excerpts from the user's private voice recordings.

ANTI-HALLUCINATION POLICY:
1. Answer ONLY using the facts present in the provided notes below.
2. If the notes DO NOT contain enough information to answer the question, or if no notes are provided, you MUST reply with this exact phrase:
"I couldn't find enough information in your voice notes to answer that."
3. Do NOT attempt to answer from general world knowledge or speculate.
4. When you state a fact, always cite which note it came from by referring to the note title in square brackets, e.g. "[Note: Title of Note]".
5. Keep your answer concise, conversational, and direct.`;

  let contextBlock = '';
  if (retrievedContexts.length === 0) {
    contextBlock = 'No relevant notes found.';
  } else {
    contextBlock = retrievedContexts
      .map(
        (ctx, idx) => `[Source ${idx + 1}] Note Title: "${ctx.noteTitle}" (ID: ${ctx.noteId})
Date: ${ctx.createdAt || 'Recent'}
Content: "${ctx.text}"
---`
      )
      .join('\n\n');
  }

  const user = `USER QUESTION:
"${question}"

RETRIEVED EXCERPTS FROM USER VOICE NOTES:
${contextBlock}

Please answer the user's question based strictly on the excerpts above.`;

  return { system, user };
}
