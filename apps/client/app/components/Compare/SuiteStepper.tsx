import type { ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, ListChecksIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import { cn } from '@/utils';
import { Button } from '@/components/ui/button';

interface SuiteStepperProps {
  suiteName: string;
  /** Position of the shown prompt in the suite, starting at 0. */
  index: number;
  total: number;
  /** The way the last step went, so the counter rolls with it: 1 forward, -1 back, 0 none. */
  direction: -1 | 0 | 1;
  /** Stepping is offered only for a finished suite; both handlers come together. */
  onPrevious?: () => void;
  onNext?: () => void;
  canPrevious?: boolean;
  canNext?: boolean;
  /** Trailing action, such as opening the results or stopping the suite. */
  action?: ReactNode;
  className?: string;
}

/** A full-width bar for moving through a suite's prompts, with thumb-sized step targets. */
const SuiteStepper = ({
  suiteName,
  index,
  total,
  direction,
  onPrevious,
  onNext,
  canPrevious = false,
  canNext = false,
  action,
  className,
}: SuiteStepperProps) => {
  const shouldReduceMotion = useReducedMotion();
  const canStep = Boolean(onPrevious && onNext);
  const stepButtonClass = 'size-10 shrink-0 rounded-full sm:size-9';

  return (
    <div
      role="group"
      aria-label={`Suite ${suiteName}`}
      className={cn('flex min-w-0 items-center gap-1 rounded-2xl bg-muted/60 p-1', className)}>
      {canStep && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={stepButtonClass}
          aria-label="Previous prompt in suite"
          title="Previous prompt"
          disabled={!canPrevious}
          onClick={onPrevious}>
          <ChevronLeftIcon />
        </Button>
      )}
      <div className={cn('min-w-0 flex-1 px-2', canStep && 'text-center')}>
        <p
          className={cn(
            'flex min-w-0 items-center gap-1 text-[0.6875rem] text-muted-foreground',
            canStep && 'justify-center'
          )}>
          <ListChecksIcon className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate" title={suiteName}>
            {suiteName}
          </span>
        </p>
        <p className="text-sm font-medium text-foreground tabular-nums">
          Prompt{' '}
          {/* Keyed by position, so the number rolls in from the side the user moved toward. */}
          <span className="inline-flex overflow-hidden align-bottom">
            <motion.span
              key={index}
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, transform: `translateY(${direction < 0 ? -6 : 6}px)` }
              }
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}>
              {index + 1}
            </motion.span>
          </span>{' '}
          of {total}
        </p>
      </div>
      {canStep && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={stepButtonClass}
          aria-label="Next prompt in suite"
          title="Next prompt"
          disabled={!canNext}
          onClick={onNext}>
          <ChevronRightIcon />
        </Button>
      )}
      {action}
    </div>
  );
};

export default SuiteStepper;
