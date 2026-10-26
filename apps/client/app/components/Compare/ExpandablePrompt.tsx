import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import { cn } from '@/utils';
import { Button } from '@/components/ui/button';

const COLLAPSED_LINES = 2;

/**
 * The run's prompt, clamped to two lines with a control to read the rest in place. Expanded, it
 * grows up to 40% of the viewport and scrolls inside, so the answers never leave the screen.
 * Remount it (key) per run so each prompt starts collapsed.
 */
const ExpandablePrompt = ({ prompt }: { prompt: string }) => {
  const shouldReduceMotion = useReducedMotion();
  const contentId = useId();
  const textRef = useRef<HTMLParagraphElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsedHeight, setCollapsedHeight] = useState<number>();
  const [isExpanded, setIsExpanded] = useState(false);
  // The ellipsis comes back only once the collapse has finished, so the height eases down first.
  const [isClamped, setIsClamped] = useState(true);

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text) return;
    const measure = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(text).lineHeight);
      const clamped = lineHeight * COLLAPSED_LINES;
      // scrollHeight ignores the clamp, so it measures the whole prompt.
      setCollapsedHeight(text.scrollHeight > clamped + 1 ? clamped : undefined);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(text);
    return () => observer.disconnect();
  }, [prompt]);

  const canExpand = collapsedHeight !== undefined;
  const toggle = () => {
    if (isExpanded) scrollRef.current?.scrollTo({ top: 0 });
    else setIsClamped(false);
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="flex min-w-0 flex-col items-start">
      <motion.div
        id={contentId}
        className="w-full min-w-0 overflow-hidden"
        initial={false}
        animate={{ height: canExpand && !isExpanded ? collapsedHeight : 'auto' }}
        transition={
          shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.23, 1, 0.32, 1] }
        }
        onAnimationComplete={() => {
          if (!isExpanded) setIsClamped(true);
        }}>
        <div
          ref={scrollRef}
          // Focusable while it can scroll, so keyboard users can read a long prompt too.
          tabIndex={isExpanded ? 0 : undefined}
          className={cn(
            'rounded-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
            isExpanded && 'max-h-[40dvh] overflow-y-auto overscroll-contain'
          )}>
          <p
            ref={textRef}
            className={cn(
              'text-sm font-medium whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]',
              isClamped && 'line-clamp-2'
            )}>
            {prompt}
          </p>
        </div>
      </motion.div>
      {canExpand && (
        <Button
          type="button"
          variant="link"
          size="sm"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          className="h-8 gap-1 px-0 text-xs"
          onClick={toggle}>
          {isExpanded ? 'Show less' : 'Show full prompt'}
          <ChevronDownIcon
            className={cn(
              'transition-transform duration-150 ease-[var(--ease-out)] motion-reduce:transition-none',
              isExpanded && 'rotate-180'
            )}
          />
        </Button>
      )}
    </div>
  );
};

export default ExpandablePrompt;
