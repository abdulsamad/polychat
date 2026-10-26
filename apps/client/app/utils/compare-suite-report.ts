import {
  getBests,
  median,
  runCost,
  tokensPerSecond,
  type BestMetric,
  type ResultCost,
} from './compare-metrics';
import { configurationKey, describeSettings } from './compare-settings';
import {
  compareRubricCriteria,
  type CompareRubricCriterion,
  type ICompareRun,
  type ICompareRunColumn,
} from './lforage';

export interface SuiteExecution {
  suiteRunId: string;
  suiteId: string;
  suiteName: string;
  total: number;
  /** Saved runs in prompt order. */
  runs: ICompareRun[];
  /** Newest run time, used to order executions. */
  timestamp: number;
}

/** Groups saved runs by suite execution, newest first. */
export const getSuiteExecutions = (runs: readonly ICompareRun[]): SuiteExecution[] => {
  const executions = new Map<string, SuiteExecution>();
  for (const run of runs) {
    if (!run.suite) continue;
    const existing = executions.get(run.suite.suiteRunId);
    if (existing) {
      existing.runs.push(run);
      existing.timestamp = Math.max(existing.timestamp, run.timestamp);
    } else {
      executions.set(run.suite.suiteRunId, {
        suiteRunId: run.suite.suiteRunId,
        suiteId: run.suite.suiteId,
        suiteName: run.suite.suiteName,
        total: run.suite.total,
        runs: [run],
        timestamp: run.timestamp,
      });
    }
  }
  for (const execution of executions.values()) {
    execution.runs.sort((a, b) => (a.suite?.index ?? 0) - (b.suite?.index ?? 0));
  }
  return [...executions.values()].sort((a, b) => b.timestamp - a.timestamp);
};

/** An unvoted blind run keeps its models hidden, so per-model numbers would expose them. */
export const isRunIdentityHidden = (run: ICompareRun) => Boolean(run.blind && !run.winner);

/** The column a vote went to: by column id when stored, else the first column of that model. */
const getWinnerColumnId = (run: ICompareRun) => {
  if (run.winnerColumnId) return run.winnerColumnId;
  if (!run.winner || run.winner === 'tie' || run.winner === 'none') return undefined;
  return run.columns.find(({ model }) => model === run.winner)?.id;
};

const isAnswered = ({ status, content, image, video }: ICompareRunColumn) =>
  status === 'done' && Boolean(content.trim() || image || video);

