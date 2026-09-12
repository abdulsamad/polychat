import { useMemo, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { CopyIcon, ShareIcon, Trash2Icon, XIcon } from 'lucide-react';
import { toast } from 'sonner';

import {
  clearSelectedMessagesAtom,
  messagesAtom,
  removeThreadMessagesByIdAtom,
  selectedMessageIdsAtom,
  threadAtom,
} from '@/store';
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
} from '@/components/ui/alert-dialog';

const MessageSelectionBar = () => {
  const selectedIds = useAtomValue(selectedMessageIdsAtom);
  const messages = useAtomValue(messagesAtom);
  const thread = useAtomValue(threadAtom);
  const clearSelection = useSetAtom(clearSelectedMessagesAtom);
  const removeMessages = useSetAtom(removeThreadMessagesByIdAtom);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const selectedMessages = useMemo(
    () => messages.filter((message) => selectedIds.includes(message.id)),
    [messages, selectedIds]
  );
  const selectedText = selectedMessages
    .map((message) =>
      message.type === 'image_url'
        ? message.image_url.alt || message.image_url.url
        : message.content
    )
    .filter(Boolean)
    .join('\n\n');

  if (!selectedIds.length) return null;

  const copySelected = async () => {
    try {
      await navigator.clipboard.writeText(selectedText);
      toast.success('Messages copied');
    } catch (error) {
      console.error('Failed to copy messages:', error);
      toast.error('Messages could not be copied');
    }
  };

  const shareSelected = async () => {
    if (!selectedText) return;
    try {
      if (navigator.share) await navigator.share({ text: selectedText });
      else {
        await navigator.clipboard.writeText(selectedText);
        toast.success('Messages copied');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Failed to share messages:', error);
      toast.error('Messages could not be shared');
    }
  };

  const deleteSelected = () => {
    if (!thread) return;
    removeMessages({ threadId: thread.id, ids: selectedIds });
    setIsDeleteDialogOpen(false);
    toast.success(
      `${selectedIds.length} ${selectedIds.length === 1 ? 'message' : 'messages'} deleted`
    );
  };

  return (
    <>
      <div className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-border/80 bg-card px-2 py-1.5 shadow-[0_8px_28px_hsl(var(--foreground)/0.1)] sm:min-h-16 sm:px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 rounded-full"
            aria-label="Cancel message selection"
            title="Cancel selection"
            onClick={clearSelection}>
            <XIcon />
          </Button>
          <span className="truncate text-sm font-medium">
            {selectedIds.length} {selectedIds.length === 1 ? 'message' : 'messages'} selected
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-full"
            aria-label="Copy selected messages"
            title="Copy"
            disabled={!selectedText}
            onClick={() => void copySelected()}>
            <CopyIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-full"
            aria-label="Share selected messages"
            title="Share"
            disabled={!selectedText}
            onClick={() => void shareSelected()}>
            <ShareIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete selected messages"
            title="Delete"
            onClick={() => setIsDeleteDialogOpen(true)}>
            <Trash2Icon />
          </Button>
        </div>
      </div>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected messages?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedIds.length} selected{' '}
              {selectedIds.length === 1 ? 'message' : 'messages'} from this chat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteSelected}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MessageSelectionBar;
