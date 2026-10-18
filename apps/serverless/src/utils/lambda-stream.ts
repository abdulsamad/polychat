// Streaming adapter for Lambda Function URLs. Hono's streamHandle builds the Request
// without an AbortSignal and keeps writing to a destroyed response stream, so the
// provider call keeps generating after the client leaves. This adapter aborts the
// request signal when the response stream closes or errors, or nears the timeout.
import type { Writable } from 'node:stream';
import type { Env, Hono } from 'hono';
import type { LambdaContext, LambdaEvent } from 'hono/aws-lambda';

type FunctionUrlEvent = Extract<LambdaEvent, { rawPath: string }>;
type ResponseMetadata = {
  statusCode: number;
  headers?: Record<string, string>;
  cookies?: string[];
};
type StreamingHandler = (
  event: FunctionUrlEvent,
  responseStream: Writable,
  context: LambdaContext
) => Promise<void>;

// Provided by the Lambda Node.js runtime; not present in local development.
declare const awslambda: {
  streamifyResponse: (handler: StreamingHandler) => StreamingHandler;
  HttpResponseStream: { from: (stream: Writable, metadata: ResponseMetadata) => Writable };
};

const REMAINING_TIME_FLOOR_MS = 3000;
const DEADLINE_CHECK_MS = 1000;

const buildRequest = (event: FunctionUrlEvent, signal: AbortSignal) => {
  const { method } = event.requestContext.http;
  const headers = new Headers();
  for (const [name, value] of Object.entries(event.headers)) {
    if (value !== undefined) headers.set(name, value);
  }
  if (event.cookies?.length) headers.set('cookie', event.cookies.join('; '));

  const host = event.headers.host ?? event.requestContext.domainName;
  const query = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const hasBody = method !== 'GET' && method !== 'HEAD' && Boolean(event.body);
  const body = hasBody
    ? new Uint8Array(Buffer.from(event.body ?? '', event.isBase64Encoded ? 'base64' : 'utf8'))
    : undefined;

  return new Request(`https://${host}${event.rawPath}${query}`, {
    method,
    headers,
    body,
    signal,
  });
};

const waitForDrain = (out: Writable, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const settle = () => {
      out.off('drain', settle);
      out.off('close', settle);
      out.off('error', settle);
      signal.removeEventListener('abort', settle);
      resolve();
    };
    out.on('drain', settle);
    out.on('close', settle);
    out.on('error', settle);
    signal.addEventListener('abort', settle, { once: true });
  });

const pump = async (
  body: ReadableStream<Uint8Array>,
  out: Writable,
  controller: AbortController,
  context: LambdaContext
) => {
  const reader = body.getReader();
  // Cancelling the body runs the ReadableStream cancel() in chat.ts, which aborts streamText.
  const cancel = () => void reader.cancel().catch(() => undefined);
  controller.signal.addEventListener('abort', cancel, { once: true });

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;

      if (context.getRemainingTimeInMillis() < REMAINING_TIME_FLOOR_MS) {
        controller.abort();
        return;
      }
      if (out.destroyed || out.writableEnded) {
        controller.abort();
        return;
      }
      if (!out.write(value) && !controller.signal.aborted) {
        await waitForDrain(out, controller.signal);
      }
    }
  } catch (error) {
    controller.abort();
    throw error;
  } finally {
    controller.signal.removeEventListener('abort', cancel);
  }
};

export const streamHandle = <E extends Env>(app: Hono<E>): StreamingHandler =>
  awslambda.streamifyResponse(async (event, responseStream, context) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    let out: Writable | undefined;

    responseStream.once('close', abort);
    responseStream.once('error', abort);
    const deadline = setInterval(() => {
      if (context.getRemainingTimeInMillis() < REMAINING_TIME_FLOOR_MS) abort();
    }, DEADLINE_CHECK_MS);

    try {
      const res = await app.fetch(buildRequest(event, controller.signal), {
        event,
        requestContext: event.requestContext,
        context,
      });

      const headers: Record<string, string> = {};
      const cookies: string[] = [];
      res.headers.forEach((value, name) => {
        if (name === 'set-cookie') cookies.push(value);
        else headers[name] = value;
      });
      out = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: res.status,
        headers,
        cookies,
      });
      if (res.body) await pump(res.body, out, controller, context);
    } catch (error) {
      console.error('Error processing request:', error);
      abort();
      if (!out) {
        out = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: 500,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
        out.write('Internal Server Error');
      }
    } finally {
      clearInterval(deadline);
      responseStream.off('close', abort);
      responseStream.off('error', abort);
      const stream = out ?? responseStream;
      if (!stream.writableEnded) stream.end();
    }
  });
