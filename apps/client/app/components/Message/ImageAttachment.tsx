import type { ImageAttachment as ImageAttachmentData } from 'utils';

interface ImageAttachmentProps {
  attachment: ImageAttachmentData;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const ImageAttachment = ({ attachment }: ImageAttachmentProps) => (
  <figure className="max-w-full overflow-hidden rounded-xl border border-border/70 bg-muted/40">
    <img
      src={attachment.dataUrl}
      alt={attachment.name}
      className="max-h-72 max-w-full object-contain"
      loading="lazy"
    />
    <figcaption className="flex max-w-full items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground">
      <span className="min-w-0 truncate text-foreground">{attachment.name}</span>
      <span className="shrink-0">{formatBytes(attachment.size)}</span>
    </figcaption>
  </figure>
);

export default ImageAttachment;
