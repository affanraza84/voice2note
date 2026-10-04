import { LLMProvider } from '../types';
import { LocalLLMProvider } from './local-ollama';

let defaultLLMProvider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (!defaultLLMProvider) {
    defaultLLMProvider = new LocalLLMProvider();
  }
  return defaultLLMProvider;
}

export function setLLMProvider(provider: LLMProvider): void {
  defaultLLMProvider = provider;
}
