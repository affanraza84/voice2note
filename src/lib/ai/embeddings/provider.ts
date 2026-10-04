import { EmbeddingProvider } from '../types';
import { LocalEmbeddingProvider } from './local-minilm';

let defaultEmbeddingProvider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (!defaultEmbeddingProvider) {
    defaultEmbeddingProvider = new LocalEmbeddingProvider();
  }
  return defaultEmbeddingProvider;
}

export function setEmbeddingProvider(provider: EmbeddingProvider): void {
  defaultEmbeddingProvider = provider;
}
