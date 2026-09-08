import { XIcon } from 'lucide-react';

import type { ImageAttachment as ImageAttachmentData } from 'utils';
import { Button } from '@/components/ui/button';

interface ImageAttachmentProps {
  attachment: ImageAttachmentData;
  compact?: boolean;
  onRemove?: () => void;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const ImageAttachment = ({ attachment, compact = false, onRemove }: ImageAttachmentProps) => (
  <figure
    className={
      compact
        ? 'flex w-full max-w-[22rem] items-center gap-2 overflow-hidden rounded-xl border border-border/70 bg-muted/50 p-1.5'
        : 'w-full max-w-[28rem] overflow-hidden rounded-xl border border-border/70 bg-muted/40'
    }>
    <img
      src={attachment.dataUrl}
      alt={attachment.name}
      className={
        compact
          ? 'size-14 shrink-0 rounded-lg object-cover'
          : 'block max-h-80 w-full object-contain'
      }
      loading="lazy"
    />
    <figcaption
      className={
        compact
          ? 'flex min-w-0 flex-1 items-center gap-2 px-1'
          : 'flex max-w-full items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground'
      }>
      <span className="min-w-0 truncate text-foreground">{attachment.name}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(attachment.size)}</span>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          title={`Remove ${attachment.name}`}
          aria-label={`Remove ${attachment.name}`}
          className="-mr-1 size-6 shrink-0 rounded-full p-0"
          onClick={onRemove}>
          <XIcon className="size-3.5" />
        </Button>
      )}
    </figcaption>
  </figure>
);

export default ImageAttachment;
