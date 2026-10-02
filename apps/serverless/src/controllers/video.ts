import { Context } from 'hono';

import { fetchVideoApi, VideoApiError, videoRequestSchema } from 'utils';
import { AppContext } from '@/index';
import { readJsonBody } from '../utils/request';

const MAX_VIDEO_REQUEST_BYTES = 8 * 1024 * 1024;
const MAX_HOSTED_REFERENCE_BYTES = 2 * 1024 * 1024;

// Video generation is intentionally disabled on the shared serverless API.
// No environment variable can enable this or fund video requests with a server key.
const VIDEO_GENERATION_ENABLED = false;

const dataUrlByteLength = (dataUrl: string) => {
  const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding);
};

const video = async (c: Context<AppContext>) => {
  if (!VIDEO_GENERATION_ENABLED) {
    return c.json(
      {
        success: false,
        err: 'Video generation is disabled on the shared serverless API. Use BYOK instead.',
      },
      404
    );
  }

  const requestBody = await readJsonBody(c.req.raw, MAX_VIDEO_REQUEST_BYTES);
  if (!requestBody.success) {
    return c.json(
      {
        success: false,
        err: requestBody.status === 413 ? 'Video request is too large.' : 'Invalid video request.',
      },
      requestBody.status
    );
  }

  const parsed = videoRequestSchema.safeParse(requestBody.body);
  if (!parsed.success) return c.json({ success: false, err: 'Invalid video request.' }, 400);

  // Keep the request contract ready for a future private implementation. This branch is
  // unreachable until the private BYOK feature is explicitly enabled.
  const {
    model,
    prompt,
    inputReferences = [],
    duration,
    resolution,
    aspectRatio,
    generateAudio,
    seed,
  } = parsed.data;
  const totalReferenceBytes = inputReferences.reduce(
    (total, reference) => total + dataUrlByteLength(reference.dataUrl),
    0
  );
  if (totalReferenceBytes > MAX_HOSTED_REFERENCE_BYTES) {
    return c.json({ success: false, err: 'Hosted reference media is limited to 2 MB.' }, 413);
  }
  const apiKey = c.req.header('X-Video-API-Key')?.trim();
  if (!apiKey) {
    return c.json(
      { success: false, err: 'Video generation requires your OpenRouter BYOK key.' },
      400
    );
  }

  try {
    const response = await fetchVideoApi('/api/v1/videos', apiKey, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        ...(seed !== undefined ? { seed } : {}),
        ...(inputReferences.length
          ? {
              input_references: inputReferences.map((reference) =>
                reference.mediaType.startsWith('video/')
                  ? { type: 'video_url', video_url: { url: reference.dataUrl } }
                  : { type: 'image_url', image_url: { url: reference.dataUrl } }
              ),
            }
          : {}),
        ...(duration ? { duration } : {}),
        ...(resolution ? { resolution } : {}),
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
        ...(generateAudio !== undefined ? { generate_audio: generateAudio } : {}),
      }),
      signal: c.req.raw.signal,
    });
    const responseBody = await response.json();
    return c.json(responseBody, 202);
  } catch (error) {
    return videoError(c, error);
  }
};

export default video;

const videoError = (c: Context<AppContext>, error: unknown) => {
  const status = error instanceof VideoApiError ? error.status : undefined;
  return c.json(
    {
      success: false,
      err:
        error instanceof VideoApiError
          ? error.message
          : 'The video service is unavailable. Try again later.',
    },
    status === 400 ||
      status === 401 ||
      status === 402 ||
      status === 403 ||
      status === 404 ||
      status === 410 ||
      status === 429
      ? status
      : 502
  );
};

const readVideoJob = async (c: Context<AppContext>, content: boolean) => {
  // This gate must run before credentials are read or any provider request is made.
  if (!VIDEO_GENERATION_ENABLED) {
    return c.json(
      {
        success: false,
        err: 'Video generation is disabled on the shared serverless API. Use BYOK instead.',
      },
      404
    );
  }
  const apiKey = c.req.header('X-Video-API-Key')?.trim();
  if (!apiKey)
    return c.json(
      { success: false, err: 'Video generation requires your OpenRouter BYOK key.' },
      400
    );
  const id = c.req.param('jobId');
  if (!id || !/^[a-zA-Z0-9_-]{1,200}$/.test(id))
    return c.json({ success: false, err: 'Invalid video job ID.' }, 400);
  const index = c.req.query('index') ?? '0';
  if (content && !/^\d{1,2}$/.test(index))
    return c.json({ success: false, err: 'Invalid video output index.' }, 400);
  try {
    const response = await fetchVideoApi(
      `/api/v1/videos/${encodeURIComponent(id)}${content ? `/content?index=${index}` : ''}`,
      apiKey,
      { signal: c.req.raw.signal }
    );
    if (!content) return c.json(await response.json());
    const mediaType = response.headers.get('Content-Type') || '';
    if (!mediaType.startsWith('video/'))
      return c.json({ success: false, err: 'Invalid video content.' }, 502);
    return new Response(response.body, {
      headers: { 'Content-Type': mediaType, 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return videoError(c, error);
  }
};

export const videoStatus = (c: Context<AppContext>) => readVideoJob(c, false);
export const videoContent = (c: Context<AppContext>) => readVideoJob(c, true);
