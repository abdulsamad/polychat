import { Context } from 'hono';
import { generateImage, APICallError } from 'ai';

import { imageRequestSchema } from 'utils';
import { openAiClient } from '@models/index';
import { AppContext } from '@/index';

const image = async (c: Context<AppContext>) => {
  const startTime = Date.now();
  const user = c.get('user');

  try {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, err: 'Invalid image request.' }, 400);
    }
    const parsed = imageRequestSchema.safeParse(body);
    if (!parsed.success) return c.json({ success: false, err: 'Invalid image request.' }, 400);
    const { model, prompt, n, quality, style, size = '1024x1024' } = parsed.data;

    console.info(
      `[IMAGE] New request - User: ${user.id}, Model: ${model}, Size: ${size}, Quality: ${quality}, Style: ${style}, Prompt length: ${prompt.length}, Number of images: ${n}`
    );

    const { image } = await generateImage({
      model: openAiClient.imageModel(model),
      prompt,
      n,
      size,
      aspectRatio: '16:9',
      providerOptions: {
        openai: {
          style,
          quality,
        },
      },
    });

    const b64_json = image.base64;
    const duration = Date.now() - startTime;
    console.info(
      `[IMAGE] Request completed - User: ${user.id}, Duration: ${duration}ms, Response size: ${b64_json.length} chars`
    );

    return c.json({ success: true, b64_json, image });
  } catch (err) {
    if (APICallError.isInstance(err)) {
      console.error(`[IMAGE] API Error - User: ${user.id}, Error: ${err.message}`);
      return c.json(
        {
          success: false,
          err: err.statusCode === 429 ? 'API rate limit exceeded. Please try again later.' : err.message,
        },
        err.statusCode === 429 ? 429 : 500
      );
    }

    console.error(`[IMAGE] Unexpected error - ` + `User: ${user.id}, ` + `Error:`, err);
    return c.json({ success: false, err: 'Something went wrong' }, 500);
  }
};

export default image;
