import { Context } from 'hono';

import { videoRequestSchema } from 'utils';
import { AppContext } from '@/index';
import { readJsonBody } from '../utils/request';

const MAX_VIDEO_REQUEST_BYTES = 8 * 1024 * 1024;
const MAX_HOSTED_REFERENCE_BYTES = 2 * 1024 * 1024;

// Video generation is intentionally disabled on the shared serverless API.
// Video generation must remain BYOK-only and run directly from the client.
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
  // unreachable until the shared-plan feature is explicitly enabled.
  const {
    model,
    prompt,
    inputReferences = [],
    duration,
    resolution,
    aspectRatio,
    generateAudio,
  } = parsed.data;
  const totalReferenceBytes = inputReferences.reduce(
    (total, reference) => total + dataUrlByteLength(reference.dataUrl),
    0
  );
  if (totalReferenceBytes > MAX_HOSTED_REFERENCE_BYTES) {
    return c.json({ success: false, err: 'Hosted reference media is limited to 2 MB.' }, 413);
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return c.json({ success: false, err: 'Video generation is not configured.' }, 503);
  }

  const response = await fetch('https://openrouter.ai/api/v1/videos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
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
  return c.json(responseBody, response.status as 200);
};

export default video;
