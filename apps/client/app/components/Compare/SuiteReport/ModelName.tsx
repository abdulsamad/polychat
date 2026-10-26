import { cn } from '@/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Drops a leading vendor prefix such as "Anthropic: " (OpenRouter labels) so narrow tables lead
 * with the part that tells models apart. The full label stays one tap away.
 */
export const shortModelLabel = (label: string) => label.replace(/^[^:]{1,24}:\s+/, '') || label;

interface ModelNameProps {
  model: string;
  label: string;
  variant?: string;
  className?: string;
}

/** A model name that wraps to two lines and opens its full name and id on tap. */
const ModelName = ({ model, label, variant, className }: ModelNameProps) => {
  const short = shortModelLabel(label);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={variant ? `${label} ${variant}` : label}
          aria-label={`${label}${variant ? ` ${variant}` : ''}: show full name`}
          className={cn(
            'min-w-0 rounded-md text-left transition-[background-color,scale] duration-150 ease-[var(--ease-out)] hover:bg-accent/60 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.97] motion-reduce:active:scale-100',
            className
          )}>
          <span className="line-clamp-2 font-medium [overflow-wrap:anywhere]">{short}</span>
          {variant && (
            <span className="block truncate text-[0.6875rem] font-normal text-muted-foreground">
              {variant}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto max-w-[min(20rem,var(--radix-popover-content-available-width))] p-3">
        <p className="text-sm font-medium [overflow-wrap:anywhere] text-foreground">{label}</p>
        {variant && <p className="text-xs text-muted-foreground">{variant}</p>}
        <p className="mt-1 font-mono text-[0.6875rem] [overflow-wrap:anywhere] text-muted-foreground">
          {model}
        </p>
      </PopoverContent>
    </Popover>
  );
};

export default ModelName;
