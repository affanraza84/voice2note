import { SpeechProvider } from '../types';
import { LocalSpeechProvider } from './local-whisper';

let defaultProvider: SpeechProvider | null = null;

export function getSpeechProvider(): SpeechProvider {
  if (!defaultProvider) {
    defaultProvider = new LocalSpeechProvider();
  }
  return defaultProvider;
}

export function setSpeechProvider(provider: SpeechProvider): void {
  defaultProvider = provider;
}
