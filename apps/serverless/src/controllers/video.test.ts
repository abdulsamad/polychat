import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Hono } from 'hono';
import type { AppContext } from '@/index';
import video, { videoContent, videoStatus } from './video';

test('every video backend route stays disabled even with server and user keys configured', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'server-key-must-never-be-used';
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls++;
    throw new Error('Video backend called a provider');
  };
  const app = new Hono<AppContext>();
  app.post('/video', video);
  app.get('/video/:jobId', videoStatus);
  app.get('/video/:jobId/content', videoContent);
  try {
    for (const [path, method] of [
      ['/video', 'POST'],
      ['/video/job-1', 'GET'],
      ['/video/job-1/content', 'GET'],
    ]) {
      const response = await app.request(path, {
        method,
        headers: { 'X-Video-API-Key': 'user-key' },
      });
      assert.equal(response.status, 404);
      assert.match((await response.json()).err, /disabled/);
    }
    assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) Reflect.deleteProperty(process.env, 'OPENROUTER_API_KEY');
    else process.env.OPENROUTER_API_KEY = originalKey;
  }
});
