import { memo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { CopyIcon, ShareIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

import { useAtomValue } from 'jotai';

import { IMessageCommons, ITextMessage, IImageMessage, threadAtom } from '@/store';
import { UserInfo } from '@/components/Thread';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import Image from './Image';
import Text from './Text';

interface ExtraProps extends IMessageCommons {
  message?: ITextMessage;
  image_url?: IImageMessage['image_url'];
}

type MessageProps = ExtraProps & UserInfo['user' | 'assistant'] & (ITextMessage | IImageMessage);

const MessageContent = ({
  name,
  messageClassNames,
  avatarImageSrc,
  type,
  content,
  image_url: image,
  role,
  metadata: { model, usage, finishReason, cancelled, requestState },
}: MessageProps) => {
  const shouldReduceMotion = useReducedMotion();
  const showDetailedUsage = useAtomValue(threadAtom)?.settings.showDetailedUsage ?? false;
  const isImage = type === 'image_url';
  const isUser = role === 'user';
  const chatOrigin = isUser ? 'origin-right' : 'origin-left';
  const shareText = isImage ? image?.alt || image?.url || '' : content || '';

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success('Message copied');
    } catch (error) {
      console.error('Failed to copy message:', error);
      toast.error('Message could not be copied');
    }
  };

  const shareMessage = async () => {
    if (!shareText) return;

    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to share message:', error);
        toast.error('Message could not be shared');
      }
      return;
    }

    await copyMessage();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.article
          initial={shouldReduceMotion ? false : { opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.18,
            ease: 'easeOut',
          }}
          className={clsx(
            'chat relative my-5 flex w-full min-w-0 scroll-mb-10 select-none data-[state=open]:z-20',
            chatOrigin
          )}
          data-type={type}>
          <div
            className={clsx(
              'w-full min-w-0',
              isUser ? 'ml-auto max-w-[min(92%,46rem)]' : 'w-full max-w-[52rem]'
            )}>
            <div
              className={clsx(
                'flex w-full min-w-0 items-start gap-2 sm:gap-3',
                isUser && 'flex-row-reverse'
              )}>
              {/* Name and User or Profile Image */}
              {!isImage && (
                <div className="flex w-9 shrink-0 flex-col items-center justify-center gap-1 sm:w-14">
                  <div className="size-8 overflow-hidden rounded-full border border-border bg-muted sm:size-10">
                    <img
                      className="size-full object-cover"
                      src={avatarImageSrc}
                      alt={name || (isUser ? 'You' : 'Assistant')}
                      height={40}
                      width={40}
                    />
                  </div>
                  <span className="hidden w-14 truncate text-center text-xs text-muted-foreground capitalize sm:block">
                    {name}
                  </span>
                </div>
              )}
              {/* Image or Message */}
              {isImage && image && image.size ? (
                <Image key={image.url} image={image} />
              ) : (
                <Text isUser={isUser} messageClassNames={messageClassNames} message={content} />
              )}
            </div>
            {/* Time */}
            <div
              className={clsx(
                'flex min-w-0 max-w-full flex-wrap items-center gap-x-1 pt-1.5 text-xs text-muted-foreground',
                isUser ? 'justify-end' : 'justify-start',
                !isImage && (isUser ? 'pr-11 sm:pr-[4.25rem]' : 'pl-11 sm:pl-[4.25rem]')
              )}>
              {!isUser &&
                (usage || finishReason) &&
                (usage ? (
                  showDetailedUsage ? (
                    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
                      {usage.totalTokens !== undefined && <span>Total: {usage.totalTokens}</span>}
                      {usage.inputTokens !== undefined && <span>Input: {usage.inputTokens}</span>}
                      {usage.outputTokens !== undefined && (
                        <span>Output: {usage.outputTokens}</span>
                      )}
                      {usage.reasoningTokens !== undefined && (
                        <span>Reasoning: {usage.reasoningTokens}</span>
                      )}
                      {usage.cachedInputTokens !== undefined && (
                        <span>Cached input: {usage.cachedInputTokens}</span>
                      )}
                      {finishReason && <span>Finish: {finishReason}</span>}
                    </span>
                  ) : (
                    <span>Total: {usage.totalTokens ?? 'Unknown'} tokens</span>
                  )
                ) : (
                  <span>Finish: {finishReason}</span>
                ))}
              {!isUser && usage && model && ' · '}
              {!isUser && model && (
                <span className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">
                  {model}
                </span>
              )}
              {!isUser && cancelled && (
                <span className="inline-flex items-center rounded-full border border-muted-foreground/20 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Cancelled
                </span>
              )}
              {isUser && requestState === 'failed' && (
                <span className="inline-flex items-center rounded-full border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                  Response failed
                </span>
              )}
              {isUser && requestState === 'interrupted' && (
                <span className="inline-flex items-center rounded-full border border-muted-foreground/20 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Interrupted
                </span>
              )}
            </div>
          </div>
        </motion.article>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          className="gap-2 [&>svg]:size-3.5 [&>svg]:shrink-0"
          disabled={!shareText}
          onSelect={() => void copyMessage()}>
          <CopyIcon />
          Copy message
        </ContextMenuItem>
        <ContextMenuItem
          className="gap-2 [&>svg]:size-3.5 [&>svg]:shrink-0"
          disabled={!shareText}
          onSelect={() => void shareMessage()}>
          <ShareIcon />
          Share message
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

const messageFallbackRender = ({}: FallbackProps) => (
  <Alert role="alert" className="my-5">
    <AlertTitle>Unable to render this message</AlertTitle>
    <AlertDescription>
      This message contains unsupported content. The rest of the conversation is still available.
    </AlertDescription>
  </Alert>
);

const Message = (props: MessageProps) => (
  <ErrorBoundary fallbackRender={messageFallbackRender}>
    <MessageContent {...props} />
  </ErrorBoundary>
);

export default memo(Message);
