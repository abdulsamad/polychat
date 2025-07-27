import { Context } from 'hono';
import { experimental_generateImage as generateImage, APICallError } from 'ai';

import { openAiClient } from '@models/index';
import { AppContext } from '@/index';

const image = async (c: Context<AppContext>) => {
  const startTime = Date.now();
  const user = c.get('user');

  try {
    const { model, prompt, n = 1, quality, style, size = '1024x1024' } = await c.req.json();

    if (!prompt) {
      console.warn(`[IMAGE] Missing prompt in request - User: ${user.id}`);
      return c.json({ success: false, err: 'Prompt not found' }, 400);
    }

    console.info(
      `[IMAGE] New request - User: ${user.id}, Model: ${model}, Size: ${size}, Quality: ${quality}, Style: ${style}, Prompt length: ${prompt.length}, Number of images: ${n}`
    );

    const { image } = await generateImage({
      model: openAiClient.image(model),
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
      return c.json({ success: false, err: err.message }, 500);
    }

    console.error(`[IMAGE] Unexpected error - ` + `User: ${user.id}, ` + `Error:`, err);
    return c.json({ success: false, err: 'Something went wrong' }, 500);
  }
};

export default image;
