import { TrophyIcon } from 'lucide-react';

import { cn } from '@/utils';
import { Button } from '@/components/ui/button';

interface CompareVoteButtonProps {
  /** The display label, so a blind run's accessible name never leaks the model. */
  label: string;
  isWinner: boolean;
  disabled: boolean;
  onVote: () => void;
}

/** Votes one result as the best in the run. */
const CompareVoteButton = ({ label, isWinner, disabled, onVote }: CompareVoteButtonProps) => (
  <Button
    type="button"
    size="sm"
    variant={isWinner ? 'default' : 'outline'}
    className="h-9 shrink-0 rounded-full px-3.5"
    disabled={disabled}
    aria-pressed={isWinner}
    aria-label={`Vote ${label} as the best answer`}
    onClick={onVote}>
    <TrophyIcon className={cn('size-3.5', isWinner && 'fill-current')} />
    {isWinner ? 'Best answer' : 'Best'}
  </Button>
);

export default CompareVoteButton;
