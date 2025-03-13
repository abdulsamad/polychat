import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  type HTMLAttributes,
  type MouseEvent,
} from 'react';
import { NavLink } from 'react-router';
import { useAtom, useSetAtom } from 'jotai';
import { TrashIcon } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

import { currentThreadIdAtom, IThreads, threadAtom } from '@/store';
import { getThreads, lforage, threadsKey } from '@/utils/lforage';
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
  const [currentThreadId, setCurrentThreadId] = useAtom(currentThreadIdAtom);
  const setThread = useSetAtom(threadAtom);
  const [threads, setThreads] = useState<IThreads>([]);
  const [isPending, startTransition] = useTransition();

  const { open, setOpenMobile } = useSidebar();

  const fetchThreads = useCallback(() => {
    startTransition(async () => {
      const newThreads = await getThreads();
      setThreads(newThreads || []);
    });
  }, []);

  useEffect(() => {
    fetchThreads();
  }, []);

  useEffect(() => {
    // Refetch threads when sidebar opens
    if (open) {
      fetchThreads();
    }
  }, [open, fetchThreads]);

  const deleteChats = useCallback(
    async (ev: MouseEvent<HTMLButtonElement>, threadId: string) => {
      ev.stopPropagation();

      if (currentThreadId === threadId) {
        setThread([] as any, true as any);
      }

      const storedThreads: IThreads | null = await lforage.getItem(threadsKey);
      const filteredThreads = storedThreads?.filter(({ id }) => id !== threadId);
      await lforage.setItem(threadsKey, filteredThreads);

      fetchThreads();
    },
    [currentThreadId, setThread, fetchThreads]
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
                    <div className="w-full animate-pulse flex items-center gap-2 p-2 rounded-[8px] bg-gray-800">
                      <div className="h-4 w-3/4 bg-gray-600 rounded-md"></div>
                      <div className="h-4 w-4 bg-gray-600 rounded-full"></div>
                    </div>
                  </SidebarMenuItem>
                ))
              : threads.map(({ id, timestamp, name }) => {
                  type ButtonClassNames = HTMLAttributes<HTMLButtonElement>['className'];
                  const isSelected = id === currentThreadId;
                  const rootClasses: ButtonClassNames = isSelected
                    ? `relative before:content-[''] before:absolute before:-left-0 before:top-1/2 before:-translate-y-1/2 before:w-24 before:h-24 before:rounded-[10px] before:bg-purple-500 before:rotate-45 before:-translate-x-[105px]`
                    : '';

                  return (
                    <SidebarMenuItem
                      key={id}
                      className={clsx(
                        'flex w-full px-4 rounded-none cursor-default hover:bg-transparent',
                        rootClasses
                      )}
                      onClick={() => {
                        setOpenMobile(false);
                        setCurrentThreadId(id);
                      }}>
                      <SidebarMenuButton>
                        <NavLink
                          to={`/${id}`}
                          className={({ isActive, isPending, isTransitioning }) =>
                            [
                              'flex items-center justify-between gap-2 w-full p-2 rounded-[8px]',
                              isPending ? 'bg-purple-300' : '',
                              isActive ? 'bg-[rgba(255, 255, 255, 0.85)]' : '',
                              isTransitioning ? 'transitioning' : '',
                            ].join(' ')
                          }
                          viewTransition>
                          <p className="truncate w-fit text-foreground text-left">
                            {name || format(new Date(timestamp), 'hh:mm A - DD/MM/YY')}
                          </p>
                        </NavLink>
                      </SidebarMenuButton>
                      <DeleteAlert onDelete={(ev) => deleteChats(ev, id)}>
                        <Button className="h-7 w-6" variant="destructive" size="icon">
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
