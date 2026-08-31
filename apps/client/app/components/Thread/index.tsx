import { useCallback, useEffect, useRef, type HTMLAttributes } from 'react';
import { useAtomValue } from 'jotai';
import { useUser } from '@clerk/react-router';
import { useReducedMotion } from 'motion/react';
import clsx from 'clsx';

import { threadLoadingAtom, messagesAtom } from '@/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import Message from '@/components/Message';
import { getName } from '@/utils';

import Empty from './Empty';
import Typing from './Typing';

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
  const { user } = useUser();
  const shouldReduceMotion = useReducedMotion();
  const shouldStickToBottom = useRef(true);
  const hasInitialScroll = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const viewport = rootRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );

    if (!viewport) return;
    viewportRef.current = viewport;

    const updateScrollIntent = () => {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      shouldStickToBottom.current = distanceFromBottom <= 96;
    };

    viewport.addEventListener('scroll', updateScrollIntent, { passive: true });
    updateScrollIntent();

    return () => {
      viewport.removeEventListener('scroll', updateScrollIntent);
      viewportRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) return;

    const animationFrame = requestAnimationFrame(() => {
      if (!hasInitialScroll.current || shouldStickToBottom.current) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: shouldReduceMotion || !hasInitialScroll.current ? 'auto' : 'smooth',
        });
        hasInitialScroll.current = true;
      }
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [messages, shouldReduceMotion]);

  const userInfo = useCallback(
    (variation: string | null): UserInfo => ({
      user: {
        name: getName(user),
        avatarImageSrc: user?.imageUrl!,
        messageClassNames:
          'border-primary bg-primary text-primary-foreground shadow-[0_10px_28px_hsl(var(--primary)/0.18)]',
      },
      assistant: {
        name: variation?.split('-').join(' '),
        avatarImageSrc: `/icons/${variation}.png`,
        messageClassNames: 'border-border/80 bg-card/80 text-card-foreground shadow-sm',
      },
    }),
    [user]
  );
  const hasMessages = messages.length > 0;

  return (
    <ScrollArea
      ref={rootRef}
      className={clsx('thread-scroll box-border min-w-0 px-3 sm:px-5 lg:px-8', className)}>
      <div className="mx-auto min-h-full w-full min-w-0 max-w-5xl overflow-x-clip pb-5">
        {hasMessages ? (
          <>
            {messages.map((chat) => {
              const { role, metadata } = chat;
              return <Message key={chat.id} {...userInfo(metadata.variation)[role]} {...chat} />;
            })}
            {isChatResponseLoading && <Typing />}
          </>
        ) : (
          <Empty name={getName(user)} />
        )}
      </div>
    </ScrollArea>
  );
};

export default Thread;
