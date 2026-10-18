import { StarIcon } from 'lucide-react';

import { cn } from '@/utils';
import {
  compareRubricCriteria,
  type CompareRubric,
  type CompareRubricCriterion,
} from '@/utils/lforage';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const criterionLabels: Record<CompareRubricCriterion, { label: string; hint: string }> = {
  correctness: { label: 'Correctness', hint: 'Facts and reasoning are right' },
  clarity: { label: 'Clarity', hint: 'Easy to follow' },
  conciseness: { label: 'Conciseness', hint: 'No padding or repetition' },
};

const scores = [1, 2, 3, 4, 5] as const;

interface RubricPopoverProps {
  /** Display name of the answer, used in accessible labels. */
  label: string;
  rubric?: CompareRubric;
  disabled: boolean;
  /** Passing the current score again clears it. */
  onRate: (criterion: CompareRubricCriterion, score: number) => void;
}

/** Optional 1-5 scores per criterion for one answer, one level below the Best vote. */
const RubricPopover = ({ label, rubric, disabled, onRate }: RubricPopoverProps) => {
  const given = compareRubricCriteria.flatMap((criterion) => rubric?.[criterion] ?? []);
  const average = given.length
    ? given.reduce((sum, score) => sum + score, 0) / given.length
    : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-9 shrink-0 gap-1 rounded-full px-2.5 text-muted-foreground hover:text-foreground"
          aria-label={
            average === undefined
              ? `Rate ${label}`
              : `Rate ${label}, currently ${average.toFixed(1)} out of 5`
          }>
          <StarIcon
            className={cn('size-3.5', average !== undefined && 'fill-primary text-primary')}
          />
          <span className="tabular-nums">
            {average === undefined ? 'Rate' : average.toFixed(1)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-2xl p-3">
        <p className="px-1 text-sm font-semibold tracking-tight text-foreground">
          Rate this answer
        </p>
        <p className="px-1 pb-2 text-xs text-muted-foreground">
          Optional. Tap a score again to clear it.
        </p>
        <div className="flex flex-col gap-2.5">
          {compareRubricCriteria.map((criterion) => {
            const { label: criterionLabel, hint } = criterionLabels[criterion];
            const current = rubric?.[criterion];
            return (
              <div key={criterion} className="flex flex-col gap-1">
                <p className="flex items-baseline justify-between gap-2 px-1">
                  <span className="text-xs font-medium text-foreground">{criterionLabel}</span>
                  <span className="truncate text-[0.6875rem] text-muted-foreground">{hint}</span>
                </p>
                <div
                  role="group"
                  aria-label={criterionLabel}
                  className="grid grid-cols-5 gap-0.5 rounded-full bg-muted p-0.5">
                  {scores.map((score) => {
                    const isSelected = current === score;
                    return (
                      <Button
                        key={score}
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-pressed={isSelected}
                        aria-label={`${criterionLabel} ${score} of 5`}
                        className={cn(
                          'h-8 rounded-full px-0 tabular-nums text-muted-foreground hover:bg-background/60 hover:text-foreground',
                          current !== undefined && score <= current && 'text-foreground',
                          isSelected &&
                            'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground'
                        )}
                        onClick={() => onRate(criterion, score)}>
                        {score}
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default RubricPopover;
