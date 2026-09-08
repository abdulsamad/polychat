import { useCallback, useEffect, useRef, type HTMLAttributes } from 'react';
import { useAtomValue } from 'jotai';
import { useUser } from '@clerk/react-router';
import clsx from 'clsx';

import {
  threadAtom,
  threadChatErrorsAtom,
  threadLoadingAtom,
  messagesAtom,
  threadQueuedJobAtom,
} from '@/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import Message from '@/components/Message';
import { getName } from '@/utils';
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
  const { user } = useUser();
  const shouldStickToBottom = useRef(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const viewport = rootRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    if (!viewport) return;
    viewportRef.current = viewport;

    const updateScrollState = () => {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      shouldStickToBottom.current = distanceFromBottom <= 32;
    };

    viewport.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();

    return () => {
      viewport.removeEventListener('scroll', updateScrollState);
      viewportRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport || !shouldStickToBottom.current) return;
    if (scrollFrameRef.current !== null) return;

    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;

      // Streaming changes the height of the last message continuously. An
      // animation-frame update keeps the viewport pinned without restarting a
      // smooth-scroll animation for every token.
      if (shouldStickToBottom.current) viewport.scrollTop = viewport.scrollHeight;
    });
  }, [messages]);

  const userInfo = useCallback(
    (profile: string | null): UserInfo => ({
      user: {
        name: getName(user),
        avatarImageSrc: user?.imageUrl!,
        messageClassNames:
          'border-primary bg-primary text-primary-foreground shadow-[0_10px_28px_hsl(var(--primary)/0.18)]',
      },
      assistant: {
        name: profiles.find((item) => item.code === profile)?.text || 'Assistant',
        avatarImageSrc: profile === 'custom' ? '/polychat-mark.png' : `/icons/${profile}.png`,
        messageClassNames: 'border-border/80 bg-card/80 text-card-foreground shadow-sm',
      },
    }),
    [user]
  );
  const hasMessages = messages.length > 0;
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
      <div className="mx-auto min-h-full w-full min-w-0 max-w-5xl overflow-x-clip pb-5">
        {hasMessages ? (
          <>
            {messages.map((chat) => {
              const { role, metadata } = chat;
              return <Message key={chat.id} {...userInfo(metadata.profile)[role]} {...chat} />;
            })}
            {(isChatResponseLoading || (isImageModel && Boolean(chatError))) &&
              (isImageModel ? (
                <ImageGenerating
                  error={isChatResponseLoading ? undefined : chatError}
                  size={
                    thread?.settings.modelConfig && 'size' in thread.settings.modelConfig
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
                <AlertDescription>{chatError} Please try again.</AlertDescription>
              </Alert>
            )}
            {queuedJob && (
              <p className="px-2 py-3 text-center text-sm text-muted-foreground" role="status">
                Queued - waiting for the current response to finish.
              </p>
            )}
            <UsageStatus />
            <div ref={bottomSentinelRef} aria-hidden="true" className="h-px" />
          </>
        ) : (
          <Empty name={getName(user)} />
        )}
      </div>
    </ScrollArea>
  );
};

export default Thread;
