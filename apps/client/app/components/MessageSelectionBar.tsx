import { useMemo, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  ChevronDownIcon,
  Code2Icon,
  CopyIcon,
  ImageIcon,
  QuoteIcon,
  ShareIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  clearSelectedMessagesAtom,
  type IMessage,
  messagesAtom,
  removeThreadMessagesByIdAtom,
  selectedMessageIdsAtom,
  threadAtom,
} from '@/store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

type CopyableItem =
  | { type: 'text'; label: string; value: string }
  | { type: 'image'; label: string; value: string };

const stripQuoteMarkdown = (value: string) =>
  value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`]/g, '')
    .trim();

const getCopyableItems = (message: IMessage | undefined) => {
  if (!message) return [];

  const items: CopyableItem[] = [];
  const codeBlocks = [...message.content.matchAll(/```[^\n]*\n([\s\S]*?)```/g)]
    .map((match) => match[1].trimEnd())
    .filter(Boolean);

  codeBlocks.forEach((code, index) => {
    items.push({
      type: 'text',
      label: codeBlocks.length === 1 ? 'Copy code' : `Copy code ${index + 1}`,
      value: code,
    });
  });

  const quoteLines: string[] = [];
  const quotes: string[] = [];
  const addQuote = () => {
    const quote = stripQuoteMarkdown(quoteLines.join('\n'));
    if (quote) quotes.push(quote);
    quoteLines.length = 0;
  };

  let insideCodeBlock = false;
  message.content.split('\n').forEach((line) => {
    if (/^\s*```/.test(line)) {
      addQuote();
      insideCodeBlock = !insideCodeBlock;
      return;
    }
    if (insideCodeBlock) return;
    if (/^\s*>/.test(line)) {
      quoteLines.push(line.replace(/^\s*>\s?/, ''));
      return;
    }
    addQuote();
  });
  addQuote();
  quotes.forEach((quote, index) => {
    items.push({
      type: 'text',
      label: quotes.length === 1 ? 'Copy quote' : `Copy quote ${index + 1}`,
      value: quote,
    });
  });

  const imageSource =
    message.type === 'image_url' ? message.image_url.url : message.imageAttachments?.[0]?.dataUrl;
  if (imageSource) items.push({ type: 'image', label: 'Copy image', value: imageSource });

  return items;
};

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
  const copyableItems = useMemo(
    () => (selectedIds.length === 1 ? getCopyableItems(selectedMessages[0]) : []),
    [selectedIds.length, selectedMessages]
  );

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

  const copyItem = async (item: CopyableItem) => {
    try {
      if (item.type === 'text') {
        await navigator.clipboard.writeText(item.value);
      } else {
        if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
          throw new Error('Image clipboard is not supported');
        }

        const response = await fetch(item.value);
        if (!response.ok) throw new Error(`Image request failed: ${response.status}`);

        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) throw new Error('Image data is invalid');

        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      }
      toast.success(`${item.label.replace(/^Copy /, '')} copied`);
    } catch (error) {
      console.error(`Failed to copy ${item.label.toLowerCase()}:`, error);
      toast.error(`${item.label} could not be copied`);
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
          <div className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={
                copyableItems.length
                  ? 'size-10 rounded-l-full rounded-r-none'
                  : 'size-10 rounded-full'
              }
              aria-label="Copy selected messages"
              title="Copy"
              disabled={!selectedText}
              onClick={() => void copySelected()}>
              <CopyIcon />
            </Button>
            {copyableItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 rounded-l-none rounded-r-full border-l border-border/60 px-2"
                    aria-label="More copy options"
                    title="More copy options">
                    <ChevronDownIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                  {copyableItems.map((item, index) => (
                    <DropdownMenuItem
                      key={`${item.type}-${index}`}
                      onSelect={() => void copyItem(item)}>
                      {item.type === 'image' ? (
                        <ImageIcon />
                      ) : item.label.startsWith('Copy quote') ? (
                        <QuoteIcon />
                      ) : (
                        <Code2Icon />
                      )}
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
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
