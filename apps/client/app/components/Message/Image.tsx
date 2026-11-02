import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';
import { DownloadIcon, ImageOffIcon } from 'lucide-react';
import { toast } from 'sonner';
import { imageDimensions } from 'utils';

import { type IImageMessage } from '@/store/index';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import ImageEditorDialog, {
  ImageMetadata,
  renderImageBlob,
  saveImageBlob,
} from '@/components/Message/ImageEditorDialog';

interface ImageProps {
  image: IImageMessage['image_url'];
  model: string;
  /** Replaces the built-in editor when tapping the image, as the compare viewer does. */
  onOpen?: () => void;
}

const Image = ({ image, model, onOpen }: ImageProps) => {
  const { url, alt, size } = image;
  const [naturalDimensions, setNaturalDimensions] = useState<[number, number]>([0, 0]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [imageError, setImageError] = useState(!url);

  useEffect(() => {
    setImageError(!url);
  }, [url]);

  const [width, height] = useMemo(() => imageDimensions(size), [size]);
  const imageUnavailable = !url || imageError;

  const markImageUnavailable = () => {
    setImageError(true);
    setIsFullscreen(false);
  };

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth && naturalHeight) setNaturalDimensions([naturalWidth, naturalHeight]);
  };

  const downloadImage = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      saveImageBlob(await renderImageBlob(image));
    } catch (error) {
      console.error('Failed to download image:', error);
      toast.error('Image could not be downloaded');
    } finally {
      setIsDownloading(false);
    }
  };

  if (imageUnavailable) {
    return (
      <div
        className="flex w-full max-w-[400px] items-center justify-center rounded-2xl border border-border/70 bg-muted/60 text-muted-foreground"
        style={{ aspectRatio: `${width} / ${height}` }}
        role="img"
        aria-label="Generated image unavailable">
        <div className="flex flex-col items-center gap-2 px-4 text-center">
          <ImageOffIcon className="size-10" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Image unavailable</p>
          <p className="text-xs">The generated image is no longer available.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="group w-full min-w-0 max-w-[400px]">
        <figure className="relative min-w-0">
          <button
            type="button"
            onClick={() => (onOpen ? onOpen() : setIsFullscreen(true))}
            className="block w-full overflow-hidden rounded-2xl transition-[scale,box-shadow] duration-200 ease-[var(--ease-out)] hover:shadow-lg active:scale-[0.985] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="View image fullscreen">
            <img
              src={url}
              alt={alt || 'Generated image'}
              width={width}
              height={height}
              className="block h-auto w-full rounded-2xl object-contain shadow-xl"
              onLoad={handleImageLoad}
              onError={markImageUnavailable}
              loading="lazy"
            />
          </button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-2 bg-background/85 shadow-sm backdrop-blur-sm"
            disabled={isDownloading}
            onClick={() => void downloadImage()}
            title="Download image"
            aria-label="Download image">
            <DownloadIcon />
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">Model: {model}</p>
          <Accordion type="single" className="w-full" collapsible>
            <AccordionItem value="prompt">
              <AccordionTrigger>Prompt</AccordionTrigger>
              <AccordionContent>
                {alt ? (
                  <figcaption>{alt}</figcaption>
                ) : (
                  <p>This model did not provide a revised prompt.</p>
                )}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="metadata">
              <AccordionTrigger>Image details</AccordionTrigger>
              <AccordionContent>
                <ImageMetadata image={image} naturalDimensions={naturalDimensions} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </figure>
      </div>

      {!onOpen && (
        <ImageEditorDialog
          image={image}
          open={isFullscreen}
          onOpenChange={setIsFullscreen}
          onImageError={markImageUnavailable}
        />
      )}
    </>
  );
};

export default Image;
