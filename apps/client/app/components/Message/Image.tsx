import { useMemo, useState } from 'react';
import {
  DownloadIcon,
  FlipHorizontal2Icon,
  FlipVertical2Icon,
  RotateCwIcon,
} from 'lucide-react';
import { Gallery, Item } from 'react-photoswipe-gallery';

import { type IImageMessage } from '@/store/index';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import 'photoswipe/dist/photoswipe.css';

interface ImageProps {
  image: IImageMessage['image_url'];
}

const Image = ({ image: { url, alt, size } }: ImageProps) => {
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);

  const width = useMemo(() => parseInt(size.split('x')[0]), [size]);
  const height = useMemo(() => parseInt(size.split('x')[1]), [size]);

  return (
    <div className="group w-full min-w-0 max-w-[400px]">
      <figure className="min-w-0">
        <Gallery withDownloadButton>
          <Item original={url} width={width} height={height} alt={alt}>
            {({ ref, open }) => (
              <button
                ref={ref}
                type="button"
                onClick={open}
                className="block w-full overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="View image fullscreen">
                <img
                  src={url}
                  alt={alt || 'Generated image'}
                  width={width}
                  height={height}
                  className="block h-auto w-full rounded-2xl shadow-xl transition-transform"
                  style={{
                    transform: `rotate(${rotation}deg) scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1})`,
                  }}
                  loading="lazy"
                />
              </button>
            )}
          </Item>
        </Gallery>
        <div className="mt-2 flex items-center gap-1">
          <Button variant="outline" size="icon" asChild>
            <a href={url} download="generated-image.png" title="Download image">
              <DownloadIcon />
              <span className="sr-only">Download image</span>
            </a>
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="Rotate image"
            onClick={() => setRotation((value) => (value + 90) % 360)}>
            <RotateCwIcon />
            <span className="sr-only">Rotate image</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="Flip image horizontally"
            onClick={() => setFlipX((value) => !value)}>
            <FlipHorizontal2Icon />
            <span className="sr-only">Flip image horizontally</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="Flip image vertically"
            onClick={() => setFlipY((value) => !value)}>
            <FlipVertical2Icon />
            <span className="sr-only">Flip image vertically</span>
          </Button>
        </div>
        <Accordion type="single" className="w-full" collapsible>
          <AccordionItem value="prompt">
            <AccordionTrigger>Prompt</AccordionTrigger>
            <AccordionContent className="group/prompt relative">
              {alt ? (
                <figcaption>{alt}</figcaption>
              ) : (
                <div className="text-center p-2">
                  <h1>No prompt to show!</h1>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </figure>
    </div>
  );
};

export default Image;
