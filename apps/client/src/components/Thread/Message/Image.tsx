import React, { useCallback, useMemo, useRef } from 'react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { toast } from 'sonner';
import { Download, Copy, RotateCw } from 'lucide-react';
import ImageGallery from 'react-image-gallery';

import 'react-image-gallery/styles/css/image-gallery.css';

import { IImageMessage } from '@/store/index';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const Image = ({ image: { url, alt }, size }: Omit<IImageMessage, 'format'>) => {
  const elemRef = useRef<HTMLDivElement>(null);

  const width = useMemo(() => parseInt(size.split('x')[0]), [size]);
  const height = useMemo(() => parseInt(size.split('x')[1]), [size]);

  const rotateImage = useCallback(() => {
    const extractRotationValue = (transformString: string) => {
      const match = transformString.match(/rotate\((\d+)deg\)/);
      return match ? (parseInt(match[1]) > 360 ? 90 : parseInt(match[1])) : 0;
    };

    const image = elemRef.current?.querySelector('.image-gallery-image') as HTMLImageElement;

    if (image) {
      const rotation = extractRotationValue(image.style.transform);
      image.style.transform = `rotate(${rotation + 90}deg)`;
    }
  }, []);

  return (
    <div ref={elemRef} className="group max-w-[400px]">
      <figure>
        <div style={{ width, height }} className="relative inline-block">
          <ImageGallery
            items={[
              {
                original: url as string,
                originalAlt: alt,
                originalClass: 'generated-image',
              },
            ]}
            renderCustomControls={() => (
              <>
                <Button variant="outline" size="icon" asChild>
                  <a
                    href={url}
                    title="Download"
                    className="group-hover:flex hidden m-3 items-center justify-center absolute bottom-0 left-0 z-10"
                    download>
                    <Download />
                    <span className="sr-only">Download image</span>
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  title="Rotate"
                  onClick={rotateImage}
                  className="group-hover:flex hidden m-3 items-center justify-center absolute bottom-0 right-12 z-10">
                  <RotateCw />
                  <span className="sr-only">Rotate image</span>
                </Button>
              </>
            )}
            showThumbnails={false}
            showPlayButton={false}
            showNav={false}
          />
        </div>
        <Accordion type="single" className="w-full" collapsible>
          <AccordionItem value="prompt">
            <AccordionTrigger>Prompt</AccordionTrigger>
            <AccordionContent className="group/prompt relative">
              {alt ? (
                <>
                  <figcaption>{alt}</figcaption>
                  <CopyToClipboard text={alt as string} onCopy={() => toast.success('Copied!')}>
                    <Button
                      title="Copy"
                      size="icon"
                      className="h-6 w-6 absolute right-0 bottom-0 m-3 group-hover/prompt:visible invisible">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </CopyToClipboard>
                </>
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
