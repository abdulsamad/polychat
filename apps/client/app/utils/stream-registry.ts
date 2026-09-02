import type { ThreadId } from '@/store';

const controllers = new Map<ThreadId, AbortController>();

export const registerThreadStream = (threadId: ThreadId, controller: AbortController) => {
  if (controllers.size > 0) return false;
  controllers.set(threadId, controller);
  return true;
};

export const unregisterThreadStream = (threadId: ThreadId, controller: AbortController) => {
  if (controllers.get(threadId) === controller) controllers.delete(threadId);
};

export const abortThreadStream = (threadId: ThreadId) => {
  controllers.get(threadId)?.abort();
};

export const abortAllThreadStreams = () => {
  for (const controller of controllers.values()) controller.abort();
  controllers.clear();
};
