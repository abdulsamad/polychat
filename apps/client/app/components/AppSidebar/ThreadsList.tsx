import { useState, useEffect, useCallback, useTransition, type HTMLAttributes } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { CheckIcon, PencilIcon, TrashIcon, XIcon } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

import type { Route } from '@/react-router/types/root';
import {
  getDefaultThread,
  IThreads,
  replaceMessagesAtom,
  threadAtom,
  threadsRefreshAtom,
} from '@/store';
import {
  getMessages,
  getThreads,
  getUserSettings,
  lforage,
  messagesKey,
  threadsKey,
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
      const messages = (await getMessages()) || {};
      const { [threadId]: removedThread, ...remainingMessages } = messages;
      await lforage.setItem(messagesKey, remainingMessages);
      const storedThreads = (await getThreads()) || [];
      const nextThreads = storedThreads.filter(({ id }) => id !== threadId);

      await lforage.setItem(threadsKey, nextThreads);

      if (params.threadId === threadId) {
        const nextThread = nextThreads[0];

        if (nextThread) {
          setThread(nextThread);
          replaceMessages(remainingMessages[nextThread.id] || []);
          navigate(`/${nextThread.id}`, { replace: true });
        } else {
          const blankThread = getDefaultThread((await getUserSettings()) || undefined);
          setThread(blankThread);
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
    const name = renameValue.trim();
    if (!name || name.length > 80) return;

    const storedThreads = (await getThreads()) || [];
    const nextThreads = storedThreads.map((item) =>
      item.id === threadToRename
        ? { ...item, metadata: { ...item.metadata, name, nameSource: 'custom' as const } }
        : item
    );
    await lforage.setItem(threadsKey, nextThreads);
    if (thread?.id === threadToRename) {
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
                  type ButtonClassNames = HTMLAttributes<HTMLButtonElement>['className'];

                  const isSelected = id === params.threadId;
                  const rootClasses: ButtonClassNames = isSelected
                    ? `relative before:content-[''] before:absolute before:-left-0 before:top-1/2 before:-translate-y-1/2 before:w-24 before:h-24 before:rounded-[10px] before:bg-primary before:rotate-45 before:-translate-x-[105px]`
                    : '';

                  return (
                    <ContextMenu key={id}>
                      <ContextMenuTrigger asChild>
                        <SidebarMenuItem
                          className={clsx(
                            'flex w-full px-4 rounded-none cursor-default hover:bg-transparent group/sidebar-item',
                            rootClasses
                          )}
                          onClick={() => setOpenMobile(false)}>
                          {threadToRename === id ? (
                            <div className="flex min-w-0 flex-1 items-center gap-1">
                              <Input
                                autoFocus
                                value={renameValue}
                                maxLength={80}
                                aria-label="Thread name"
                                onChange={(event) => setRenameValue(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') void renameThread();
                                  if (event.key === 'Escape') setThreadToRename(null);
                                }}
                                onBlur={() => void renameThread()}
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
                                  if (isSelected) ev.preventDefault();
                                }}
                                preventScrollReset
                                className={({ isActive, isPending, isTransitioning }) =>
                                  [
                                    'flex items-center justify-between gap-2 w-full p-2 rounded-[8px]',
                                    isPending ? 'bg-primary/20' : '',
                                    isActive
                                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                      : '',
                                    isTransitioning ? 'transitioning' : '',
                                  ].join(' ')
                                }
                                viewTransition>
                                <p className="truncate w-fit text-foreground text-left inline-flex items-center justify-center gap-2">
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
                              <DeleteAlert onDelete={() => deleteChats(id)}>
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
                          onSelect={() => setThreadToDelete(id)}>
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
              if (threadToDelete) void deleteChats(threadToDelete);
              setThreadToDelete(null);
            }}
          />
        </SidebarGroupContent>
      </SidebarGroup>
    </ScrollArea>
  );
};

export default ThreadsList;
