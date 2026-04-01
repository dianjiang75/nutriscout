/**
 * Fetch wrapper with exponential backoff retry for external API calls.
 * Retries on transient failures (429, 500, 502, 503, 504) and network errors.
 *
 * Google API recommendation: baseDelay * 2^attempt + jitter, max 3 retries.
 */

interface FetchRetryOptions {
  /** Max number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms before first retry (default: 1000) */
  baseDelayMs?: number;
  /** Max delay cap in ms (default: 15000) */
  maxDelayMs?: number;
  /** Request timeout in ms (default: 10000) */
  timeoutMs?: number;
  /** HTTP status codes that trigger a retry */
  retryableStatuses?: number[];
}

const DEFAULT_RETRYABLE = [429, 500, 502, 503, 504];

/**
 * Fetch with automatic retry on transient failures.
 * Uses exponential backoff with jitter to avoid thundering herd.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: FetchRetryOptions
): Promise<Response> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelay = options?.baseDelayMs ?? 1000;
  const maxDelay = options?.maxDelayMs ?? 15000;
  const timeout = options?.timeoutMs ?? 10000;
  const retryable = options?.retryableStatuses ?? DEFAULT_RETRYABLE;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(timeout),
      });

      // Success or non-retryable error — return immediately
      if (res.ok || !retryable.includes(res.status)) {
        return res;
      }

      // Retryable status — check if we have retries left
      if (attempt === maxRetries) {
        return res; // Return the failed response on last attempt
      }

      // Check for Retry-After header (respect rate limit signals)
      const retryAfter = res.headers.get("Retry-After");
      const retryDelay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 500, maxDelay);

      await sleep(retryDelay);
    } catch (err) {
      lastError = err as Error;

      // Network error or timeout — retry if attempts remain
      if (attempt === maxRetries) {
        throw new Error(
          `fetchWithRetry failed after ${maxRetries + 1} attempts: ${lastError.message}`
        );
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 500, maxDelay);
      await sleep(delay);
    }
  }

  // Should not reach here, but TypeScript needs it
  throw lastError ?? new Error("fetchWithRetry: unexpected state");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
