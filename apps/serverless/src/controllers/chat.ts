import { Context } from 'hono';
import { streamText, APICallError } from 'ai';

import { getAssistantConfig } from 'utils';

import { modelFactory } from '@models/factory';
import { AppContext } from '@/index';

const chat = async (c: Context<AppContext>) => {
  const startTime = Date.now();
  const user = c.get('user');
  const controller = new AbortController();
  const { signal } = controller;

  try {
    const { prompt, messages, language, variation, model } = await c.req.json();

    if (!prompt && !messages) {
      console.warn('[CHAT] Missing prompt or messages in request');
      return c.json({ success: false, err: 'Prompt or messages not found' }, 400);
    }

    console.info(
      `[CHAT] New request - User: ${user.id}, Model: ${model}, Language: ${language}, Variation: ${variation}, ${messages ? `Messages length: ${messages?.length}` : `Prompt length: ${prompt?.length}`}`
    );

    const modelInstance = modelFactory.createModel(model);
    const config = getAssistantConfig(variation, language);

    const result = streamText({
      model: modelInstance,
      messages: [
        { role: 'system', content: config.prompt },
        ...(messages || [{ role: 'user', content: prompt }]),
      ],
      temperature: config.temperature,
      seed: config.seed,
      tools: config.tools,
      toolChoice: config.toolChoice,
      toolCallStreaming: config.toolCallStreaming,
      maxTokens: config.maxTokens,
      topP: config.topP,
      frequencyPenalty: config.frequencyPenalty,
      presencePenalty: config.presencePenalty,
      stopSequences: config.stopSequences,
      abortSignal: signal,
      onError: (event) => {
        console.error(`[CHAT] Stream error for user ${user.id}: ${event.error}`);
        controller.abort();
      },
      onFinish: ({ usage, finishReason }) => {
        const duration = Date.now() - startTime;

        console.info(
          `[CHAT] Request completed - Duration: ${duration}ms, User: ${user.id} Total tokens: ${usage?.totalTokens} Finish Reason: ${finishReason}`
        );
      },
    });

    // Return streaming response
    return result.toTextStreamResponse();
  } catch (err) {
    if (APICallError.isInstance(err)) {
      console.error(`[CHAT] API Call Error for user ${user.id}: `, err.message);
      return c.json({ err: err.message }, 500);
    }

    console.error(`[CHAT] Unexpected error for user ${user.id}: `, err);
    return c.json({ err: 'Something went wrong!' }, 500);
  }
};

export default chat;
