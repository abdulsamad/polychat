import { useEffect, useRef, useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';

import { Button } from '@/components/ui/button';

interface CopyButtonProps {
  text: string;
  label: string;
  className?: string;
}

const CopyButton = ({ text, label, className }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    []
  );

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copied`);

      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 1400);
    } catch (error) {
      console.error(`Failed to copy ${label.toLowerCase()}:`, error);
      toast.error(`${label} could not be copied`);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={`Copy ${label.toLowerCase()}`}
      aria-label={`Copy ${label.toLowerCase()}`}
      onClick={() => void copyText()}
      className={clsx(
        'size-7 text-muted-foreground transition-transform duration-150 active:scale-90',
        copied && 'text-primary',
        className
      )}>
      <span className="relative flex size-3.5" aria-hidden="true">
        <CopyIcon
          className={clsx(
            'absolute size-3.5 transition-all duration-150',
            copied ? 'scale-50 opacity-0' : 'scale-100 opacity-100'
          )}
        />
        <CheckIcon
          className={clsx(
            'absolute size-3.5 transition-all duration-150',
            copied ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
          )}
        />
      </span>
      <span className="sr-only">Copy {label.toLowerCase()}</span>
    </Button>
  );
};

export default CopyButton;
