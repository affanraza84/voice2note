import { LLMProvider, Message, GenerationOptions } from '../types';

export class LocalLLMProvider implements LLMProvider {
  readonly id = 'local-ollama';
  readonly name = 'Local Ollama Engine';
  readonly model: string;
  private baseUrl: string;

  constructor(model = 'llama3.2:latest', baseUrl = 'http://127.0.0.1:11434') {
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async isReady(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async generate(messages: Message[], options?: GenerationOptions): Promise<string> {
    const isOnline = await this.isReady();
    if (!isOnline) {
      throw new Error(
        `Local LLM service (Ollama) is not reachable at ${this.baseUrl}. Please run 'ollama serve' and ensure '${this.model}' is installed.`
      );
    }

    // Convert OpenAI-style messages to prompt if using /api/generate or call /api/chat
    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const body: Record<string, any> = {
      model: this.model,
      messages: formattedMessages,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.1,
      },
    };

    if (options?.responseFormat === 'json') {
      body.format = 'json';
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Ollama generation error (${res.status}): ${errorText}`);
      }

      const data = await res.json();
      const content = data.message?.content || '';
      return content.trim();
    } catch (err: any) {
      console.error('Ollama generate error:', err);
      throw new Error(`Failed to generate LLM response: ${err?.message || err}`);
    }
  }
}
