export const OPENROUTER_VIDEO_ORIGIN = 'https://openrouter.ai';

/** Never send a user's credential to a URL supplied by an untrusted response. */
export const resolveVideoApiUrl = (value: string) => {
  const url = new URL(value, OPENROUTER_VIDEO_ORIGIN);
  if (
    url.origin !== OPENROUTER_VIDEO_ORIGIN ||
    url.username ||
    url.password ||
    !(url.pathname === '/api/v1/videos' || url.pathname.startsWith('/api/v1/videos/'))
  ) {
    throw new Error('The video service returned an unsafe URL.');
  }
  return url.toString();
};

export interface VideoJob {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired';
  polling_url?: string;
  unsigned_urls?: string[];
  error?: string | { message?: string };
  usage?: { cost?: number };
}

export class VideoApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public terminal = false
  ) {
    super(message);
    this.name = 'VideoApiError';
  }
}

export const parseVideoJob = (value: unknown): VideoJob => {
  if (!value || typeof value !== 'object') throw new VideoApiError('Invalid video job response.');
  const job = value as VideoJob;
  if (
    typeof job.id !== 'string' ||
    !job.id ||
    !['pending', 'in_progress', 'completed', 'failed', 'cancelled', 'expired'].includes(
      job.status
    ) ||
    (job.polling_url !== undefined && typeof job.polling_url !== 'string') ||
    (job.unsigned_urls !== undefined &&
      (!Array.isArray(job.unsigned_urls) ||
        job.unsigned_urls.some((url) => typeof url !== 'string')))
  )
    throw new VideoApiError('Invalid video job response.');
  return job;
};

export const fetchVideoApi = async (url: string, apiKey: string, init: RequestInit = {}) => {
  if (!apiKey.trim())
    throw new VideoApiError('Unlock or add your OpenRouter BYOK key in Settings.');
  const response = await fetch(resolveVideoApiUrl(url), {
    ...init,
    redirect: 'error',
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(120000)])
      : AbortSignal.timeout(120000),
    headers: {
      ...Object.fromEntries(new Headers(init.headers)),
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    const fallback =
      response.status === 401 || response.status === 403
        ? 'Your OpenRouter key could not authorize this video. Check your key in Settings.'
        : response.status === 402
          ? 'Your OpenRouter account has insufficient credits.'
          : response.status === 429
            ? 'OpenRouter is rate limiting requests. Wait a moment and try checking again.'
            : response.status === 404 || response.status === 410
              ? 'This video is unavailable or its link has expired.'
              : `The video service returned an error (${response.status}). Try checking again.`;
    throw new VideoApiError(fallback, response.status);
  }
  return response;
};