const average = (values: readonly number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;

/** Mean of the criteria scored on one answer. */
export const rubricAverage = (column: ICompareRunColumn) =>
  average(compareRubricCriteria.flatMap((criterion) => column.rubric?.[criterion] ?? []));

/** One model configuration across the suite: the same model with other settings is another row. */
export interface SuiteModelStats {
  key: string;
  model: string;
  /** Settings and sample shown next to the model name; empty for defaults. */
  variant: string;
  columns: ICompareRunColumn[];
  wins: number;
  answered: number;
  failures: number;
  /** Wins over the voted runs this configuration took part in. */
  winRate?: number;
  rubric: Partial<Record<CompareRubricCriterion, number>>;
  score?: number;
  medianTtft?: number;
  medianTotal?: number;
  medianSpeed?: number;
  totalCost?: ResultCost;
}

export type SuiteCell =
  { state: 'won' | 'answered'; score?: number } | { state: 'failed' | 'missing' };

export interface SuitePromptRow {
  run: ICompareRun;
  /** Position in the suite, starting at 0. */
  index: number;
  cells: Record<string, SuiteCell>;
}

export type SuiteBestMetric = BestMetric | 'wins' | 'score';

export interface SuiteReport {
  execution: SuiteExecution;
  models: SuiteModelStats[];
  prompts: SuitePromptRow[];
  voted: number;
  unvotedRunIds: string[];
  /** True while a blind run is unvoted; per-model data stays hidden until then. */
  isHidden: boolean;
  totalCost?: ResultCost;
  /** Sum of each run's slowest answer. */
  totalMs?: number;
  bests: Partial<Record<SuiteBestMetric, string>>;
}

const variantKey = (column: ICompareRunColumn) =>
  `${configurationKey(column.model, column.settings)}#${column.sample ?? ''}`;

/** Every number the suite report shows, built from the suite's saved runs. */
export const buildSuiteReport = (
  execution: SuiteExecution,
  costOf: (column: ICompareRunColumn) => ResultCost | undefined
): SuiteReport => {
  const stats = new Map<string, SuiteModelStats & { votedRuns: number }>();
  const prompts: SuitePromptRow[] = [];

  for (const run of execution.runs) {
    const winnerColumnId = getWinnerColumnId(run);
    const isVoted = Boolean(run.winner);
    const cells: Record<string, SuiteCell> = {};

    for (const column of run.columns) {
      const key = variantKey(column);
      const entry = stats.get(key) ?? {
        key,
        model: column.model,
        variant: [
          describeSettings(column.settings),
          column.sample !== undefined && `#${column.sample}`,
        ]
          .filter(Boolean)
          .join(' '),
        columns: [],
        wins: 0,
        answered: 0,
        failures: 0,
        votedRuns: 0,
        rubric: {},
      };
      entry.columns.push(column);
      if (isVoted) entry.votedRuns += 1;
      const isWinner = column.id === winnerColumnId;
      if (isWinner) entry.wins += 1;
      if (isAnswered(column)) {
        entry.answered += 1;
        cells[key] = { state: isWinner ? 'won' : 'answered', score: rubricAverage(column) };
      } else {
        entry.failures += 1;
        cells[key] = { state: 'failed' };
      }
      stats.set(key, entry);
    }
    prompts.push({ run, index: run.suite?.index ?? prompts.length, cells });
  }

  const models = [...stats.values()].map(({ votedRuns, ...entry }): SuiteModelStats => {
    const answered = entry.columns.filter(isAnswered);
    const rubric: SuiteModelStats['rubric'] = {};
    for (const criterion of compareRubricCriteria) {
      const value = average(answered.flatMap(({ rubric: scores }) => scores?.[criterion] ?? []));
      if (value !== undefined) rubric[criterion] = value;
    }
    return {
      ...entry,
      winRate: votedRuns ? entry.wins / votedRuns : undefined,
      rubric,
      score: average(answered.flatMap((column) => rubricAverage(column) ?? [])),
      medianTtft: median(answered.flatMap(({ ttftMs }) => ttftMs ?? [])),
      medianTotal: median(answered.flatMap(({ totalMs }) => totalMs ?? [])),
      medianSpeed: median(answered.flatMap((column) => tokensPerSecond(column) ?? [])),
      totalCost: runCost(entry.columns, costOf),
    };
  });
  models.sort(
    (a, b) =>
      b.wins - a.wins ||
      (b.score ?? 0) - (a.score ?? 0) ||
      (b.winRate ?? 0) - (a.winRate ?? 0) ||
      a.failures - b.failures
  );

  for (const row of prompts) {
    for (const { key } of models) row.cells[key] ??= { state: 'missing' };
  }

  const bests: SuiteReport['bests'] = getBests(
    models.map((model) => ({ ...model, id: model.key })),
    (model) => ({
      ttft: model.medianTtft,
      total: model.medianTotal,
      speed: model.medianSpeed,
      cost: model.totalCost?.usd,
    })
  );
  const topBy = (value: (model: SuiteModelStats) => number | undefined) => {
    const scored = models.filter((model) => (value(model) ?? 0) > 0);
    if (models.length < 2 || !scored.length) return undefined;
    const best = Math.max(...scored.map((model) => value(model) ?? 0));
    const leaders = scored.filter((model) => value(model) === best);
    // A shared lead carries no signal.
    return leaders.length === 1 ? leaders[0].key : undefined;
  };
  const winsLeader = topBy(({ wins }) => wins);
  if (winsLeader) bests.wins = winsLeader;
  const scoreLeader = topBy(({ score }) => score);
  if (scoreLeader) bests.score = scoreLeader;

  const runTimes = execution.runs.flatMap(({ columns }) => {
    const times = columns.flatMap(({ totalMs }) => totalMs ?? []);
    return times.length ? [Math.max(...times)] : [];
  });

  return {
    execution,
    models,
    prompts,
    voted: execution.runs.filter(({ winner }) => winner).length,
    unvotedRunIds: execution.runs.filter(({ winner }) => !winner).map(({ id }) => id),
    isHidden: execution.runs.some(isRunIdentityHidden),
    totalCost: runCost(
      execution.runs.flatMap(({ columns }) => columns),
      costOf
    ),
    totalMs: runTimes.length ? runTimes.reduce((sum, ms) => sum + ms, 0) : undefined,
    bests,
  };
};
