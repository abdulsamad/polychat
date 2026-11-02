import { cn } from '@/utils';
import { Button } from '@/components/ui/button';

interface CompareRunVerdictsProps {
  winner?: string | null;
  canVote: boolean;
  isRunning: boolean;
  onVote: (choice: 'tie' | 'none') => void;
}

/**
 * A segmented group keeps the run-level verdicts visually apart from the per-answer Best buttons;
 * the pressed segment lifts onto the background like a thumb.
 */
const CompareRunVerdicts = ({ winner, canVote, isRunning, onVote }: CompareRunVerdictsProps) => (
  <div
    role="group"
    aria-label="Other votes"
    className={cn(
      'flex shrink-0 items-center gap-0.5 rounded-full bg-muted p-0.5 transition-opacity duration-200',
      (!canVote || isRunning) && 'opacity-60'
    )}>
    {(['tie', 'none'] as const).map((choice) => {
      const isPressed = winner === choice;
      return (
        <Button
          key={choice}
          type="button"
          size="sm"
          variant="ghost"
          className={cn(
            'h-8 rounded-full px-3.5 text-muted-foreground hover:bg-background/60 hover:text-foreground disabled:opacity-100',
            isPressed &&
              'bg-background text-foreground shadow-sm hover:bg-background dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent'
          )}
          // Tie and none judge every answer, so they wait for the whole run.
          disabled={!canVote || isRunning}
          aria-pressed={isPressed}
          aria-label={choice === 'tie' ? 'Vote tie' : 'Vote none of the answers'}
          onClick={() => onVote(choice)}>
          {choice === 'tie' ? 'Tie' : 'None'}
        </Button>
      );
    })}
  </div>
);

export default CompareRunVerdicts;
