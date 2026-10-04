export type NoteStatus = 
  | 'uploading' 
  | 'processing' 
  | 'transcribing' 
  | 'analyzing' 
  | 'ready' 
  | 'failed';

export interface TranscriptSegment {
  id?: string;
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface VoiceNote {
  id: string;
  title: string;
  audioFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds: number;
  status: NoteStatus;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined or included fields
  transcript?: Transcript | null;
  summaryPreview?: string | null;
}

export interface Transcript {
  id: string;
  voiceNoteId: string;
  rawText: string;
  segments: TranscriptSegment[];
  detectedLanguage?: string | null;
  modelUsed: string;
  processingTimeMs: number;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  content: string;
  contextQuote?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'completed' | 'dismissed';
  dueDate?: string | null;
}

export interface Extraction {
  id: string;
  voiceNoteId: string;
  summary: string;
  tasks: TaskItem[];
  ideas: string[];
  decisions: string[];
  people: string[];
  topics: string[];
  importantDates: Array<{ event: string; dateString: string }>;
  createdAt: string;
}

export type LocalAIStatusType = 
  | 'ready' 
  | 'starting' 
  | 'processing' 
  | 'unavailable';

export interface LocalAIStatus {
  status: LocalAIStatusType;
  label: string;
  details: {
    speechModel: string;
    speechEngine: string;
    llmModel?: string;
    ollamaOnline: boolean;
    activeJobs: number;
  };
}
