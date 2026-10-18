import { useId, useState, type FormEvent } from 'react';
import { ListChecksIcon, PencilIcon, PlayIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { MAX_SUITE_PROMPTS, type ICompareSuite } from '@/utils/lforage';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

const MAX_SUITE_NAME = 80;
/** Matches the prompt limit of a single comparison. */
const MAX_SUITE_PROMPT_LENGTH = 32_000;

interface CompareSuitesProps {
  suites: readonly ICompareSuite[];
  isLoading: boolean;
  /** Running needs a valid model selection and no run in progress. */
  canRun: boolean;
  runDisabledReason?: string;
  disabled?: boolean;
  onSave: (suite: ICompareSuite) => Promise<void>;
  onDelete: (suiteId: string) => Promise<void>;
  onRun: (suite: ICompareSuite) => void;
}

type Draft = { id?: string; name: string; prompts: string };

const parsePrompts = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/** Saved prompt lists that run one after another against the selected models. */
const CompareSuites = ({
  suites,
  isLoading,
  canRun,
  runDisabledReason,
  disabled,
  onSave,
  onDelete,
  onRun,
}: CompareSuitesProps) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const nameId = useId();
  const promptsId = useId();
  const promptsHelpId = useId();

  const prompts = draft ? parsePrompts(draft.prompts) : [];
  const draftError = !draft
    ? undefined
    : !draft.name.trim()
      ? 'Give the suite a name.'
      : !prompts.length
        ? 'Add at least one prompt.'
        : prompts.length > MAX_SUITE_PROMPTS
          ? `A suite holds up to ${MAX_SUITE_PROMPTS} prompts.`
          : prompts.some((prompt) => prompt.length > MAX_SUITE_PROMPT_LENGTH)
            ? 'One of the prompts is too long.'
            : undefined;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setDraft(null);
      setPendingDeleteId(null);
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || draftError) return;
    setIsSaving(true);
    try {
      const existing = suites.find(({ id }) => id === draft.id);
      await onSave({
        id: draft.id ?? crypto.randomUUID(),
        name: draft.name.trim(),
        prompts,
        createdAt: existing?.createdAt ?? Date.now(),
      });
      setDraft(null);
    } catch (error) {
      console.error('Failed to save compare suite', error);
      toast.error('Could not save the suite.');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (suiteId: string) => {
    setPendingDeleteId(null);
    try {
      await onDelete(suiteId);
    } catch (error) {
      console.error('Failed to delete compare suite', error);
      toast.error('Could not delete the suite.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          title="Prompt suites: run a saved list of prompts in sequence"
          className="mt-0.5 h-9 shrink-0 gap-1.5 rounded-full px-3 text-muted-foreground hover:text-foreground">
          <ListChecksIcon />
          <span className="hidden sm:inline">Suites</span>
          <span className="sr-only sm:hidden">Prompt suites</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(40rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-lg flex-col gap-3 rounded-2xl p-5">
        <DialogHeader className="text-left">
          <DialogTitle className="tracking-tight">Prompt suites</DialogTitle>
          <DialogDescription>
            A suite runs each prompt in turn against the models you have selected. Every run is
            saved to History, where you can vote on it later.
          </DialogDescription>
        </DialogHeader>

        {draft ? (
          <form
            onSubmit={save}
            className="flex min-h-0 flex-col gap-3 duration-150 ease-[var(--ease-out)] animate-in fade-in-0 motion-safe:slide-in-from-bottom-1">
            <div className="flex flex-col gap-1">
              <label htmlFor={nameId} className="text-xs font-medium text-foreground">
                Name
              </label>
              <Input
                id={nameId}
                value={draft.name}
                maxLength={MAX_SUITE_NAME}
                autoFocus
                placeholder="e.g. Coding interview questions"
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </div>
            <div className="flex min-h-0 flex-col gap-1">
              <label htmlFor={promptsId} className="text-xs font-medium text-foreground">
                Prompts
              </label>
              <Textarea
                id={promptsId}
                value={draft.prompts}
                rows={8}
                aria-describedby={promptsHelpId}
                placeholder={
                  'One prompt per line\nExplain closures in JavaScript.\nWrite a SQL query that...'
                }
                className="max-h-64 min-h-32 resize-y"
                onChange={(event) => setDraft({ ...draft, prompts: event.target.value })}
              />
              <p id={promptsHelpId} className="text-xs text-muted-foreground">
                One prompt per line, up to {MAX_SUITE_PROMPTS}. {prompts.length}{' '}
                {prompts.length === 1 ? 'prompt' : 'prompts'} so far.
              </p>
            </div>
            {draftError && draft.name && draft.prompts && (
              <p role="alert" className="text-xs text-destructive">
                {draftError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={Boolean(draftError) || isSaving}>
                Save suite
              </Button>
            </div>
          </form>
        ) : (
          <>
            <ScrollArea className="min-h-0 flex-1">
              {isLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading suites...</p>
              ) : suites.length === 0 ? (
                <p className="py-6 text-center text-sm text-pretty text-muted-foreground">
                  No suites yet. Save a list of prompts you use to evaluate models, then run it in
                  one go.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {suites.map((suite) => (
                    <li
                      key={suite.id}
                      className="flex min-w-0 items-center gap-1 rounded-xl px-3 py-2 transition-colors duration-150 hover:bg-accent/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{suite.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {suite.prompts.length} {suite.prompts.length === 1 ? 'prompt' : 'prompts'}{' '}
                          - {suite.prompts[0]}
                        </p>
                      </div>
                      {pendingDeleteId === suite.id ? (
                        <div className="flex shrink-0 items-center gap-1 duration-150 ease-[var(--ease-out)] animate-in fade-in-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 rounded-full"
                            onClick={() => setPendingDeleteId(null)}>
                            Keep
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="h-9 rounded-full"
                            onClick={() => void remove(suite.id)}>
                            Delete
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                            aria-label={`Edit ${suite.name}`}
                            onClick={() =>
                              setDraft({
                                id: suite.id,
                                name: suite.name,
                                prompts: suite.prompts.join('\n'),
                              })
                            }>
                            <PencilIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-9 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Delete ${suite.name}`}
                            onClick={() => setPendingDeleteId(suite.id)}>
                            <Trash2Icon />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-9 shrink-0 rounded-full px-3.5"
                            disabled={!canRun}
                            title={canRun ? undefined : runDisabledReason}
                            aria-label={`Run ${suite.name}`}
                            onClick={() => {
                              handleOpenChange(false);
                              onRun(suite);
                            }}>
                            <PlayIcon className="fill-current" />
                            Run
                          </Button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
            {!canRun && runDisabledReason && suites.length > 0 && (
              <p className="text-xs text-muted-foreground">{runDisabledReason}</p>
            )}
            <Button
              type="button"
              variant="outline"
              className="self-start rounded-full"
              onClick={() => setDraft({ name: '', prompts: '' })}>
              <PlusIcon />
              New suite
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CompareSuites;
