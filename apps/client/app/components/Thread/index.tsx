import { useCallback, useEffect, useRef, type HTMLAttributes } from 'react';
import { useAtomValue } from 'jotai';
import { useUser } from '@clerk/react-router';
import clsx from 'clsx';

import { threadLoadingAtom, messagesAtom, threadQueuedJobAtom } from '@/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import Message from '@/components/Message';
import { getName } from '@/utils';
import { profiles } from 'utils';

import Empty from './Empty';
import Typing from './Typing';
import UsageStatus from './UsageStatus';

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
  const isChatResponseLoading = useAtomValue(threadLoadingAtom);
  const queuedJob = useAtomValue(threadQueuedJobAtom);
  const { user } = useUser();
  const shouldStickToBottom = useRef(true);
  const hasInitialScroll = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = rootRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    const bottomSentinel = bottomSentinelRef.current;

    if (!viewport || !bottomSentinel) return;
    viewportRef.current = viewport;

    const observer = new IntersectionObserver(
      ([entry]) => {
        shouldStickToBottom.current = entry.isIntersecting;
      },
      { root: viewport, rootMargin: '0px 0px 32px 0px' }
    );
    observer.observe(bottomSentinel);

    return () => {
      observer.disconnect();
      viewportRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) return;

    const animationFrame = requestAnimationFrame(() => {
      if (!hasInitialScroll.current || shouldStickToBottom.current) {
        // Streaming changes the height of the last message continuously. An
        // animation per update makes the scroll position lag and feel choppy.
        // Keep the viewport pinned without starting another animation, and
        // never take control back after the user scrolls away from the bottom.
        viewport.scrollTop = viewport.scrollHeight;
        hasInitialScroll.current = true;
      }
    });

    return () => cancelAnimationFrame(animationFrame);
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

  return (
    <ScrollArea
      ref={rootRef}
      className={clsx('thread-scroll box-border w-full min-w-0 max-w-full px-3 sm:px-5 lg:px-8', className)}>
      <div className="mx-auto min-h-full w-full min-w-0 max-w-5xl overflow-x-clip pb-5">
        {hasMessages ? (
          <>
            {messages.map((chat) => {
              const { role, metadata } = chat;
              return <Message key={chat.id} {...userInfo(metadata.profile)[role]} {...chat} />;
            })}
            {isChatResponseLoading && <Typing />}
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
