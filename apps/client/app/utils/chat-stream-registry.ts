import type { ThreadId } from '@/store';

let active: { threadId: ThreadId; controller: AbortController } | null = null;

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
  active?.controller.abort();
  active = null;
};
