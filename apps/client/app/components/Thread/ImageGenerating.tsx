interface ImageGeneratingProps {
  size?: string;
}

const ImageGenerating = ({ size = '1024x1024' }: ImageGeneratingProps) => {
  const [width, height] = size.split('x').map(Number);
  const aspectRatio = width > 0 && height > 0 ? `${width} / ${height}` : '1 / 1';

  return (
    <div className="my-5 flex w-full" role="status" aria-live="polite">
      <div
        className="relative w-full max-w-[400px] overflow-hidden rounded-2xl border border-border/70 bg-muted/60 shadow-sm"
        style={{ aspectRatio }}>
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-accent/40 to-muted" />
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm">
          <div className="rounded-full border border-border/70 bg-background/75 px-4 py-2 text-sm text-muted-foreground shadow-sm">
            Generating image...
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGenerating;
