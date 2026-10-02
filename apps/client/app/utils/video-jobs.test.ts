import assert from 'node:assert/strict';
import { test } from 'node:test';
import { finishVideoJob, isVideoJobActive } from './video-jobs';

test('checking an existing job never submits generation and releases its lock on abort', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error('Unexpected request');
  };
  const controller = new AbortController();
  try {
    const result = finishVideoJob(
      { id: 'saved-job', status: 'pending' },
      'user-key',
      controller.signal
    );
    assert.equal(isVideoJobActive('saved-job'), true);
    await assert.rejects(
      finishVideoJob({ id: 'saved-job', status: 'pending' }, 'user-key'),
      /already/
    );
    controller.abort();
    await assert.rejects(result, { name: 'AbortError' });
    assert.equal(isVideoJobActive('saved-job'), false);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test('terminal provider failures retain their reason without another request', async () => {
  await assert.rejects(
    finishVideoJob(
      { id: 'failed-job', status: 'failed', error: 'Content policy restriction' },
      'user-key'
    ),
    (error: unknown) =>
      error instanceof Error &&
      'terminal' in error &&
      error.terminal === true &&
      /policy/.test(error.message)
  );
  assert.equal(isVideoJobActive('failed-job'), false);
});

test('completed saved jobs download existing content without a paid submission', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://openrouter.ai/api/v1/videos/completed-job/content?index=0');
    assert.notEqual(init?.method, 'POST');
    return new Response(new Blob(['mock video'], { type: 'video/mp4' }));
  };
  try {
    const result = await finishVideoJob(
      { id: 'completed-job', status: 'completed', usage: { cost: 0.25 } },
      'user-key'
    );
    assert.equal(result.jobId, 'completed-job');
    assert.equal(result.status, 'ready');
    assert.equal(result.cost, 0.25);
    assert.equal(calls, 1);
    URL.revokeObjectURL(result.url);
  } finally {
    globalThis.fetch = original;
  }
});

test('checking a saved job requires BYOK before taking a lock or making requests', async () => {
  await assert.rejects(finishVideoJob({ id: 'locked-job', status: 'pending' }, ''), /BYOK/);
  assert.equal(isVideoJobActive('locked-job'), false);
});
