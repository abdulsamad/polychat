import { useRef } from 'react';
import { PlusIcon, XIcon } from 'lucide-react';

import { cn } from '@/utils';
import type { ModelOption } from '@/hooks/useByokModelAvailability';
import { MAX_COMPARE_MODELS, MIN_COMPARE_MODELS } from '@/hooks/useCompareRun';
import { ModelCombobox } from '@/components/ModelCombobox';
import { Button } from '@/components/ui/button';

/** One picker slot. The id is stable for the slot's lifetime, independent of its position. */
export interface CompareSlot {
  id: string;
  model: string;
}

export const createCompareSlot = (model: string): CompareSlot => ({
  id: crypto.randomUUID(),
  model,
});

interface ComparePickersProps {
  /** Models the user can run right now. */
  runnableModels: readonly ModelOption[];
  slots: readonly CompareSlot[];
  findModel: (name: string) => ModelOption | undefined;
  onChange: (slots: CompareSlot[]) => void;
  disabled?: boolean;
}

const ComparePickers = ({
  runnableModels,
  slots,
  findModel,
  onChange,
  disabled,
}: ComparePickersProps) => {
  // The default slots appear with the page; only slots the user adds later animate in.
  const initialSlotIds = useRef<Set<string> | null>(null);
  if (initialSlotIds.current === null && slots.length > 0) {
    initialSlotIds.current = new Set(slots.map(({ id }) => id));
  }
  const selectedModels = slots.map(({ model }) => model);
  const nextUnused = runnableModels.find(({ name }) => !selectedModels.includes(name));
  const canAdd = slots.length < MAX_COMPARE_MODELS && Boolean(nextUnused);
  const canRemove = slots.length > MIN_COMPARE_MODELS;

  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="sr-only">Models to compare</legend>
      <ul className="flex min-w-0 items-start gap-1.5 overflow-x-auto overscroll-x-contain p-0.5 [scrollbar-width:none] sm:flex-wrap sm:gap-2 sm:overflow-visible">
        {slots.map((slot) => {
          // Models picked in other slots stay visible but disabled, so a slot cannot duplicate them.
          const otherModels = new Set(
            slots.filter(({ id }) => id !== slot.id).map(({ model }) => model)
          );
          const current = findModel(slot.model);
          const isUnavailable = !runnableModels.some(({ name }) => name === slot.model);
          const options = [
            ...(isUnavailable && current ? [{ ...current, disabled: true }] : []),
            ...runnableModels.map((model) =>
              otherModels.has(model.name) ? { ...model, disabled: true } : model
            ),
          ];

          return (
            <li
              key={slot.id}
              className={cn(
                'flex w-48 min-w-0 shrink-0 items-start gap-1 sm:w-60',
                initialSlotIds.current &&
                  !initialSlotIds.current.has(slot.id) &&
                  'duration-150 ease-[var(--ease-out)] animate-in fade-in-0 motion-safe:zoom-in-95'
              )}>
              <div className="min-w-0 flex-1">
                <ModelCombobox
                  models={options}
                  value={slot.model}
                  disabled={disabled}
                  placeholder="Choose a model"
                  // The trigger shows the model name only; the option list keeps the Thinking hint.
                  className={cn(
                    'h-9 w-full rounded-full text-left text-sm [&>span>span>span]:line-clamp-1 [&>span>span>span:has(>svg)]:hidden',
                    isUnavailable && 'border-destructive/60'
                  )}
                  onValueChange={(nextModel) => {
                    if (!nextModel || otherModels.has(nextModel)) return;
                    onChange(
                      slots.map((item) =>
                        item.id === slot.id ? { ...item, model: nextModel } : item
                      )
                    );
                  }}
                />
                {isUnavailable && (
                  <p className="mt-1 px-2 text-xs text-destructive">
                    Unavailable. Pick another model.
                  </p>
                )}
              </div>
              {canRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${current?.text ?? slot.model} from comparison`}
                  onClick={() => onChange(slots.filter(({ id }) => id !== slot.id))}>
                  <XIcon className="size-4" />
                </Button>
              )}
            </li>
          );
        })}
        {slots.length < MAX_COMPARE_MODELS && (
          <li className="shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-full border-dashed px-3 text-muted-foreground"
              disabled={!canAdd}
              title={canAdd ? undefined : 'No other available models'}
              onClick={() =>
                nextUnused && onChange([...slots, createCompareSlot(nextUnused.name)])
              }>
              <PlusIcon />
              Add model
            </Button>
          </li>
        )}
      </ul>
    </fieldset>
  );
};

export default ComparePickers;
