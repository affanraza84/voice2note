import { LLMProvider } from '../types';
import { LocalLLMProvider } from './local-ollama';
import { RemoteOpenAICompatibleLLMProvider } from './remote-openai-compatible';
import { getProcessingMode, isCloudOptInConfirmed } from '@/lib/config/processing-mode';

let defaultLLMProvider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (defaultLLMProvider) {
    return defaultLLMProvider;
  }

  const mode = getProcessingMode();

  // In local-private mode: Strictly enforce Local Ollama and fail-closed against remote inference
  if (mode === 'local-private') {
    defaultLLMProvider = new LocalLLMProvider();
    return defaultLLMProvider;
  }

  // In cloud-assisted mode: Explicit opt-in is required
  if (!isCloudOptInConfirmed()) {
    console.warn(
      '[Voice2Note] Cloud-Assisted LLM inference requested without explicit opt-in. Failing closed to LocalLLMProvider.'
    );
    defaultLLMProvider = new LocalLLMProvider();
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

  if (!forceLocal && (forceRemote || (isServerless && hasRemoteKey) || hasRemoteKey)) {
    defaultLLMProvider = new RemoteOpenAICompatibleLLMProvider();
  } else {
    defaultLLMProvider = new LocalLLMProvider();
  }

  return defaultLLMProvider;
}

export function setLLMProvider(provider: LLMProvider | null): void {
  defaultLLMProvider = provider;
}
