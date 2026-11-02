import { type SyntheticEvent, useMemo, useState } from 'react';
import {
  CopyIcon,
  DownloadIcon,
  FlipHorizontal2Icon,
  FlipVertical2Icon,
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

type EditorImage = IImageMessage['image_url'];

interface RenderOptions {
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  filter?: string;
}

/** Draws the image with any edits applied, for download, copy and share. */
export const renderImageBlob = async (
  { url, size }: Pick<EditorImage, 'url' | 'size'>,
  { rotation = 0, flipX = false, flipY = false, filter = 'none' }: RenderOptions = {}
) => {
  const [width, height] = imageDimensions(size);
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

/** Saves a rendered image through a temporary link. */
export const saveImageBlob = (blob: Blob) => {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = 'generated-image.png';
  link.click();
  URL.revokeObjectURL(downloadUrl);
};

const formatBytes = (value: number) => {
  if (!value) return 'Unknown';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

interface ImageMetadataProps {
  image: Pick<EditorImage, 'url' | 'size'>;
  naturalDimensions: [number, number];
}

export const ImageMetadata = ({ image: { url, size }, naturalDimensions }: ImageMetadataProps) => {
  const [width, height] = useMemo(() => imageDimensions(size), [size]);
  const sourceBytes = useMemo(() => {
    const encoded = url?.match(/^data:[^,]+;base64,(.+)$/)?.[1];
    if (!encoded) return 0;
    const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding);
  }, [url]);

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
      <dt className="text-muted-foreground">Dimensions</dt>
      <dd>
        {naturalDimensions[0] || width} x {naturalDimensions[1] || height}px
      </dd>
      <dt className="text-muted-foreground">Format</dt>
      <dd>{url?.match(/^data:([^;,]+)/)?.[1] || 'image/png'}</dd>
      <dt className="text-muted-foreground">Requested size</dt>
      <dd>{size}</dd>
      <dt className="text-muted-foreground">File size</dt>
      <dd>{formatBytes(sourceBytes)}</dd>
    </dl>
  );
};

interface ImageControlsOptions {
  showDownload: boolean;
  showSharing: boolean;
}

const imageActionClassName =
  'transition-[translate,scale,background-color,border-color,color] duration-150 ease-[var(--ease-out)] hover:-translate-y-0.5 active:scale-[0.95] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100';

interface ImageEditorDialogProps {
  image: EditorImage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageError: () => void;
}

/** The full image viewer with edits, shared by chat images and the compare viewer. */
const ImageEditorDialog = ({ image, open, onOpenChange, onImageError }: ImageEditorDialogProps) => {
  const { url, alt, size } = image;
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [blur, setBlur] = useState(0);
  const [naturalDimensions, setNaturalDimensions] = useState<[number, number]>([0, 0]);
  const [isDownloading, setIsDownloading] = useState(false);

  const [width, height] = useMemo(() => imageDimensions(size), [size]);
  const transform = `rotate(${rotation}deg) scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1})`;
  const filter = `brightness(${brightness}%) contrast(${contrast}%) blur(${blur}px)`;

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth && naturalHeight) setNaturalDimensions([naturalWidth, naturalHeight]);
  };

  const resetTransformations = () => {
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
    setBrightness(100);
    setContrast(100);
    setBlur(0);
  };

  const renderEditedBlob = () => renderImageBlob(image, { rotation, flipX, flipY, filter });

  const downloadImage = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      saveImageBlob(await renderEditedBlob());
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
      const blob = await renderEditedBlob();
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
      const blob = await renderEditedBlob();
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

  const handleOpenChange = (next: boolean) => {
    if (!next) resetTransformations();
    onOpenChange(next);
  };

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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            onError={onImageError}
          />
        </div>
        <Accordion type="single" className="mx-auto mt-3 w-full max-w-2xl" collapsible>
          <AccordionItem value="adjustments">
            <AccordionTrigger>Adjustments</AccordionTrigger>
            <AccordionContent>{adjustmentContent}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="metadata">
            <AccordionTrigger>Image details</AccordionTrigger>
            <AccordionContent>
              <ImageMetadata image={image} naturalDimensions={naturalDimensions} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <div className="flex shrink-0 justify-center pt-3">
          {imageControls({ showDownload: true, showSharing: true })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageEditorDialog;
