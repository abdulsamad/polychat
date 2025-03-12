import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  type HTMLAttributes,
  type MouseEvent,
} from 'react';
import { useNavigate } from 'react-router';
import { useAtom, useSetAtom } from 'jotai';
import { TrashIcon } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

import { currentThreadIdAtom, IThreads, threadAtom } from '@/store';
import { getThreads, lforage, threadsKey } from '@/utils/lforage';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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

const ThreadsList = () => {
  const [currentThreadId, setCurrentThreadId] = useAtom(currentThreadIdAtom);
  const setThread = useSetAtom(threadAtom);
  const [threads, setThreads] = useState<IThreads>([]);
  const [isPending, startTransition] = useTransition();

  const navigate = useNavigate();
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

  const updateCurrentChatId = useCallback(
    (threadId: ReturnType<typeof crypto.randomUUID>) => {
      setCurrentThreadId(threadId);
      navigate(`/${threadId}`);
    },
    [setCurrentThreadId]
  );

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

  if (!isPending && !threads.length) return <p className="text-center py-2">No threads</p>;

  return (
    <div className="space-y-2 overflow-hidden">
      <ScrollArea className="h-[calc(100svh-210px)]">
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
                    const backgroundClasses: ButtonClassNames = isSelected
                      ? 'bg-[rgba(255, 255, 255, 0.15)]'
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
                          updateCurrentChatId(id);
                        }}>
                        <SidebarMenuButton asChild>
                          <a
                            className={clsx(
                              'flex items-center justify-between gap-2 w-full p-2 rounded-[8px]',
                              backgroundClasses
                            )}>
                            <p className="truncate w-fit text-foreground text-left">
                              {name || format(new Date(timestamp), 'hh:mm A - DD/MM/YY')}
                            </p>
                          </a>
                        </SidebarMenuButton>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              className="h-7 w-6"
                              variant="destructive"
                              size="icon"
                              onClick={(ev) => ev.stopPropagation()}>
                              <TrashIcon className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete your
                                thread.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={(ev) => ev.stopPropagation()}>
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction asChild>
                                <Button
                                  variant="destructive"
                                  className="bg-red-500 hover:bg-red-400 transition-transform ease-in-out duration-300 text-white hover:scale-95 active:scale-90"
                                  onClick={(ev) => deleteChats(ev, id)}>
                                  Delete
                                </Button>
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </SidebarMenuItem>
                    );
                  })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </ScrollArea>
    </div>
  );
};

export default ThreadsList;
