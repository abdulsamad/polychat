import { type HTMLAttributes, useCallback, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { useUser } from '@clerk/react-router';

import { threadLoadingAtom, messagesAtom, configAtom } from '@/store';
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

const Chats = () => {
  const chats = useAtomValue(messagesAtom);
  const isChatResponseLoading = useAtomValue(threadLoadingAtom);
  const { textInput } = useAtomValue(configAtom);

  const { user } = useUser();

  useEffect(() => {
    const thread = document.querySelectorAll('.chat');

    if (!thread.length) return;

    setTimeout(() => {
      thread[thread.length - 1].scrollIntoView({
        behavior: 'instant',
        block: 'end',
      });
    }, 200);
  }, [chats]);

  const userInfo = useCallback(
    (variation: string | null): UserInfo => ({
      user: {
        name: getName(user),
        avatarImageSrc: user?.imageUrl!,
        messageClassNames:
          'bg-primary text-secondary before:right-0 before:translate-x-[70%] before:border-l-primary',
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

  const hasMessages = chats.length;

  return (
    <section className="max-w-full">
      <ScrollArea className="h-[calc(100svh-142px)] px-6 lg:px-8 box-border">
        {hasMessages ? (
          <>
            {chats.map((chat, index) => {
              const { role, metadata } = chat;
              return <Message key={index} {...userInfo(metadata.variation)[role]} {...chat} />;
            })}
            {isChatResponseLoading && <Typing />}
          </>
        ) : (
          <Empty name={getName(user)} textInput={textInput} />
        )}
      </ScrollArea>
    </section>
  );
};

export default Chats;
