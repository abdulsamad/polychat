import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  type HTMLAttributes,
  type MouseEvent,
} from 'react';
import { NavLink, useParams } from 'react-router';
import { useAtom, useSetAtom } from 'jotai';
import { TrashIcon } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

import type { Route } from '@/react-router/types/root';
import { getDefaultThread, IThreads, messagesAtom, threadAtom } from '@/store';
import { getMessages, getThreads, lforage, messagesKey, threadsKey } from '@/utils/lforage';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

import DeleteAlert from './DeleteAlert';

const ThreadsList = () => {
  const [thread, setThread] = useAtom(threadAtom);
  const setMessages = useSetAtom(messagesAtom);
  const [threads, setThreads] = useState<IThreads>([]);
  const [isPending, startTransition] = useTransition();
  const params = useParams<Route.ClientLoaderArgs['params']>();

  const { open, setOpenMobile } = useSidebar();

  const fetchThreads = useCallback(() => {
    startTransition(async () => {
      const newThreads = await getThreads();

      if (!newThreads) return;

      setThreads(newThreads);
    });
  }, []);

  useEffect(() => {
    fetchThreads();
  }, [thread]);

  useEffect(() => {
    // Refetch threads when sidebar opens
    if (open) {
      fetchThreads();
    }
  }, [open, fetchThreads]);

  const deleteChats = useCallback(
    async (ev: MouseEvent<HTMLButtonElement>, threadId: string) => {
      ev.stopPropagation();

      if (params.threadId === threadId) {
        // Reset the thread
        const blankThread = getDefaultThread();
        setThread(blankThread);
        setMessages([] as any, true as any);
      }

      const messages = await getMessages();

      const { [threadId]: removedThread, ...remainingMessages } = messages;

      await lforage.setItem(messagesKey, remainingMessages);
      const threads = await getThreads();

      await lforage.setItem(
        threadsKey,
        threads.filter(({ id }) => id !== threadId)
      );

      fetchThreads();
    },
    [setThread, fetchThreads]
  );

  if (!isPending && !threads.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-center py-2 text-muted-foreground">No threads</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100svh-210px)] overflow-hidden">
      <SidebarGroup>
        <SidebarGroupLabel>Threads</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {isPending
              ? Array.from({ length: 5 }).map((_, i) => (
                  <SidebarMenuItem key={i} className="flex w-full px-4">
                    <div className="w-full animate-pulse flex items-center gap-3 p-2 rounded-lg bg-muted">
                      <div className="flex-1">
                        <div className="h-3 w-full   rounded-md bg-muted-foreground/10 dark:bg-muted-foreground/20"></div>
                      </div>
                    </div>
                  </SidebarMenuItem>
                ))
              : threads.map(({ id, metadata: { name, timestamp } }) => {
                  type ButtonClassNames = HTMLAttributes<HTMLButtonElement>['className'];

                  const isSelected = id === params.threadId;
                  const rootClasses: ButtonClassNames = isSelected
                    ? `relative before:content-[''] before:absolute before:-left-0 before:top-1/2 before:-translate-y-1/2 before:w-24 before:h-24 before:rounded-[10px] before:bg-purple-500 before:rotate-45 before:-translate-x-[105px]`
                    : '';

                  return (
                    <SidebarMenuItem
                      key={id}
                      className={clsx(
                        'flex w-full px-4 rounded-none cursor-default hover:bg-transparent group/sidebar-item',
                        rootClasses
                      )}
                      onClick={() => setOpenMobile(false)}>
                      <SidebarMenuButton>
                        <NavLink
                          to={`/${id}`}
                          onClick={(ev) => {
                            if (isSelected) {
                              ev.preventDefault();
                            }
                          }}
                          preventScrollReset
                          className={({ isActive, isPending, isTransitioning }) =>
                            [
                              'flex items-center justify-between gap-2 w-full p-2 rounded-[8px]',
                              isPending ? 'bg-purple-300' : '',
                              isActive ? 'bg-[rgba(255, 255, 255, 0.85)]' : '',
                              isTransitioning ? 'transitioning' : '',
                            ].join(' ')
                          }
                          viewTransition>
                          <p className="truncate w-fit text-foreground text-left inline-flex items-center justify-center gap-2">
                            {name || format(new Date(timestamp), 'hh:mm A - DD/MM/YY')}
                          </p>
                        </NavLink>
                      </SidebarMenuButton>
                      <DeleteAlert onDelete={(ev) => deleteChats(ev, id)}>
                        <Button
                          className="h-7 w-6 invisible group-hover/sidebar-item:visible transition-all duration-200 ease-elastic-out translate-x-2 opacity-0 group-hover/sidebar-item:translate-x-0 group-hover/sidebar-item:opacity-100"
                          variant="destructive"
                          size="icon"
                          onClick={(ev) => ev.stopPropagation()}>
                          <TrashIcon className="h-3.5 w-3.5" />
                        </Button>
                      </DeleteAlert>
                    </SidebarMenuItem>
                  );
                })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </ScrollArea>
  );
};

export default ThreadsList;
