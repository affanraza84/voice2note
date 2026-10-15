import { LLMProvider } from '../types';
import { LocalLLMProvider } from './local-ollama';
import { RemoteOpenAICompatibleLLMProvider } from './remote-openai-compatible';

let defaultLLMProvider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (defaultLLMProvider) {
    return defaultLLMProvider;
  }

  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production')
  );

  const forceLocal = process.env.LLM_PROVIDER === 'local' || process.env.AI_PROVIDER === 'local';
  const forceRemote = process.env.LLM_PROVIDER === 'remote' || process.env.AI_PROVIDER === 'remote';

  const hasRemoteKey = Boolean(
    process.env.GROQ_API_KEY ||
    process.env.AI_API_KEY ||
    process.env.OPENAI_API_KEY
  );

  if (!forceLocal && (forceRemote || (isServerless && hasRemoteKey))) {
    defaultLLMProvider = new RemoteOpenAICompatibleLLMProvider();
  } else {
    defaultLLMProvider = new LocalLLMProvider();
  }

  return defaultLLMProvider;
}

export function setLLMProvider(provider: LLMProvider | null): void {
  defaultLLMProvider = provider;
}
