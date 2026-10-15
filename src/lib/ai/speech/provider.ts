import { SpeechProvider } from '../types';
import { LocalSpeechProvider } from './local-whisper';
import { RemoteSpeechProvider } from './remote-whisper';
import { getProcessingMode, isCloudOptInConfirmed } from '@/lib/config/processing-mode';

let defaultProvider: SpeechProvider | null = null;

export function getSpeechProvider(): SpeechProvider {
  if (defaultProvider) {
    return defaultProvider;
  }

  const mode = getProcessingMode();

  // In local-private mode: Strictly enforce Local Whisper and fail-closed against remote inference
  if (mode === 'local-private') {
    defaultProvider = new LocalSpeechProvider();
    return defaultProvider;
  }

  // In cloud-assisted mode: Explicit opt-in is required
  if (!isCloudOptInConfirmed()) {
    console.warn(
      '[Voice2Note] Cloud-Assisted speech transcription requested without explicit opt-in. Failing closed to LocalSpeechProvider.'
    );
    defaultProvider = new LocalSpeechProvider();
    return defaultProvider;
  }

  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production')
  );

  const forceLocal = process.env.SPEECH_PROVIDER === 'local';
  const forceRemote = process.env.SPEECH_PROVIDER === 'remote';

  const hasRemoteKey = Boolean(
    process.env.GROQ_API_KEY ||
    process.env.SPEECH_API_KEY ||
    process.env.AI_API_KEY ||
    process.env.OPENAI_API_KEY
  );

  if (!forceLocal && (forceRemote || (isServerless && hasRemoteKey) || hasRemoteKey)) {
    defaultProvider = new RemoteSpeechProvider();
  } else {
    defaultProvider = new LocalSpeechProvider();
  }

  return defaultProvider;
}

export function setSpeechProvider(provider: SpeechProvider | null): void {
  defaultProvider = provider;
}
