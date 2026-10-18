import { useCallback, useEffect, useRef, type HTMLAttributes } from 'react';
import { useAtomValue } from 'jotai';
import { useUser } from '@clerk/react-router';
import clsx from 'clsx';
import { useReducedMotion } from 'motion/react';
import { RotateCcwIcon } from 'lucide-react';

import {
  threadAtom,
  threadChatErrorsAtom,
  threadLoadingAtom,
  messagesAtom,
  threadQueuedJobAtom,
} from '@/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSidebar } from '@/components/ui/sidebar';
import Message from '@/components/Message';
import { Button } from '@/components/ui/button';
import useSubmitMessage from '@/hooks/useSubmitMessage';
import { getName } from '@/utils';
import { getAnonymousWorkspaceAccount } from '@/utils/lforage';
import { getVaultSnapshot } from '@/utils/byok-vault';
import { profiles } from 'utils';
import { supportedImageModels } from 'utils';

import Empty from './Empty';
import Typing from './Typing';
import UsageStatus from './UsageStatus';
import ImageGenerating from './ImageGenerating';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export type UserInfo = Record<
  'user' | 'assistant',
  {
    name: string | undefined | null;
    avatarImageSrc: string;
    messageClassNames: HTMLAttributes<HTMLSpanElement>['className'];
  }
>;

interface ThreadProps {
  className?: HTMLAttributes<HTMLDivElement>['className'];
}

