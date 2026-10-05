import { SpeechProvider } from '../types';
import { LocalSpeechProvider } from './local-whisper';
import { RemoteSpeechProvider } from './remote-whisper';

let defaultProvider: SpeechProvider | null = null;

export function getSpeechProvider(): SpeechProvider {
  if (defaultProvider) {
    return defaultProvider;
  }

  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production')
  );

  const hasRemoteKey = Boolean(
    process.env.GROQ_API_KEY ||
    process.env.SPEECH_API_KEY ||
    (isServerless && process.env.AI_API_KEY)
  );

  const forceRemote = process.env.SPEECH_PROVIDER === 'remote';

  if (forceRemote || (isServerless && hasRemoteKey)) {
    defaultProvider = new RemoteSpeechProvider();
  } else {
    defaultProvider = new LocalSpeechProvider();
  }

  return defaultProvider;
}

export function setSpeechProvider(provider: SpeechProvider): void {
  defaultProvider = provider;
}
