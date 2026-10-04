import { z } from 'zod';

export const TaskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  evidence: z.string().default(''),
  confidence: z.number().min(0).max(1).default(0.9),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

export const IdeaSchema = z.object({
  idea: z.string().min(1, 'Idea description is required'),
  evidence: z.string().default(''),
});

export const DecisionSchema = z.object({
  decision: z.string().min(1, 'Decision description is required'),
  evidence: z.string().default(''),
});

export const ImportantDateSchema = z.object({
  event: z.string().min(1),
  date: z.string().min(1),
  evidence: z.string().optional(),
});

export const StructuredExtractionSchema = z.object({
  title: z.string().min(1).default('Voice Note'),
  summary: z.string().min(1).default('No summary available.'),
  tasks: z.array(TaskSchema).default([]),
  ideas: z.array(IdeaSchema).default([]),
  decisions: z.array(DecisionSchema).default([]),
  people: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  importantDates: z.array(ImportantDateSchema).default([]),
});

export type StructuredExtraction = z.infer<typeof StructuredExtractionSchema>;

export function cleanAndParseJSON(raw: string): any {
  if (!raw) return {};

  let text = raw.trim();

  // Strip Markdown code block if present (e.g. ```json ... ```)
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = text.match(jsonBlockRegex);
  if (match && match[1]) {
    text = match[1].trim();
  }

  // Remove leading/trailing non-bracket noise
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  // Fix common trailing commas before closing braces/brackets
  text = text.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse JSON directly:', err, 'Raw text was:', raw.slice(0, 200));
    throw new Error(`Invalid JSON output: ${(err as Error).message}`);
  }
}

export function validateExtraction(rawJsonText: string): {
  success: boolean;
  data?: StructuredExtraction;
  error?: string;
} {
  try {
    const parsed = cleanAndParseJSON(rawJsonText);
    const result = StructuredExtractionSchema.safeParse(parsed);

    if (result.success) {
      return { success: true, data: result.data };
    } else {
      console.warn('Extraction validation warning:', result.error.format());
      // Gracefully salvage partially valid structure
      const fallback: StructuredExtraction = {
        title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Voice Note',
        summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : 'Voice recording processed.',
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map((t: any) => ({
          title: t.title || t.task || 'Action item',
          evidence: t.evidence || t.context || '',
          confidence: typeof t.confidence === 'number' ? t.confidence : 0.85,
          dueDate: t.dueDate || null,
          priority: ['low', 'medium', 'high'].includes(t.priority) ? t.priority : 'medium',
        })) : [],
        ideas: Array.isArray(parsed.ideas) ? parsed.ideas.map((i: any) => ({
          idea: typeof i === 'string' ? i : i.idea || '',
          evidence: typeof i === 'object' ? i.evidence || '' : '',
        })).filter((i: any) => i.idea.length > 0) : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map((d: any) => ({
          decision: typeof d === 'string' ? d : d.decision || '',
          evidence: typeof d === 'object' ? d.evidence || '' : '',
        })).filter((d: any) => d.decision.length > 0) : [],
        people: Array.isArray(parsed.people) ? parsed.people.map(String).filter(Boolean) : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics.map(String).filter(Boolean) : [],
        importantDates: Array.isArray(parsed.importantDates) ? parsed.importantDates.map((dt: any) => ({
          event: dt.event || 'Event',
          date: dt.date || dt.dateString || 'Unspecified date',
          evidence: dt.evidence || '',
        })) : [],
      };
      return { success: true, data: fallback };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'JSON parsing error' };
  }
}