const Thread = ({ className }: ThreadProps) => {
  const messages = useAtomValue(messagesAtom);
  const thread = useAtomValue(threadAtom);
  const isChatResponseLoading = useAtomValue(threadLoadingAtom);
  const chatError = useAtomValue(threadChatErrorsAtom)[thread?.id || ''];
  const queuedJob = useAtomValue(threadQueuedJobAtom);
  const { canRetry, retryableMessageId, retryMessage } = useSubmitMessage();
  const { user } = useUser();
  const showHints = Boolean(
    user?.id || getVaultSnapshot(user?.id ?? getAnonymousWorkspaceAccount()).providers.length > 0
  );
  const hasMessages = messages.length > 0;
  const shouldStickToBottom = useRef(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollAtRef = useRef(0);
  const pendingScrollRef = useRef(false);
  const initialScrollThreadIdRef = useRef<string | null>(null);
  const initialScrollReadyRef = useRef(false);
  const autoScrollInProgressRef = useRef(false);
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useReducedMotion();
  const { isMobile, openMobile } = useSidebar();

  const stopAutoScroll = useCallback(() => {
    autoScrollInProgressRef.current = false;
    pendingScrollRef.current = false;
    shouldStickToBottom.current = false;
    if (scrollTimerRef.current !== null) {
      clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }
    if (autoScrollTimeoutRef.current !== null) {
      clearTimeout(autoScrollTimeoutRef.current);
      autoScrollTimeoutRef.current = null;
    }
  }, []);

  const scheduleScrollToBottom = useCallback(
    (behavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth') => {
      if (!shouldStickToBottom.current || !bottomSentinelRef.current) return;

      const elapsed = Date.now() - lastScrollAtRef.current;
      const delay = Math.max(0, 110 - elapsed);
      pendingScrollRef.current = true;

      if (scrollTimerRef.current !== null) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        scrollTimerRef.current = null;
        pendingScrollRef.current = false;
        if (!shouldStickToBottom.current || !bottomSentinelRef.current) return;

        autoScrollInProgressRef.current = true;
        bottomSentinelRef.current.scrollIntoView({
          behavior,
          block: 'end',
        });
        lastScrollAtRef.current = Date.now();
        if (autoScrollTimeoutRef.current !== null) clearTimeout(autoScrollTimeoutRef.current);
        autoScrollTimeoutRef.current = setTimeout(
          () => {
            autoScrollInProgressRef.current = false;
            autoScrollTimeoutRef.current = null;
          },
          reducedMotion ? 100 : 650
        );
      }, delay);
    },
    [reducedMotion]
  );

  useEffect(() => {
    const viewport = rootRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    const sentinel = bottomSentinelRef.current;
    const content = contentRef.current;
    if (!viewport || !sentinel || !content) return;

    const handleViewportInteraction = () => {
      stopAutoScroll();
    };

    const handleViewportScroll = () => {
      if (autoScrollInProgressRef.current) return;

      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      if (distanceFromBottom <= 24) {
        shouldStickToBottom.current = true;
        return;
      }

      shouldStickToBottom.current = false;
      pendingScrollRef.current = false;
      if (scrollTimerRef.current !== null) {
        clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
    };

    viewport.addEventListener('pointerdown', handleViewportInteraction);
    viewport.addEventListener('touchstart', handleViewportInteraction, { passive: true });
    viewport.addEventListener('wheel', handleViewportInteraction, { passive: true });
    viewport.addEventListener('scroll', handleViewportScroll, { passive: true });

    const viewportBounds = viewport.getBoundingClientRect();
    const sentinelBounds = sentinel.getBoundingClientRect();
    shouldStickToBottom.current =
      sentinelBounds.top < viewportBounds.bottom + 24 && sentinelBounds.bottom > viewportBounds.top;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          shouldStickToBottom.current = true;
        } else if (!pendingScrollRef.current) {
          shouldStickToBottom.current = false;
          if (scrollTimerRef.current !== null) {
            clearTimeout(scrollTimerRef.current);
            scrollTimerRef.current = null;
          }
        }
      },
      { root: viewport, threshold: 0.8, rootMargin: '0px 0px 24px' }
    );
    observer.observe(sentinel);

    const resizeObserver = new ResizeObserver(() => {
      if (!initialScrollReadyRef.current) return;
      scheduleScrollToBottom('auto');
    });
    resizeObserver.observe(content);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      viewport.removeEventListener('pointerdown', handleViewportInteraction);
      viewport.removeEventListener('touchstart', handleViewportInteraction);
      viewport.removeEventListener('wheel', handleViewportInteraction);
      viewport.removeEventListener('scroll', handleViewportScroll);
    };
  }, [hasMessages, scheduleScrollToBottom, stopAutoScroll]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current !== null) clearTimeout(scrollTimerRef.current);
      if (autoScrollTimeoutRef.current !== null) clearTimeout(autoScrollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!thread || (isMobile && openMobile)) return;
    if (initialScrollThreadIdRef.current === thread.id) return;

    initialScrollReadyRef.current = false;

    const initialScrollTimer = setTimeout(() => {
      initialScrollThreadIdRef.current = thread.id;
      initialScrollReadyRef.current = true;
      shouldStickToBottom.current = true;
      bottomSentinelRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      lastScrollAtRef.current = Date.now();
    }, 0);

    return () => clearTimeout(initialScrollTimer);
  }, [thread, scheduleScrollToBottom, isMobile, openMobile]);

  useEffect(() => {
    if (thread && initialScrollThreadIdRef.current === thread.id) {
      scheduleScrollToBottom();
    }
  }, [messages, thread, scheduleScrollToBottom]);

  const userInfo = useCallback(
    (profile: string | null): UserInfo => ({
      user: {
        name: getName(user),
        avatarImageSrc: user?.imageUrl || '/user.svg',
        messageClassNames:
          'border-primary bg-primary text-primary-foreground shadow-[0_10px_28px_hsl(var(--primary)/0.18)]',
      },
      assistant: {
        name: profiles.find((item) => item.code === profile)?.text || 'Assistant',
        avatarImageSrc:
          thread?.metadata.isDemo || profile === null || profile === undefined
            ? '/icons/normal.png'
            : profile === 'custom'
              ? '/polychat-mark.png'
              : `/icons/${profile}.png`,
        messageClassNames: 'border-border/80 bg-card/80 text-card-foreground shadow-sm',
      },
    }),
    [thread, user]
  );
  const isImageModel =
    thread?.settings.modelType === 'image' ||
    supportedImageModels.some(({ name }) => name === thread?.settings.model);

  return (
    <ScrollArea
      ref={rootRef}
      className={clsx(
        'thread-scroll box-border min-w-0 px-3 sm:px-5 lg:px-8 [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:w-full [&_[data-radix-scroll-area-viewport]>div]:min-w-0',
        className
      )}>
      <div
        ref={contentRef}
        className="mx-auto min-h-full w-full min-w-0 max-w-5xl overflow-x-clip pb-5">
        {hasMessages ? (
          <>
            {messages.map((chat) => {
              const { role, metadata } = chat;
              // The error banner offers Retry while the failure is live; after a reload or
              // thread switch only the failed message itself can. Other messages get no retry
              // props, so their memo is not invalidated.
              const isRetryTarget = !chatError && chat.id === retryableMessageId;
              return (
                <Message
                  key={chat.id}
                  {...userInfo(metadata.profile)[role]}
                  {...chat}
                  {...(isRetryTarget ? { onRetry: retryMessage, canRetry } : {})}
                />
              );
            })}
            {(isChatResponseLoading || (isImageModel && Boolean(chatError))) &&
              (isImageModel ? (
                <ImageGenerating
                  error={isChatResponseLoading ? undefined : chatError}
                  onRetry={retryableMessageId ? retryMessage : undefined}
                  canRetry={canRetry}
                  size={
                    thread?.settings.modelConfig &&
                    'size' in thread.settings.modelConfig &&
                    typeof thread.settings.modelConfig.size === 'string'
                      ? thread.settings.modelConfig.size
                      : undefined
                  }
                />
              ) : (
                <Typing />
              ))}
            {chatError && !isImageModel && (
              <Alert variant="destructive" className="my-4">
                <AlertTitle>Generation failed</AlertTitle>
                <AlertDescription>
                  <p>{chatError}</p>
                  {retryableMessageId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-9 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={!canRetry}
                      onClick={() => void retryMessage()}>
                      <RotateCcwIcon />
                      Retry
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}
            {queuedJob && (
              <p className="px-2 py-3 text-center text-sm text-muted-foreground" role="status">
                Queued - waiting for the current response to finish.
              </p>
            )}
            <UsageStatus />
            <div ref={bottomSentinelRef} aria-hidden="true" className="h-1" />
          </>
        ) : (
          <Empty name={getName(user)} showHints={showHints} />
        )}
      </div>
    </ScrollArea>
  );
};

export default Thread;
