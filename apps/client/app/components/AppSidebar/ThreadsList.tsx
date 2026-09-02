import { useState, useEffect, useCallback, useTransition } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { CheckIcon, PencilIcon, TrashIcon, XIcon } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import type { Route } from '@/react-router/types/root';
import {
  IThreads,
  enqueuePersistence,
  replaceMessagesAtom,
  threadAtom,
  threadLoadingAtom,
  threadsRefreshAtom,
} from '@/store';
import {
  getMessages,
  getThreads,
  setMessages,
  setThreads as setStoredThreads,
} from '@/utils/lforage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
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
  const replaceMessages = useSetAtom(replaceMessagesAtom);
  const [threads, setThreads] = useState<IThreads>([]);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);
  const [threadToRename, setThreadToRename] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isPending, startTransition] = useTransition();
  const params = useParams<Route.ClientLoaderArgs['params']>();
  const threadsRefresh = useAtomValue(threadsRefreshAtom);
  const isChatLoading = useAtomValue(threadLoadingAtom);
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
  }, [thread, threadsRefresh]);

  useEffect(() => {
    // Refetch threads when sidebar opens
    if (open) {
      fetchThreads();
    }
  }, [open, fetchThreads]);

  const deleteChats = useCallback(
    async (threadId: string) => {
      const { remainingMessages, nextThreads } = await enqueuePersistence(async () => {
        const [messages, storedThreads] = await Promise.all([getMessages(), getThreads()]);
        const remainingMessages = { ...(messages || {}) };
        delete remainingMessages[threadId];
        const nextThreads = (storedThreads || []).filter(({ id }) => id !== threadId);

        await Promise.all([setMessages(remainingMessages), setStoredThreads(nextThreads)]);

        return { remainingMessages, nextThreads };
      });

      if (params.threadId === threadId) {
        const nextThread = nextThreads[0];

        if (nextThread) {
          setThread(nextThread);
          replaceMessages(remainingMessages[nextThread.id] || []);
          navigate(`/${nextThread.id}`, { replace: true });
        } else {
          setThread(null);
          replaceMessages([]);
          navigate('/', { replace: true });
        }

        setOpenMobile(false);
      }

      fetchThreads();
    },
    [fetchThreads, navigate, params.threadId, replaceMessages, setOpenMobile, setThread]
  );

  const renameThread = useCallback(async () => {
    if (!threadToRename) return;
    const threadId = threadToRename;
    const name = renameValue.trim();
    if (!name || name.length > 80) return;

    await enqueuePersistence(async () => {
      const storedThreads = (await getThreads()) || [];
      const nextThreads = storedThreads.map((item) =>
        item.id === threadId
          ? { ...item, metadata: { ...item.metadata, name, nameSource: 'custom' as const } }
          : item
      );
      await setStoredThreads(nextThreads);
    });

    if (thread?.id === threadId) {
      setThread({
        ...thread,
        metadata: { ...thread.metadata, name, nameSource: 'custom' },
      });
    }
    setThreadToRename(null);
    fetchThreads();
  }, [fetchThreads, renameValue, setThread, thread, threadToRename]);

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
                  const isSelected = id === params.threadId;

                  return (
                    <ContextMenu key={id}>
                      <ContextMenuTrigger asChild>
                        <SidebarMenuItem className="group/sidebar-item flex w-full cursor-default rounded-none px-4 hover:bg-transparent">
                          {threadToRename === id ? (
                            <div className="flex min-w-0 flex-1 items-center gap-1">
                              <Input
                                autoFocus
                                value={renameValue}
                                maxLength={80}
                                aria-label="Thread name"
                                onChange={(event) => setRenameValue(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void renameThread();
                                  }
                                  if (event.key === 'Escape') {
                                    event.preventDefault();
                                    setThreadToRename(null);
                                  }
                                }}
                                className="h-8 min-w-0 bg-background px-2"
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                aria-label="Save thread name"
                                onClick={() => void renameThread()}>
                                <CheckIcon className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                aria-label="Cancel rename"
                                onClick={() => setThreadToRename(null)}>
                                <XIcon className="size-4" />
                              </Button>
                            </div>
                          ) : (
                            <SidebarMenuButton asChild>
                              <NavLink
                                to={`/${id}`}
                                onClick={(ev) => {
                                  if (isSelected) {
                                    ev.preventDefault();
                                    return;
                                  }

                                  if (isChatLoading) {
                                    ev.preventDefault();
                                    toast.info('Stop generating before switching chats.');
                                    return;
                                  }

                                  setOpenMobile(false);
                                }}
                                preventScrollReset
                                className={({ isActive, isPending, isTransitioning }) =>
                                  [
                                    'relative flex min-w-0 flex-1 items-center justify-between gap-2 rounded-[8px] p-2',
                                    isPending ? 'bg-primary/20' : '',
                                    isActive
                                      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_hsl(var(--sidebar-primary)/0.3)]'
                                      : '',
                                    isTransitioning ? 'transitioning' : '',
                                  ].join(' ')
                                }
                                viewTransition>
                                {isSelected && (
                                  <span
                                    aria-hidden="true"
                                    className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-sidebar-primary"
                                  />
                                )}
                                <p
                                  className="min-w-0 flex-1 truncate text-left"
                                  title={name || format(new Date(timestamp), 'hh:mm A - DD/MM/YY')}>
                                  {name || format(new Date(timestamp), 'hh:mm A - DD/MM/YY')}
                                </p>
                              </NavLink>
                            </SidebarMenuButton>
                          )}
                          {threadToRename !== id && (
                            <div className="flex shrink-0 items-center gap-0.5">
                              <Button
                                aria-label={`Rename ${name || 'thread'}`}
                                className="invisible size-7 translate-x-2 text-muted-foreground opacity-0 sm:transition-all sm:duration-200 sm:group-hover/sidebar-item:visible sm:group-hover/sidebar-item:translate-x-0 sm:group-hover/sidebar-item:opacity-100 sm:group-focus-within/sidebar-item:visible sm:group-focus-within/sidebar-item:translate-x-0 sm:group-focus-within/sidebar-item:opacity-100"
                                variant="ghost"
                                size="icon"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setRenameValue(name || '');
                                  setThreadToRename(id);
                                }}>
                                <PencilIcon className="size-3.5" />
                              </Button>
                              <DeleteAlert
                                onDelete={() => {
                                  if (isChatLoading) {
                                    toast.info('Stop generating before switching chats.');
                                    return;
                                  }

                                  void deleteChats(id);
                                }}>
                                <Button
                                  aria-label={`Delete ${name || 'thread'}`}
                                  className="invisible size-7 translate-x-2 opacity-0 sm:transition-all sm:duration-200 sm:group-hover/sidebar-item:visible sm:group-hover/sidebar-item:translate-x-0 sm:group-hover/sidebar-item:opacity-100 sm:group-focus-within/sidebar-item:visible sm:group-focus-within/sidebar-item:translate-x-0 sm:group-focus-within/sidebar-item:opacity-100"
                                  variant="destructive"
                                  size="icon"
                                  onClick={(ev) => ev.stopPropagation()}>
                                  <TrashIcon className="size-3.5" />
                                </Button>
                              </DeleteAlert>
                            </div>
                          )}
                        </SidebarMenuItem>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem
                          onSelect={() => {
                            setRenameValue(name || '');
                            setThreadToRename(id);
                          }}>
                          <PencilIcon />
                          Rename
                        </ContextMenuItem>
                        <ContextMenuItem
                          variant="destructive"
                          onSelect={() => {
                            if (isChatLoading) {
                              toast.info('Stop generating before switching chats.');
                              return;
                            }

                            setThreadToDelete(id);
                          }}>
                          <TrashIcon />
                          Delete
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
          </SidebarMenu>
          <DeleteAlert
            open={threadToDelete !== null}
            onOpenChange={(open) => {
              if (!open) setThreadToDelete(null);
            }}
            onDelete={() => {
              if (threadToDelete && !isChatLoading) void deleteChats(threadToDelete);
              setThreadToDelete(null);
            }}
          />
        </SidebarGroupContent>
      </SidebarGroup>
    </ScrollArea>
  );
};

export default ThreadsList;
