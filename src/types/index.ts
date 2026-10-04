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

export interface TaskItem {
  id: string;
  title: string;
  sourceNoteId: string;
  evidence: string;
  confidence: number;
  dueDate?: string | null;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
}

export interface IdeaItem {
  id: string;
  idea: string;
  evidence: string;
}

export interface DecisionItem {
  id: string;
  decision: string;
  evidence: string;
}

export interface ImportantDateItem {
  event: string;
  date: string;
  evidence?: string;
}

export interface Extraction {
  id: string;
  voiceNoteId: string;
  title: string;
  summary: string;
  tasks: TaskItem[];
  ideas: IdeaItem[];
  decisions: DecisionItem[];
  people: string[];
  topics: string[];
  importantDates: ImportantDateItem[];
  modelUsed?: string;
  createdAt: string;
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
  // Included relations
  transcript?: Transcript | null;
  extraction?: Extraction | null;
  summaryPreview?: string | null;
  taskCount?: number;
  topicTags?: string[];
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

export interface ChunkMetadata {
  noteId: string;
  noteTitle: string;
  chunkIndex: number;
  startTime?: number;
  endTime?: number;
  topic?: string;
  createdAt: string;
}

export interface VectorChunk {
  id: string;
  noteId: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
  metadata: ChunkMetadata;
  createdAt: string;
}

export interface SearchResult {
  noteId: string;
  noteTitle: string;
  matchedText: string;
  score: number;
  startTime?: number;
  createdAt: string;
}

export interface RAGCitation {
  noteId: string;
  noteTitle: string;
  quote: string;
  startTime?: number;
  score: number;
}

export interface RAGResponse {
  answer: string;
  citations: RAGCitation[];
  modelUsed: string;
  isGrounded: boolean;
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
