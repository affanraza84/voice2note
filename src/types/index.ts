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

export type DueDateType = 'explicit' | 'inferred' | 'none';

export interface TaskItem {
  id: string;
  title: string;
  sourceNoteId: string;
  evidence: string;
  confidence: number;
  dueDate?: string | null;
  dueDateType?: DueDateType;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
}

export interface ClientCommitmentItem {
  id: string;
  commitment: string;
  evidence: string;
  by?: string;
}

export interface OpenQuestionItem {
  id: string;
  question: string;
  evidence: string;
  askedBy?: string;
}

export interface FollowUpSuggestionItem {
  id: string;
  suggestion: string;
  evidence?: string;
  rationale?: string;
}

export interface EmailDraft {
  subject: string;
  body: string;
  recipientName?: string;
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
  client?: string;
  project?: string;
  callSummary?: string;
  summary: string;
  tasks: TaskItem[];
  clientCommitments?: ClientCommitmentItem[];
  ideas: IdeaItem[];
  decisions: DecisionItem[];
  openQuestions?: OpenQuestionItem[];
  followUpSuggestions?: FollowUpSuggestionItem[];
  people: string[];
  topics: string[];
  importantDates: ImportantDateItem[];
  emailDraft?: EmailDraft;
  modelUsed?: string;
  createdAt: string;
}

export interface VoiceNote {
  id: string;
  title: string;
  client?: string;
  project?: string;
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

export type ProcessingMode = 'local-private' | 'cloud-assisted';

export interface DataFlowDestination {
  category: 'audio' | 'transcripts' | 'prompts' | 'metadata';
  label: string;
  destination: string;
  isExternal: boolean;
  retentionNote: string;
}

export interface ModelDownloadInfo {
  name: string;
  component: string;
  sizeEstimate: string;
  source: string;
  cachedLocally: boolean;
  license: string;
}

export interface ModeDisclosure {
  mode: ProcessingMode;
  optInConfirmed: boolean;
  destinations: DataFlowDestination[];
  modelDownloads: ModelDownloadInfo[];
  offlineReady: boolean;
  offlineVerificationNote: string;
}

export interface ModeValidationResult {
  valid: boolean;
  mode: ProcessingMode;
  optInConfirmed: boolean;
  errors: string[];
  warnings: string[];
  activeProviders: {
    speech: string;
    llm: string;
    embeddings: string;
    storage: string;
  };
}
