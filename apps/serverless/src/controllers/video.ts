import { Context } from 'hono';

import { videoRequestSchema } from 'utils';
import { AppContext } from '@/index';
import { readJsonBody } from '../utils/request';

const MAX_VIDEO_REQUEST_BYTES = 64 * 1024;

// Video generation is intentionally disabled on the shared serverless API.
// Video generation must remain BYOK-only and run directly from the client.
const VIDEO_GENERATION_ENABLED = false;

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
  void parsed.data;
  return c.json({ success: false, err: 'Video generation is not enabled.' }, 404);
};

export default video;
