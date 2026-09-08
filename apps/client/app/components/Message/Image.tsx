import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';
import {
  CopyIcon,
  DownloadIcon,
  FlipHorizontal2Icon,
  FlipVertical2Icon,
  ImageOffIcon,
  RotateCcwIcon,
  RotateCwIcon,
  ShareIcon,
} from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';

interface ImageProps {
  image: IImageMessage['image_url'];
  model: string;
}

interface ImageControlsOptions {
  showDownload: boolean;
  showSharing: boolean;
}

const imageActionClassName =
  'transition-[transform,background-color,border-color,color] duration-150 hover:-translate-y-0.5 active:scale-90';

const Image = ({ image: { url, alt, size }, model }: ImageProps) => {
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [blur, setBlur] = useState(0);
  const [naturalDimensions, setNaturalDimensions] = useState<[number, number]>([0, 0]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [imageError, setImageError] = useState(!url);

  useEffect(() => {
    setImageError(!url);
  }, [url]);

  const [width, height] = useMemo(() => imageDimensions(size), [size]);
  const transform = `rotate(${rotation}deg) scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1})`;
  const filter = `brightness(${brightness}%) contrast(${contrast}%) blur(${blur}px)`;
  const displayWidth = naturalDimensions[0] || width;
  const displayHeight = naturalDimensions[1] || height;
  const imageFormat = url?.match(/^data:([^;,]+)/)?.[1] || 'image/png';
  const imageUnavailable = !url || imageError;

  const markImageUnavailable = () => {
    setImageError(true);
    setIsFullscreen(false);
  };

  const sourceBytes = useMemo(() => {
    const encoded = url?.match(/^data:[^,]+;base64,(.+)$/)?.[1];
    if (!encoded) return 0;
    const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding);
  }, [url]);

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth && naturalHeight) setNaturalDimensions([naturalWidth, naturalHeight]);
  };

  const formatBytes = (value: number) => {
    if (!value) return 'Unknown';
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  };

  const resetTransformations = () => {
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
    setBrightness(100);
    setContrast(100);
    setBlur(0);
  };

  const renderImageBlob = async () => {
    const source = new window.Image();
    source.crossOrigin = 'anonymous';
    const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
      source.onload = () => resolve(source);
      source.onerror = () => reject(new Error('Image failed to load'));
    });
    source.src = url;
    const loadedImage = await loaded;
    const sourceWidth = loadedImage.naturalWidth || width;
    const sourceHeight = loadedImage.naturalHeight || height;
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    const isQuarterTurn = normalizedRotation === 90 || normalizedRotation === 270;
    const canvas = document.createElement('canvas');
    canvas.width = isQuarterTurn ? sourceHeight : sourceWidth;
    canvas.height = isQuarterTurn ? sourceWidth : sourceHeight;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available');

    context.filter = filter;
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((normalizedRotation * Math.PI) / 180);
    context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    context.drawImage(loadedImage, -sourceWidth / 2, -sourceHeight / 2);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error('Image could not be encoded'));
      }, 'image/png');
    });
  };

  const downloadImage = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      const blob = await renderImageBlob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'generated-image.png';
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Failed to download image:', error);
      toast.error('Image could not be downloaded');
    } finally {
      setIsDownloading(false);
    }
  };

  const copyImage = async () => {
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Image clipboard is not supported');
      }
      const blob = await renderImageBlob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      toast.success('Image copied');
    } catch (error) {
      console.error('Failed to copy image:', error);
      toast.error('Image could not be copied');
    }
  };

  const shareImage = async () => {
    try {
      if (!navigator.share) throw new Error('Image sharing is not supported');
      const blob = await renderImageBlob();
      const file = new File([blob], 'generated-image.png', { type: blob.type });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        throw new Error('Image sharing is not supported');
      }
      await navigator.share({ files: [file], title: alt || 'Generated image' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Failed to share image:', error);
      toast.error('Image could not be shared');
    }
  };

  const rotateImage = () => setRotation((value) => (value + 90) % 360);
  const flipImageX = () => setFlipX((value) => !value);
  const flipImageY = () => setFlipY((value) => !value);

  const imageControls = ({ showDownload, showSharing }: ImageControlsOptions) => (
    <div className="flex max-w-full flex-wrap items-center justify-center gap-1">
      {showDownload && (
        <Button
          variant="outline"
          size="icon"
          className={imageActionClassName}
          disabled={isDownloading}
          onClick={() => void downloadImage()}
          title="Download image"
          aria-label="Download image">
          <DownloadIcon />
        </Button>
      )}
      {showSharing && (
        <>
          <Button
            variant="outline"
            size="icon"
            className={imageActionClassName}
            onClick={() => void copyImage()}
            title="Copy image"
            aria-label="Copy image">
            <CopyIcon />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={imageActionClassName}
            onClick={() => void shareImage()}
            title="Share image"
            aria-label="Share image">
            <ShareIcon />
          </Button>
        </>
      )}
      <Button
        variant="outline"
        size="icon"
        title="Rotate image"
        aria-label="Rotate image"
        className={imageActionClassName}
        onClick={rotateImage}>
        <RotateCwIcon />
      </Button>
      <Button
        variant="outline"
        size="icon"
        title="Flip image horizontally"
        aria-label="Flip image horizontally"
        className={imageActionClassName}
        onClick={flipImageX}>
        <FlipHorizontal2Icon />
      </Button>
      <Button
        variant="outline"
        size="icon"
        title="Flip image vertically"
        aria-label="Flip image vertically"
        className={imageActionClassName}
        onClick={flipImageY}>
        <FlipVertical2Icon />
      </Button>
      <Button
        variant="outline"
        size="icon"
        title="Reset image transformations"
        aria-label="Reset image transformations"
        className={imageActionClassName}
        onClick={resetTransformations}>
        <RotateCcwIcon />
      </Button>
    </div>
  );

  const metadataContent = (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
      <dt className="text-muted-foreground">Dimensions</dt>
      <dd>
        {displayWidth} x {displayHeight}px
      </dd>
      <dt className="text-muted-foreground">Format</dt>
      <dd>{imageFormat}</dd>
      <dt className="text-muted-foreground">Requested size</dt>
      <dd>{size}</dd>
      <dt className="text-muted-foreground">Model</dt>
      <dd className="break-words">{model}</dd>
      <dt className="text-muted-foreground">File size</dt>
      <dd>{formatBytes(sourceBytes)}</dd>
    </dl>
  );

  const adjustmentContent = (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="grid gap-1.5 text-xs">
        <span className="flex justify-between gap-2">
          <span>Brightness</span>
          <span className="text-muted-foreground">{brightness}%</span>
        </span>
        <Slider
          min={50}
          max={150}
          step={1}
          value={[brightness]}
          onValueChange={([value]) => setBrightness(value ?? 100)}
          aria-label="Brightness"
        />
      </label>
      <label className="grid gap-1.5 text-xs">
        <span className="flex justify-between gap-2">
          <span>Contrast</span>
          <span className="text-muted-foreground">{contrast}%</span>
        </span>
        <Slider
          min={50}
          max={150}
          step={1}
          value={[contrast]}
          onValueChange={([value]) => setContrast(value ?? 100)}
          aria-label="Contrast"
        />
      </label>
      <label className="grid gap-1.5 text-xs">
        <span className="flex justify-between gap-2">
          <span>Blur</span>
          <span className="text-muted-foreground">{blur}px</span>
        </span>
        <Slider
          min={0}
          max={20}
          step={1}
          value={[blur]}
          onValueChange={([value]) => setBlur(value ?? 0)}
          aria-label="Blur"
        />
      </label>
    </div>
  );

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
            onClick={() => setIsFullscreen(true)}
            className="block w-full overflow-hidden rounded-2xl transition-[transform,box-shadow] duration-200 hover:shadow-lg active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="View image fullscreen">
            <img
              src={url}
              alt={alt || 'Generated image'}
              width={width}
              height={height}
              className="block h-auto w-full rounded-2xl object-contain shadow-xl transition-[filter,transform]"
              style={{ transform, filter }}
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
          <div className="mt-2">{imageControls({ showDownload: false, showSharing: false })}</div>
          <Accordion type="single" className="w-full" collapsible>
            <AccordionItem value="prompt">
              <AccordionTrigger>Prompt</AccordionTrigger>
              <AccordionContent>
                {alt ? <figcaption>{alt}</figcaption> : <p>No prompt to show.</p>}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="metadata">
              <AccordionTrigger>Image details</AccordionTrigger>
              <AccordionContent>{metadataContent}</AccordionContent>
            </AccordionItem>
          </Accordion>
        </figure>
      </div>

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden border-border/70 bg-background p-3 text-foreground sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:p-5">
          <DialogTitle className="sr-only">{alt || 'Generated image'}</DialogTitle>
          <DialogDescription className="sr-only">
            Fullscreen image viewer with image editing, download, copy, and share controls.
          </DialogDescription>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/95 p-2 sm:p-4">
            <img
              src={url}
              alt={alt || 'Generated image'}
              width={width}
              height={height}
              className="block max-h-full max-w-full object-contain"
              style={{ transform, filter }}
              onLoad={handleImageLoad}
              onError={markImageUnavailable}
            />
          </div>
          <Accordion type="single" className="mx-auto mt-3 w-full max-w-2xl" collapsible>
            <AccordionItem value="adjustments">
              <AccordionTrigger>Adjustments</AccordionTrigger>
              <AccordionContent>{adjustmentContent}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="metadata">
              <AccordionTrigger>Image details</AccordionTrigger>
              <AccordionContent>{metadataContent}</AccordionContent>
            </AccordionItem>
          </Accordion>
          <div className="flex shrink-0 justify-center pt-3">
            {imageControls({ showDownload: true, showSharing: true })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Image;
