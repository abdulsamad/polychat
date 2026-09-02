import { Context } from 'hono';
import { streamText, APICallError } from 'ai';

import { chatRequestSchema, getAssistantConfig } from 'utils';

import { modelFactory } from '@models/factory';
import { AppContext } from '@/index';

const chat = async (c: Context<AppContext>) => {
  const startTime = Date.now();
  const user = c.get('user');
  const controller = new AbortController();
  const { signal } = controller;

  try {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, err: 'Invalid chat request.' }, 400);
    }
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) return c.json({ success: false, err: 'Invalid chat request.' }, 400);
    const {
      prompt,
      messages,
      language = 'en-US',
      profile = 'normal',
      customInstructions,
      model,
    } = parsed.data;

    console.info(
      `[CHAT] New request - User: ${user.id}, Model: ${model}, Language: ${language}, Profile: ${profile}, ${messages ? `Messages length: ${messages?.length}` : `Prompt length: ${prompt?.length}`}`
    );

    const modelInstance = modelFactory.createModel(model);
    const config = getAssistantConfig(
      profile as Parameters<typeof getAssistantConfig>[0],
      language,
      customInstructions
    );

    const result = streamText({
      model: modelInstance,
      instructions: config.prompt,
      messages: messages || [{ role: 'user', content: prompt || '' }],
      temperature: config.temperature,
      seed: config.seed,
      tools: config.tools,
      toolChoice: config.toolChoice,
      maxOutputTokens: config.maxTokens,
      topP: config.topP,
      frequencyPenalty: config.frequencyPenalty,
      presencePenalty: config.presencePenalty,
      stopSequences: config.stopSequences,
      providerOptions: model?.startsWith('gemini')
        ? {
            google: {
              safetySettings: [
                {
                  category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                  threshold: 'BLOCK_ONLY_HIGH',
                },
              ],
            },
          }
        : undefined,
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

    // Stream newline-delimited JSON so the client receives text deltas and
    // final usage metadata without mixing metadata into the visible response.
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(streamController) {
        let responseId: string | undefined;
        let responseModelId: string | undefined;
        let responseTimestamp: string | undefined;
        let finishReason: string | undefined;
        let isClosed = false;

        const getStreamErrorMessage = (error: unknown) => {
          if (APICallError.isInstance(error)) {
            return error.statusCode === 429
              ? 'API rate limit exceeded. Please try again later.'
              : error.message;
          }

          return 'Something went wrong while generating the response.';
        };

        const closeWithError = (error: unknown) => {
          if (isClosed) return;

          streamController.enqueue(
            encoder.encode(
              `${JSON.stringify({ type: 'error', error: getStreamErrorMessage(error) })}\n`
            )
          );
          streamController.close();
          isClosed = true;
        };

        try {
          for await (const part of result.fullStream) {
            if (part.type === 'text-delta') {
              streamController.enqueue(
                encoder.encode(`${JSON.stringify({ type: 'text', text: part.text })}\n`)
              );
            } else if (part.type === 'finish-step') {
              responseId = part.response.id;
              responseModelId = part.response.modelId;
              responseTimestamp = part.response.timestamp.toISOString();
              finishReason = part.finishReason;
            } else if (part.type === 'finish') {
              streamController.enqueue(
                encoder.encode(
                  `${JSON.stringify({
                    type: 'metadata',
                    metadata: {
                      usage: {
                        inputTokens: part.totalUsage.inputTokens,
                        outputTokens: part.totalUsage.outputTokens,
                        totalTokens: part.totalUsage.totalTokens,
                        reasoningTokens: part.totalUsage.outputTokenDetails.reasoningTokens,
                        cachedInputTokens: part.totalUsage.inputTokenDetails.cacheReadTokens,
                      },
                      finishReason: finishReason || part.finishReason,
                      responseId,
                      modelId: responseModelId,
                      timestamp: responseTimestamp,
                    },
                  })}\n`
                )
              );
            } else if (part.type === 'error') {
              closeWithError(part.error);
              return;
            }
          }
          if (!isClosed) {
            streamController.close();
            isClosed = true;
          }
        } catch (error) {
          closeWithError(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    if (APICallError.isInstance(err)) {
      console.error(`[CHAT] API Call Error for user ${user.id}: `, err.message);
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

    console.error(`[CHAT] Unexpected error for user ${user.id}: `, err);
    return c.json({ err: 'Something went wrong!' }, 500);
  }
};

export default chat;
