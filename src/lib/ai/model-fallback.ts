import { google } from '@ai-sdk/google';
import { APICallError, RetryError, type LanguageModel } from 'ai';

// Comma-separated list in env, first = primary. Different models have different capacity pools.
const DEFAULT_CHAIN = 'gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite';

export const MODEL_IDS = (process.env.GEMINI_MODEL_CHAIN ?? DEFAULT_CHAIN)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const DEFAULT_TIMEOUT_MS = 15_000;

export function isTransient(err: unknown): boolean {
  if (RetryError.isInstance(err)) return isTransient(err.lastError);
  if (APICallError.isInstance(err)) {
    const status = err.statusCode ?? 0;
    return err.isRetryable || status === 429 || status >= 500;
  }
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return true;
  }
  return false;
}

export async function runWithModelFallback<T>(
  run: (model: LanguageModel, signal: AbortSignal) => Promise<T>,
  opts?: { timeoutMs?: number; modelIds?: string[] },
): Promise<{ result: T; modelId: string }> {
  const ids = opts?.modelIds ?? MODEL_IDS;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const errors: unknown[] = [];

  for (const id of ids) {
    try {
      const result = await run(google(id), AbortSignal.timeout(timeoutMs));
      return { result, modelId: id };
    } catch (err) {
      errors.push(err);
      console.warn(`[ai] ${id} failed:`, err instanceof Error ? err.message : err);
      // Bad request / schema / auth errors won't be fixed by another model.
      if (!isTransient(err)) throw err;
    }
  }

  throw new AggregateError(errors, 'All models in the fallback chain failed');
}