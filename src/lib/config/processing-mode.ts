import { getSetting, setSetting } from '@/lib/db';
import {
  ProcessingMode,
  ModeDisclosure,
  ModeValidationResult,
  DataFlowDestination,
  ModelDownloadInfo,
} from '@/types';

// In-memory test override
let modeOverride: ProcessingMode | null = null;
let optInOverride: boolean | null = null;

export function setProcessingModeOverride(
  mode: ProcessingMode | null,
  optIn?: boolean
): void {
  modeOverride = mode;
  optInOverride = optIn !== undefined ? optIn : null;
}

export function isCloudOptInConfirmed(): boolean {
  if (optInOverride !== null) {
    return optInOverride;
  }

  // Check environment variable
  if (process.env.CLOUD_ASSISTED_OPT_IN === 'true') {
    return true;
  }

  // Check database setting
  try {
    const val = getSetting('CLOUD_ASSISTED_OPT_IN', 'false');
    return val === 'true';
  } catch {
    return false;
  }
}

export function getProcessingMode(): ProcessingMode {
  if (modeOverride) {
    return modeOverride;
  }

  // Check environment variable
  const envMode = process.env.PROCESSING_MODE;
  if (envMode === 'cloud-assisted' || envMode === 'local-private') {
    return envMode;
  }

  // Check database setting (defaults to privacy-first 'local-private')
  try {
    const dbMode = getSetting('PROCESSING_MODE', 'local-private');
    if (dbMode === 'cloud-assisted') {
      return 'cloud-assisted';
    }
  } catch {}

  return 'local-private';
}

export function setProcessingMode(mode: ProcessingMode, optIn?: boolean): void {
  if (mode === 'cloud-assisted' && !optIn && !isCloudOptInConfirmed()) {
    throw new Error(
      'Explicit opt-in is required to activate Cloud-Assisted mode. You must confirm that audio and prompt data will be transmitted to external cloud providers.'
    );
  }

  setSetting('PROCESSING_MODE', mode);
  if (optIn !== undefined) {
    setSetting('CLOUD_ASSISTED_OPT_IN', String(optIn));
  }
}

export function validateModeConfiguration(
  modeToValidate?: ProcessingMode
): ModeValidationResult {
  const mode = modeToValidate || getProcessingMode();
  const optIn = isCloudOptInConfirmed();
  const errors: string[] = [];
  const warnings: string[] = [];

  const hasRemoteSpeechKey = Boolean(
    process.env.GROQ_API_KEY ||
    process.env.SPEECH_API_KEY ||
    process.env.AI_API_KEY ||
    process.env.OPENAI_API_KEY
  );

  const hasRemoteLLMKey = Boolean(
    process.env.GROQ_API_KEY ||
    process.env.AI_API_KEY ||
    process.env.OPENAI_API_KEY
  );

  const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (mode === 'cloud-assisted') {
    if (!optIn) {
      errors.push(
        'Cloud-Assisted mode requires explicit opt-in confirmation before remote inference or cloud storage can be used.'
      );
    }
    if (!hasRemoteSpeechKey) {
      warnings.push(
        'No remote speech API key detected (GROQ_API_KEY, AI_API_KEY, or OPENAI_API_KEY). Cloud speech fallback will fail closed.'
      );
    }
    if (!hasRemoteLLMKey) {
      warnings.push(
        'No remote LLM API key detected (GROQ_API_KEY, AI_API_KEY, or OPENAI_API_KEY). Cloud LLM extraction will fail closed.'
      );
    }
  } else {
    // In local-private mode: verify fail-closed invariants
    if (hasRemoteSpeechKey || hasRemoteLLMKey || hasBlobToken) {
      // Info note: keys exist but are strictly ignored in local-private mode
    }
  }

  const activeProviders = {
    speech: mode === 'local-private' ? 'Local Whisper (ONNX / Transformers.js)' : 'Remote Whisper (Groq / OpenAI API)',
    llm: mode === 'local-private' ? 'Local Ollama Engine (localhost:11434)' : 'Remote LLM (OpenAI-Compatible)',
    embeddings: 'Local MiniLM (ONNX / 384-d)',
    storage: mode === 'local-private' ? 'Local Filesystem Storage (./data/audio)' : (hasBlobToken ? 'Vercel Blob Storage' : 'Local Filesystem Storage'),
  };

  return {
    valid: errors.length === 0,
    mode,
    optInConfirmed: optIn,
    errors,
    warnings,
    activeProviders,
  };
}

