import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getProcessingMode,
  setProcessingMode,
  isCloudOptInConfirmed,
  validateModeConfiguration,
  getModeDisclosure,
  setProcessingModeOverride,
} from '@/lib/config/processing-mode';
import { getSpeechProvider, setSpeechProvider } from '@/lib/ai/speech/provider';
import { getLLMProvider, setLLMProvider } from '@/lib/ai/llm/provider';
import { getEmbeddingProvider, setEmbeddingProvider } from '@/lib/ai/embeddings/provider';
import { getAudioStorage, setAudioStorage } from '@/lib/storage';
import { LocalSpeechProvider } from '@/lib/ai/speech/local-whisper';
import { LocalLLMProvider } from '@/lib/ai/llm/local-ollama';
import { LocalAudioStorage } from '@/lib/storage/local-storage';
import { LocalEmbeddingProvider } from '@/lib/ai/embeddings/local-minilm';

describe('ProcessingMode & Fail-Closed Enforcement Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    setProcessingModeOverride(null);
    setSpeechProvider(null);
    setLLMProvider(null);
    setEmbeddingProvider(null);
    setAudioStorage(null);
  });

  afterEach(() => {
    setProcessingModeOverride(null);
    setSpeechProvider(null);
    setLLMProvider(null);
    setEmbeddingProvider(null);
    setAudioStorage(null);
    process.env = { ...originalEnv };
  });

  describe('1. Local-Private Mode: Strict Local Enforcement & Never Invokes Remote', () => {
    it('enforces LocalSpeechProvider even when remote speech API keys are provided', () => {
      // Inject remote speech keys into environment
      process.env.PROCESSING_MODE = 'local-private';
      process.env.GROQ_API_KEY = 'gsk_mock_groq_key_12345';
      process.env.OPENAI_API_KEY = 'sk-mock-openai-key-12345';
      process.env.SPEECH_API_KEY = 'mock_speech_key_12345';
      process.env.SPEECH_PROVIDER = 'remote'; // Even if someone tries to force remote!

      expect(getProcessingMode()).toBe('local-private');
      expect(isCloudOptInConfirmed()).toBe(false);

      const provider = getSpeechProvider();

      // In local-private mode, RemoteSpeechProvider MUST NEVER be returned
      expect(provider.id).toBe('local-whisper');
      expect(provider instanceof LocalSpeechProvider).toBe(true);
      expect(provider.name).toContain('Local Whisper');
    });

    it('enforces LocalLLMProvider even when remote LLM API keys are provided', () => {
      // Inject remote LLM keys into environment
      process.env.PROCESSING_MODE = 'local-private';
      process.env.GROQ_API_KEY = 'gsk_mock_groq_key_12345';
      process.env.OPENAI_API_KEY = 'sk-mock-openai-key-12345';
      process.env.AI_API_KEY = 'mock_ai_key_12345';
      process.env.LLM_PROVIDER = 'remote'; // Even if someone tries to force remote!

      const provider = getLLMProvider();

      // In local-private mode, RemoteOpenAICompatibleLLMProvider MUST NEVER be returned
      expect(provider.id).toBe('local-ollama');
      expect(provider instanceof LocalLLMProvider).toBe(true);
      expect(provider.name).toContain('Local Ollama');
    });

    it('enforces LocalAudioStorage even when BLOB_READ_WRITE_TOKEN is provided', () => {
      process.env.PROCESSING_MODE = 'local-private';
      process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_token_12345';
      process.env.STORAGE_PROVIDER = 'blob';

      const storage = getAudioStorage();

      // In local-private mode, VercelBlobAudioStorage MUST NEVER be returned
      expect(storage.id).toBe('local-fs');
      expect(storage instanceof LocalAudioStorage).toBe(true);
    });

    it('enforces LocalEmbeddingProvider in local-private mode', () => {
      process.env.PROCESSING_MODE = 'local-private';
      const embedder = getEmbeddingProvider();

      expect(embedder.id).toBe('local-minilm');
      expect(embedder instanceof LocalEmbeddingProvider).toBe(true);
      expect(embedder.dimensions).toBe(384);
    });
  });

  describe('2. Fail-Closed Invariants: Local Component Unavailability', () => {
    it('fails closed when local Ollama is offline and does not silently fall back to remote', async () => {
      process.env.PROCESSING_MODE = 'local-private';
      process.env.OPENAI_API_KEY = 'sk-mock-valid-openai-key';

      const llm = getLLMProvider();
      expect(llm.id).toBe('local-ollama');

      // Attempting to generate on an unreachable local Ollama endpoint
      // must throw/fail closed, NOT route to OpenAI
      await expect(
        llm.generate([{ role: 'user', content: 'Extract tasks from note' }])
      ).rejects.toThrow(/Local LLM service \(Ollama\) is not reachable/);
    });

    it('fails closed when local audio file is missing and does not fallback to remote storage', async () => {
      process.env.PROCESSING_MODE = 'local-private';
      process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_token_12345';

      const storage = getAudioStorage();
      expect(storage.id).toBe('local-fs');

      // Missing local audio file rejects instead of consulting remote blob
      await expect(
        storage.getFilePathForProcessing('non-existent-id', 'non-existent.wav')
      ).rejects.toThrow(/Audio file does not exist on disk/);
    });
  });

  describe('3. Cloud-Assisted Mode: Explicit Opt-In Required', () => {
    it('rejects activating cloud-assisted mode when opt-in is false', () => {
      expect(() => {
        setProcessingMode('cloud-assisted', false);
      }).toThrow(/Explicit opt-in is required/);
    });

    it('fails closed to local providers if cloud-assisted is set without confirmed opt-in', () => {
      // Emulate someone manually injecting PROCESSING_MODE=cloud-assisted without opt-in
      setProcessingModeOverride('cloud-assisted', false);
      process.env.GROQ_API_KEY = 'gsk_mock_key';

      // Speech provider fails closed to local
      const speech = getSpeechProvider();
      expect(speech.id).toBe('local-whisper');

      // LLM provider fails closed to local
      const llm = getLLMProvider();
      expect(llm.id).toBe('local-ollama');

      // Storage provider fails closed to local
      const storage = getAudioStorage();
      expect(storage.id).toBe('local-fs');
    });

    it('activates remote providers in cloud-assisted mode ONLY with explicit opt-in confirmation', () => {
      setProcessingModeOverride('cloud-assisted', true);
      process.env.GROQ_API_KEY = 'gsk_mock_key';
      process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_token';

      const speech = getSpeechProvider();
      expect(speech.id).toBe('remote-whisper');

      const llm = getLLMProvider();
      expect(llm.id).toBe('remote-llm');

      const storage = getAudioStorage();
      expect(storage.id).toBe('vercel-blob');
    });
  });

  describe('4. Centralized Validation & Transparency Disclosures', () => {
    it('validates configuration and flags un-opted cloud-assisted mode as invalid', () => {
      const res = validateModeConfiguration('cloud-assisted');
      // If optIn is false, it must be invalid
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('explicit opt-in');
    });

    it('validates local-private mode as valid by default with local providers mapped', () => {
      const res = validateModeConfiguration('local-private');
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.activeProviders.speech).toContain('Local Whisper');
      expect(res.activeProviders.llm).toContain('Local Ollama');
      expect(res.activeProviders.embeddings).toContain('Local MiniLM');
      expect(res.activeProviders.storage).toContain('Local Filesystem');
    });

    it('generates accurate disclosures distinguishing local vs external destinations', () => {
      const privateDisclosure = getModeDisclosure('local-private');
      expect(privateDisclosure.destinations.every((d) => !d.isExternal)).toBe(true);
      expect(privateDisclosure.offlineVerificationNote).toContain('Air-gapped');

      const cloudDisclosure = getModeDisclosure('cloud-assisted');
      expect(cloudDisclosure.destinations.some((d) => d.isExternal)).toBe(true);
      expect(cloudDisclosure.destinations.find((d) => d.category === 'audio')?.destination).toContain('Whisper API');
    });

    it('discloses initial model downloads sizes and components', () => {
      const disclosure = getModeDisclosure('local-private');
      expect(disclosure.modelDownloads).toHaveLength(3);

      const whisper = disclosure.modelDownloads.find((m) => m.name.includes('Whisper'));
      expect(whisper?.sizeEstimate).toBe('~39 MB');

      const minilm = disclosure.modelDownloads.find((m) => m.name.includes('MiniLM'));
      expect(minilm?.sizeEstimate).toBe('~90 MB');

      const llama = disclosure.modelDownloads.find((m) => m.name.includes('Llama'));
      expect(llama?.sizeEstimate).toBe('~2.0 GB');
    });
  });
});
