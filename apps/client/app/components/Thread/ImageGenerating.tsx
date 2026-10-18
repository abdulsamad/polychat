import { CircleAlertIcon, RotateCcwIcon } from 'lucide-react';
import { imageDimensions } from 'utils';

import { Button } from '@/components/ui/button';

interface ImageGeneratingProps {
  size?: string;
  error?: string;
  onRetry?: () => void;
  canRetry?: boolean;
}

const ImageGenerating = ({
  size = '1024x1024',
  error,
  onRetry,
  canRetry = true,
}: ImageGeneratingProps) => {
  const [width, height] = imageDimensions(size);
  const aspectRatio = width > 0 && height > 0 ? `${width} / ${height}` : '1 / 1';

  return (
    <div className="my-5 flex w-full flex-col" role="status" aria-live="polite">
      <div
        className="relative w-full max-w-[400px] overflow-hidden rounded-2xl border border-border/70 bg-muted/60 shadow-sm"
        style={{ aspectRatio }}>
        <div
          className={
            error
              ? 'absolute inset-0 bg-destructive/10'
              : 'absolute inset-0 overflow-hidden bg-muted'
          }>
          {!error && <div className="image-shimmer absolute inset-y-0 -left-1/2 w-1/2" />}
        </div>
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm">
          <div
            className={
              error
                ? 'flex size-20 items-center justify-center rounded-full bg-destructive/10 text-destructive/45'
                : 'rounded-full border border-border/70 bg-background/75 px-4 py-2 text-sm text-muted-foreground shadow-sm'
            }>
            {error ? <CircleAlertIcon className="size-10" aria-hidden="true" /> : 'Generating image...'}
          </div>
        </div>
      </div>
      {error && (
        <p className="mt-2 max-w-[400px] text-xs leading-4 text-destructive" role="alert">
          {error}
        </p>
      )}
      {error && onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-9 self-start"
          disabled={!canRetry}
          onClick={onRetry}>
          <RotateCcwIcon />
          Retry
        </Button>
      )}
    </div>
  );
};

export default ImageGenerating;
