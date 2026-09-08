import { Context } from 'hono';
import { generateImage, APICallError } from 'ai';

import { imageRequestSchema, supportedImageModels } from 'utils';
import { modelFactory } from '@models/factory';
import { AppContext } from '@/index';
import { readJsonBody } from '../utils/request';

const MAX_IMAGE_REQUEST_BYTES = 32 * 1024;

const image = async (c: Context<AppContext>) => {
  const startTime = Date.now();
  const user = c.get('user');
  const controller = new AbortController();
  if (c.req.raw.signal.aborted) controller.abort();
  c.req.raw.signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const requestBody = await readJsonBody(c.req.raw, MAX_IMAGE_REQUEST_BYTES);
    if (!requestBody.success) {
      return c.json(
        {
          success: false,
          err:
            requestBody.status === 413 ? 'Image request is too large.' : 'Invalid image request.',
        },
        requestBody.status
      );
    }

    const parsed = imageRequestSchema.safeParse(requestBody.body);
    if (!parsed.success) return c.json({ success: false, err: 'Invalid image request.' }, 400);
    const { model, prompt, n, quality, style, size = '1024x1024' } = parsed.data;

    if (!supportedImageModels.some((entry) => entry.name === model)) {
      return c.json({ success: false, err: 'This image model requires BYOK.' }, 400);
    }

    console.info(
      `[IMAGE] New request - User: ${user.id}, Model: ${model}, Size: ${size}, Quality: ${quality}, Style: ${style}, Prompt length: ${prompt.length}, Number of images: ${n}`
    );

    const isAspectRatio = size.includes(':');

    const imageResult = await generateImage({
      model: modelFactory.createImageModel(model),
      prompt,
      n,
      size: isAspectRatio ? undefined : (size as `${number}x${number}`),
      aspectRatio: isAspectRatio ? (size as `${number}:${number}`) : undefined,
      abortSignal: controller.signal,
      providerOptions:
        model === 'dall-e-3'
          ? {
              openai: {
                style,
                quality,
              },
            }
          : undefined,
    });
    const { image } = imageResult;
    const providerMetadata = imageResult.providerMetadata as
      | { openai?: { images?: Array<{ revisedPrompt?: unknown }> } }
      | undefined;
    const revisedPrompt = providerMetadata?.openai?.images?.[0]?.revisedPrompt;

    const b64_json = image.base64;
    const duration = Date.now() - startTime;
    console.info(
      `[IMAGE] Request completed - User: ${user.id}, Duration: ${duration}ms, Response size: ${b64_json.length} chars`
    );

    return c.json({
      success: true,
      b64_json,
      ...(typeof revisedPrompt === 'string' ? { revisedPrompt } : {}),
      usage: imageResult.usage,
    });
  } catch (err) {
    if (APICallError.isInstance(err)) {
      console.error(`[IMAGE] API Error - User: ${user.id}, Error: ${err.message}`);
      return c.json(
        {
          success: false,
          err:
            err.statusCode === 429
              ? 'API rate limit exceeded. Please try again later.'
              : err.message,
        },
        err.statusCode === 429 ? 429 : 500
      );
    }

    console.error(`[IMAGE] Unexpected error - ` + `User: ${user.id}, ` + `Error:`, err);
    return c.json({ success: false, err: 'Something went wrong' }, 500);
  }
};

export default image;
