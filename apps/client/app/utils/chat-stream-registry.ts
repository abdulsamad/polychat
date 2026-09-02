import type { ThreadId } from '@/store';

let active: { threadId: ThreadId; controller: AbortController } | null = null;
const discardedSignals = new WeakSet<AbortSignal>();

export const registerActiveStream = (threadId: ThreadId, controller: AbortController) => {
  active = { threadId, controller };
};

export const clearActiveStream = (controller: AbortController) => {
  if (active?.controller === controller) active = null;
};

export const abortThreadStream = (threadId: ThreadId) => {
  if (active?.threadId === threadId) active.controller.abort();
};

export const abortAllStreams = () => {
  if (active) {
    discardedSignals.add(active.controller.signal);
    active.controller.abort();
  }
  active = null;
};

export const isDiscardedStream = (signal?: AbortSignal) =>
  Boolean(signal && discardedSignals.has(signal));
