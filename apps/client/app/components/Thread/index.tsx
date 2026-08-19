import { useCallback, useEffect, useRef, type HTMLAttributes } from 'react';
import { useAtomValue } from 'jotai';
import { useUser } from '@clerk/react-router';
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
  const shouldStickToBottom = useRef(true);
  const hasInitialScroll = useRef(false);

  useEffect(() => {
    const viewport = document.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');

    if (!viewport) return;

    const updateScrollIntent = () => {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      shouldStickToBottom.current = distanceFromBottom <= 96;
    };

    viewport.addEventListener('scroll', updateScrollIntent, { passive: true });
    updateScrollIntent();

    return () => viewport.removeEventListener('scroll', updateScrollIntent);
  }, []);

  useEffect(() => {
    const viewport = document.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');

    if (!viewport) return;

    const animationFrame = requestAnimationFrame(() => {
      if (!hasInitialScroll.current || shouldStickToBottom.current) {
        viewport.scrollTop = viewport.scrollHeight;
        hasInitialScroll.current = true;
      }
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [messages]);

  const userInfo = useCallback(
    (variation: string | null): UserInfo => ({
      user: {
        name: getName(user),
        avatarImageSrc: user?.imageUrl!,
        messageClassNames:
          'bg-primary text-primary-foreground before:right-0 before:translate-x-[70%] before:border-l-primary',
      },
      assistant: {
        name: variation?.split('-').join(' '),
        avatarImageSrc: `/icons/${variation}.png`,
        messageClassNames:
          'bg-secondary before:left-0 before:-translate-x-[70%] before:rotate-180 before:border-l-secondary',
      },
    }),
    [user]
  );
  ``;
  const hasMessages = messages.length;

  return (
    <ScrollArea className={clsx('px-6 lg:px-8 box-border', className)}>
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
    </ScrollArea>
  );
};

export default Thread;
