import type { CompareTallyRow, HeadToHeadRecord } from '@/hooks/useCompareVotes';
import { PROVISIONAL_MATCHES } from '@/hooks/useCompareVotes';
import { formatCost, formatSpeed } from '@/utils/compare-metrics';
import { formatDuration } from '@/components/Compare/CompareColumn';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });
/** The matrix stays legible on small screens with at most this many models. */
const MAX_MATRIX_MODELS = 8;

const columns: Array<{ label: string; title: string; className?: string }> = [
  { label: 'Model', title: 'Sorted by rating' },
  {
    label: 'Rating',
    title: `Elo-style rating from your votes, starting at 1000. Marked new under ${PROVISIONAL_MATCHES} matches.`,
    className: 'text-right',
  },
  { label: 'Wins', title: 'Runs this model won', className: 'text-right' },
  { label: 'Win rate', title: 'Wins divided by runs where it answered', className: 'text-right' },
  { label: 'First token', title: 'Median time to first token', className: 'text-right' },
  { label: 'Speed', title: 'Median answer tokens per second', className: 'text-right' },
  { label: 'Avg cost', title: 'Average cost per answer', className: 'text-right' },
  {
    label: 'Score',
    title: 'Average rubric score (1-5) across rated answers',
    className: 'text-right',
  },
  {
    label: 'Failed',
    title: 'Share of runs that failed or returned nothing',
    className: 'text-right',
  },
  {
    label: 'Cut off',
    title: 'Share of answers cut off at the output token limit',
    className: 'text-right',
  },
];

const cellClass = 'px-3 py-2 text-right tabular-nums whitespace-nowrap';

export const RatingsTable = ({
  tally,
  getModelLabel,
}: {
  tally: readonly CompareTallyRow[];
  getModelLabel: (model: string) => string;
}) => (
  <Table className="text-sm">
    <TableHeader className="bg-muted/60">
      <TableRow>
        {columns.map(({ label, title, className }) => (
          <TableHead
            key={label}
            title={title}
            className={`h-9 px-3 whitespace-nowrap ${className ?? ''}`}>
            {label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
    <TableBody>
      {tally.map((row) => (
        <TableRow key={row.model}>
          <TableCell className="max-w-48 px-3 py-2">
            <span className="block truncate font-medium" title={getModelLabel(row.model)}>
              {getModelLabel(row.model)}
            </span>
          </TableCell>
          <TableCell
            className={cellClass}
            title={`${row.matches} pairwise ${row.matches === 1 ? 'match' : 'matches'}`}>
            <span className={row.isProvisional ? 'text-muted-foreground' : 'font-semibold'}>
              {row.rating}
            </span>
            {row.isProvisional && (
              <span className="ml-1 text-[0.6875rem] text-muted-foreground">new</span>
            )}
          </TableCell>
          <TableCell className={cellClass}>{row.wins}</TableCell>
          <TableCell className="px-3 py-2">
            <span className="flex items-center justify-end gap-2">
              <span
                aria-hidden="true"
                className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-muted sm:block">
                {/* scaleX keeps a changed vote's bar update on the compositor. */}
                <span
                  className="block h-full w-full origin-left rounded-full bg-primary transition-transform duration-250 ease-[var(--ease-out)]"
                  style={{ transform: `scaleX(${row.winRate})` }}
                />
              </span>
              <span className="tabular-nums">{percent.format(row.winRate)}</span>
            </span>
          </TableCell>
          <TableCell className={cellClass}>
            {formatDuration(
              row.medianTtftMs === undefined ? undefined : Math.round(row.medianTtftMs)
            )}
          </TableCell>
          <TableCell className={cellClass}>{formatSpeed(row.medianSpeed)}</TableCell>
          <TableCell className={cellClass}>{formatCost(row.avgCost)}</TableCell>
          <TableCell className={cellClass}>
            {row.avgScore === undefined ? '-' : row.avgScore.toFixed(1)}
          </TableCell>
          <TableCell className={`${cellClass} text-muted-foreground`}>
            {percent.format(row.failureRate)}
          </TableCell>
          <TableCell className={`${cellClass} text-muted-foreground`}>
            {percent.format(row.cutOffRate)}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const HeadToHeadMatrix = ({
  tally,
  getModelLabel,
  getHeadToHead,
}: {
  tally: readonly CompareTallyRow[];
  getModelLabel: (model: string) => string;
  getHeadToHead: (model: string, opponent: string) => HeadToHeadRecord | undefined;
}) => {
  const models = tally.filter(({ matches }) => matches > 0).slice(0, MAX_MATRIX_MODELS);

  if (models.length < 2) {
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
        Head-to-head results appear once two models have met in a voted run.
      </p>
    );
  }

  return (
    <Table className="text-sm">
      <caption className="caption-top px-3 pt-2 pb-1 text-left text-xs text-muted-foreground">
        Row model's win rate against the column model. Ties count as half.
      </caption>
      <TableHeader className="bg-muted/60">
        <TableRow>
          <TableHead className="h-9 px-3">
            <span className="sr-only">Model</span>
          </TableHead>
          {models.map(({ model }) => (
            <TableHead key={model} scope="col" className="h-9 max-w-28 px-3 text-right">
              <span className="block truncate" title={getModelLabel(model)}>
                {getModelLabel(model)}
              </span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {models.map(({ model }) => (
          <TableRow key={model}>
            <TableHead scope="row" className="max-w-40 px-3 py-2 font-medium text-foreground">
              <span className="block truncate" title={getModelLabel(model)}>
                {getModelLabel(model)}
              </span>
            </TableHead>
            {models.map(({ model: opponent }) => {
              if (opponent === model) {
                return (
                  <TableCell key={opponent} className="px-3 py-2 text-right text-muted-foreground">
                    <span aria-label="Same model">-</span>
                  </TableCell>
                );
              }
              const record = getHeadToHead(model, opponent);
              const games = record ? record.wins + record.losses + record.ties : 0;
              if (!record || !games) {
                return (
                  <TableCell key={opponent} className="px-3 py-2 text-right text-muted-foreground">
                    <span aria-label="Not played">-</span>
                  </TableCell>
                );
              }
              const rate = (record.wins + record.ties / 2) / games;
              return (
                <TableCell
                  key={opponent}
                  title={`${getModelLabel(model)} vs ${getModelLabel(opponent)}: ${record.wins} won, ${record.losses} lost, ${record.ties} tied`}
                  className="px-3 py-2 text-right tabular-nums whitespace-nowrap"
                  // The primary tint scales with the win rate and adapts to the active theme.
                  style={{
                    backgroundColor: `hsl(var(--primary) / ${(0.06 + rate * 0.3).toFixed(2)})`,
                  }}>
                  <span className="font-medium text-foreground">{percent.format(rate)}</span>
                  <span className="ml-1.5 text-[0.6875rem] text-muted-foreground">
                    {record.wins}-{record.losses}-{record.ties}
                  </span>
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
