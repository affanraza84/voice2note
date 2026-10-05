import { LLMProvider, Message, GenerationOptions } from '../types';

export class RemoteOpenAICompatibleLLMProvider implements LLMProvider {
  readonly id = 'remote-llm';
  readonly name = 'Remote LLM (OpenAI-Compatible API)';
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(options?: { model?: string; apiKey?: string; baseUrl?: string }) {
    this.apiKey =
      options?.apiKey ||
      process.env.AI_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.OPENAI_API_KEY ||
      '';

    if (process.env.GROQ_API_KEY && !options?.baseUrl && !process.env.AI_BASE_URL) {
      this.baseUrl = 'https://api.groq.com/openai/v1';
      this.model = options?.model || process.env.AI_MODEL || 'llama-3.3-70b-versatile';
    } else {
      this.baseUrl = (
        options?.baseUrl ||
        process.env.AI_BASE_URL ||
        'https://api.openai.com/v1'
      ).replace(/\/$/, '');
      this.model = options?.model || process.env.AI_MODEL || 'gpt-4o-mini';
    }
  }

  async isReady(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async generate(messages: Message[], options?: GenerationOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        'Remote LLM provider is not configured. Please set the AI_API_KEY or GROQ_API_KEY environment variable in production.'
      );
    }

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const body: Record<string, any> = {
      model: this.model,
      messages: formattedMessages,
      temperature: options?.temperature ?? 0.1,
    };

    if (options?.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const endpoint = `${this.baseUrl}/chat/completions`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Remote LLM error (${res.status}): ${errorText}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      return content.trim();
    } catch (err: any) {
      console.error('Remote LLM generate error:', err);
      throw new Error(`Failed to generate response from remote LLM: ${err?.message || err}`);
    }
  }
}
