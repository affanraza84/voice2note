import { EmbeddingProvider } from '../types';

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'local-minilm';
  readonly name = 'Local MiniLM (Transformers.js / ONNX)';
  readonly dimensions = 384;
  readonly model = 'Xenova/all-MiniLM-L6-v2';

  private pipelinePromise: Promise<any> | null = null;

  private async getEmbedder() {
    if (!this.pipelinePromise) {
      this.pipelinePromise = (async () => {
        const { pipeline, env } = await import('@xenova/transformers');
        const isServerless = Boolean(
          process.env.VERCEL ||
          process.env.AWS_LAMBDA_FUNCTION_NAME ||
          (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production')
        );
        if (isServerless) {
          env.cacheDir = '/tmp/transformers-cache';
        }
        return pipeline('feature-extraction', this.model, {
          quantized: true,
        });
      })();
    }
    return this.pipelinePromise;
  }

  async isReady(): Promise<boolean> {
    try {
      await this.getEmbedder();
      return true;
    } catch {
      return false;
    }
  }

  async embed(text: string): Promise<number[]> {
    const cleanText = text.trim();
    if (!cleanText) {
      return new Array(this.dimensions).fill(0);
    }

    try {
      const embedder = await this.getEmbedder();
      const output = await embedder(cleanText, {
        pooling: 'mean',
        normalize: true,
      });

      return Array.from(output.data);
    } catch (err: any) {
      console.error('Local embedding error:', err);
      throw new Error(`Embedding generation failed: ${err?.message || err}`);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      const vec = await this.embed(text);
      results.push(vec);
    }
    return results;
  }
}
