import { ImageOffIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

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

const ImageAttachment = ({ attachment, compact = false, onRemove }: ImageAttachmentProps) => {
  const [imageError, setImageError] = useState(!attachment.dataUrl);

  useEffect(() => {
    setImageError(!attachment.dataUrl);
  }, [attachment.dataUrl]);

  return (
    <figure
      className={
        compact
          ? 'flex w-full max-w-[22rem] items-center gap-2 overflow-hidden rounded-xl border border-border/70 bg-muted/50 p-1.5'
          : 'w-full max-w-[28rem] overflow-hidden rounded-xl border border-border/70 bg-muted/40'
      }>
      {imageError ? (
        <div
          className={
            compact
              ? 'flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground'
              : 'flex min-h-48 w-full items-center justify-center bg-muted/60 text-muted-foreground'
          }
          role="img"
          aria-label={`Image unavailable: ${attachment.name}`}>
          <ImageOffIcon className={compact ? 'size-5' : 'size-8'} aria-hidden="true" />
        </div>
      ) : (
        <img
          src={attachment.dataUrl}
          alt={attachment.name}
          className={
            compact
              ? 'size-14 shrink-0 rounded-lg object-cover'
              : 'block max-h-80 w-full object-contain'
          }
          loading="lazy"
          onError={() => setImageError(true)}
        />
      )}
      <figcaption
        className={
          compact
            ? 'flex min-w-0 flex-1 items-center gap-2 px-1'
            : 'flex max-w-full items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground'
        }>
        <span className="min-w-0 truncate text-foreground">
          {imageError ? 'Image unavailable' : attachment.name}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatBytes(attachment.size)}
        </span>
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
};

export default ImageAttachment;
