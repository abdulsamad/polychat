import { useEffect, useRef, useState } from 'react';
import { PlusIcon, XIcon } from 'lucide-react';
import { useReducedMotion } from 'motion/react';

import { cn } from '@/utils';
import { configurationKey, describeSettings } from '@/utils/compare-settings';
import type { CompareSlotSettings } from '@/utils/lforage';
import type { ModelOption } from '@/hooks/useByokModelAvailability';
import { MAX_COMPARE_MODELS, MIN_COMPARE_MODELS } from '@/hooks/useCompareRun';
import { ModelCombobox } from '@/components/ModelCombobox';
import SlotSettingsPopover, { MAX_SAMPLES } from '@/components/Compare/SlotSettingsPopover';
import { Button } from '@/components/ui/button';

/** One picker slot. The id is stable for the slot's lifetime, independent of its position. */
export interface CompareSlot {
  id: string;
  model: string;
  settings?: CompareSlotSettings;
  /** How many columns this configuration fills (1-3). */
  samples?: number;
}

export const createCompareSlot = (
  model: string,
  extra: Pick<CompareSlot, 'settings' | 'samples'> = {}
): CompareSlot => ({
  id: crypto.randomUUID(),
  model,
  ...extra,
});

/** Columns the slots will produce; this is what the four-column limit applies to. */
export const countSlotColumns = (slots: readonly CompareSlot[]) =>
  slots.reduce((total, { samples }) => total + (samples ?? 1), 0);

/** Slots that would produce identical columns; sampling is the way to repeat a configuration. */
export const findDuplicateSlotIds = (slots: readonly CompareSlot[]) => {
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();
  for (const { id, model, settings } of slots) {
    const key = configurationKey(model, settings);
    const firstId = seen.get(key);
    if (firstId) {
      duplicates.add(firstId);
      duplicates.add(id);
    } else {
      seen.set(key, id);
    }
  }
  return duplicates;
};

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
  // A slot added with the Add button opens its picker and scrolls into view.
  const [addedSlotId, setAddedSlotId] = useState<string | null>(null);
  const addedSlotRef = useRef<HTMLLIElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!addedSlotId) return;
    addedSlotRef.current?.scrollIntoView({
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
    // Cleared once used, so a later remount of that picker does not open it again.
    setAddedSlotId(null);
  }, [addedSlotId, shouldReduceMotion]);
  const totalColumns = countSlotColumns(slots);
  const selectedModels = slots.map(({ model }) => model);
  // Prefer a model that is not in use yet; the same model may still be added again to compare
  // it under different settings.
  const nextModel =
    runnableModels.find(({ name }) => !selectedModels.includes(name)) ?? runnableModels[0];
  const canAdd = totalColumns < MAX_COMPARE_MODELS && Boolean(nextModel);
  const duplicateIds = findDuplicateSlotIds(slots);
  const updateSlot = (slotId: string, patch: Partial<CompareSlot>) =>
    onChange(slots.map((item) => (item.id === slotId ? { ...item, ...patch } : item)));

  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="sr-only">Models to compare</legend>
      <ul className="flex min-w-0 items-start gap-1.5 overflow-x-auto overscroll-x-contain p-0.5 [scrollbar-width:none] sm:flex-wrap sm:gap-2 sm:overflow-visible">
        {slots.map((slot) => {
          const current = findModel(slot.model);
          const samples = slot.samples ?? 1;
          const isUnavailable = !runnableModels.some(({ name }) => name === slot.model);
          const isDuplicate = duplicateIds.has(slot.id);
          const options = [
            ...(isUnavailable && current ? [{ ...current, disabled: true }] : []),
            ...runnableModels,
          ];
          const variant = [describeSettings(slot.settings), samples > 1 && `x${samples}`]
            .filter(Boolean)
            .join(' - ');
          const label = current?.text ?? slot.model;
          // Removing must leave at least two columns to compare.
          const canRemove = slots.length > 1 && totalColumns - samples >= MIN_COMPARE_MODELS;

          return (
            <li
              key={slot.id}
              ref={slot.id === addedSlotId ? addedSlotRef : undefined}
              className={cn(
                'flex w-56 min-w-0 shrink-0 items-start gap-0.5 sm:w-64',
                initialSlotIds.current &&
                  !initialSlotIds.current.has(slot.id) &&
                  'duration-150 ease-[var(--ease-out)] animate-in fade-in-0 motion-safe:zoom-in-95'
              )}>
              <div className="min-w-0 flex-1">
                <ModelCombobox
                  models={options}
                  value={slot.model}
                  disabled={disabled}
                  defaultOpen={slot.id === addedSlotId}
                  placeholder="Choose a model"
                  className={cn(
                    'h-9 w-full rounded-full text-left text-sm',
                    (isUnavailable || isDuplicate) && 'border-destructive/60'
                  )}
                  onValueChange={(nextModelName) => {
                    if (nextModelName) updateSlot(slot.id, { model: nextModelName });
                  }}
                />
                {isUnavailable ? (
                  <p className="mt-1 px-2 text-xs text-destructive">
                    Unavailable. Pick another model.
                  </p>
                ) : isDuplicate ? (
                  <p className="mt-1 px-2 text-xs text-destructive">
                    Same as another slot. Change a setting, or use samples.
                  </p>
                ) : (
                  variant && (
                    <p className="mt-1 truncate px-2 text-[0.6875rem] text-primary duration-150 ease-[var(--ease-out)] animate-in fade-in-0">
                      {variant}
                    </p>
                  )
                )}
              </div>
              <SlotSettingsPopover
                label={label}
                settings={slot.settings}
                samples={samples}
                maxSamples={Math.min(MAX_SAMPLES, MAX_COMPARE_MODELS - (totalColumns - samples))}
                disabled={disabled}
                onChange={({ settings, samples: nextSamples }) =>
                  updateSlot(slot.id, { settings, samples: nextSamples })
                }
              />
              {canRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${label} from comparison`}
                  onClick={() => onChange(slots.filter(({ id }) => id !== slot.id))}>
                  <XIcon className="size-4" />
                </Button>
              )}
            </li>
          );
        })}
        {totalColumns < MAX_COMPARE_MODELS && (
          <li className="shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-full border-dashed px-3 text-muted-foreground"
              disabled={!canAdd}
              title={canAdd ? undefined : 'No available models'}
              onClick={() => {
                if (!nextModel) return;
                const slot = createCompareSlot(nextModel.name);
                setAddedSlotId(slot.id);
                onChange([...slots, slot]);
              }}>
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
