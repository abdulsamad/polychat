import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchVideoApi, parseVideoJob, resolveVideoApiUrl, VideoApiError } from '../src/video';

test('relative video URLs resolve to OpenRouter and unsafe credential destinations are rejected', () => {
  assert.equal(
    resolveVideoApiUrl('/api/v1/videos/job-1'),
    'https://openrouter.ai/api/v1/videos/job-1'
  );
  for (const url of [
    'https://example.com/api/v1/videos/job',
    '//example.com/api/v1/videos/job',
    'http://openrouter.ai/api/v1/videos/job',
    'https://user:pass@openrouter.ai/api/v1/videos/job',
    '/api/v1/chat/completions',
    '/api/v1/videos/../../keys',
  ]) {
    assert.throws(() => resolveVideoApiUrl(url));
  }
});

test('video requests fail before fetch without BYOK or with an unsafe URL', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error('Unexpected request');
  };
  try {
    await assert.rejects(fetchVideoApi('/api/v1/videos', ''), /BYOK/);
    await assert.rejects(
      fetchVideoApi('https://example.com/api/v1/videos/job', 'user-key'),
      /unsafe/
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test('authenticated video requests reject redirects and preserve actionable error status', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/videos/job');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer user-key');
    assert.equal(init?.redirect, 'error');
    return new Response('{}', { status: 402 });
  };
  try {
    await assert.rejects(
      fetchVideoApi('/api/v1/videos/job', 'user-key'),
      (error: unknown) =>
        error instanceof VideoApiError && error.status === 402 && /credits/.test(error.message)
    );
  } finally {
    globalThis.fetch = original;
  }
});

test('malformed job responses are rejected before polling', () => {
  for (const value of [
    null,
    {},
    { id: 'job', status: 'unknown' },
    { id: 'job', status: 'completed', unsigned_urls: [123] },
  ]) {
    assert.throws(() => parseVideoJob(value));
  }
  assert.equal(parseVideoJob({ id: 'job', status: 'pending' }).id, 'job');
});