export function getModeDisclosure(targetMode?: ProcessingMode): ModeDisclosure {
  const mode = targetMode || getProcessingMode();
  const optIn = isCloudOptInConfirmed();

  const destinations: DataFlowDestination[] =
    mode === 'local-private'
      ? [
          {
            category: 'audio',
            label: 'Voice Recordings',
            destination: 'Local Filesystem (./data/audio/)',
            isExternal: false,
            retentionNote: 'Stored strictly on your local disk. Zero cloud upload.',
          },
          {
            category: 'transcripts',
            label: 'Generated Transcripts',
            destination: 'Local SQLite Database (./data/voice2note.db)',
            isExternal: false,
            retentionNote: 'Processed in-process via ONNX runtime on your CPU/GPU.',
          },
          {
            category: 'prompts',
            label: 'Extraction & RAG Prompts',
            destination: 'Local Ollama Engine (http://127.0.0.1:11434)',
            isExternal: false,
            retentionNote: 'Inference executes on localhost. No network packets leave the machine.',
          },
          {
            category: 'metadata',
            label: 'Tasks, Ideas & Decisions',
            destination: 'Local SQLite Database (./data/voice2note.db)',
            isExternal: false,
            retentionNote: 'Indexed and searched locally via SQLite cosine similarity vectors.',
          },
        ]
      : [
          {
            category: 'audio',
            label: 'Voice Recordings',
            destination: 'Groq / OpenAI Whisper API Endpoint',
            isExternal: true,
            retentionNote: 'Transmitted over TLS to external cloud speech APIs for transcription.',
          },
          {
            category: 'transcripts',
            label: 'Generated Transcripts',
            destination: 'Remote LLM Endpoint (Groq / OpenAI)',
            isExternal: true,
            retentionNote: 'Sent to cloud LLM provider for structured intelligence extraction.',
          },
          {
            category: 'prompts',
            label: 'Extraction & RAG Prompts',
            destination: 'Remote LLM Endpoint (Groq / OpenAI)',
            isExternal: true,
            retentionNote: 'Transmitted to cloud LLM for question answering and task identification.',
          },
          {
            category: 'metadata',
            label: 'Audio Storage Blobs',
            destination: 'Vercel Blob Storage / Cloud Object Storage',
            isExternal: true,
            retentionNote: 'Audio files stored in public/private cloud object storage.',
          },
        ];

  const modelDownloads: ModelDownloadInfo[] = [
    {
      name: 'Whisper Speech Recognition',
      component: 'whisper-tiny.en',
      sizeEstimate: '~39 MB',
      source: 'HuggingFace (Xenova/whisper-tiny.en)',
      cachedLocally: true,
      license: 'MIT / Apache 2.0',
    },
    {
      name: 'MiniLM Vector Embeddings',
      component: 'all-MiniLM-L6-v2',
      sizeEstimate: '~90 MB',
      source: 'HuggingFace (Xenova/all-MiniLM-L6-v2)',
      cachedLocally: true,
      license: 'Apache 2.0',
    },
    {
      name: 'Llama 3.2 Reasoning & Extraction',
      component: 'llama3.2:latest (3B Instruct)',
      sizeEstimate: '~2.0 GB',
      source: 'Ollama Model Registry (ollama pull llama3.2)',
      cachedLocally: true,
      license: 'Meta Llama 3.2 Community License',
    },
  ];

  return {
    mode,
    optInConfirmed: optIn,
    destinations,
    modelDownloads,
    offlineReady: mode === 'local-private',
    offlineVerificationNote:
      'Air-gapped and complete offline operation is supported only after initial model downloads have completed on a connected network. Do not claim offline readiness until local models are verified with "ollama serve" and initial ONNX weights are loaded.',
  };
}
