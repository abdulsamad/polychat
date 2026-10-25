import { useEffect, useMemo, useRef, useState } from 'react';
import { PlusIcon, XIcon } from 'lucide-react';
import { useReducedMotion } from 'motion/react';

import { cn } from '@/utils';
import { configurationKey, describeSettings, normalizeSettings } from '@/utils/compare-settings';
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
const findDuplicateSlotIds = (slots: readonly CompareSlot[]) => {
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

/** The output type of a run: its first slot's model type, text until a slot is picked. */
export const getSlotsOutputType = (
  slots: readonly CompareSlot[],
  findModel: (name: string) => ModelOption | undefined
): ModelOption['type'] => (slots[0] && findModel(slots[0].model)?.type) || 'text';

/** Slots whose model type differs from the run's; votes only compare like with like. */
const findMismatchedSlotIds = (
  slots: readonly CompareSlot[],
  findModel: (name: string) => ModelOption | undefined
) => {
  const outputType = getSlotsOutputType(slots, findModel);
  return new Set(
    slots
      .filter(({ model }) => {
        const type = findModel(model)?.type;
        return type !== undefined && type !== outputType;
      })
      .map(({ id }) => id)
  );
};

const outputTypeNouns: Record<ModelOption['type'], string> = {
  text: 'chat',
  image: 'image',
  video: 'video',
};

/** What blocks the slots from running, and how to fix it. */
export interface SlotProblem {
  kind: 'unavailable' | 'mismatch' | 'duplicate';
  title: string;
  hint: string;
}

/**
 * The first problem that blocks a run, in the order to fix them. The pickers only flag the
 * affected slots with a border, so this is the one place that explains what is wrong.
 */
export const findSlotProblem = (
  slots: readonly CompareSlot[],
  runnableModels: readonly ModelOption[],
  findModel: (name: string) => ModelOption | undefined
): SlotProblem | undefined => {
  const unavailable = slots.filter(
    ({ model }) => !runnableModels.some(({ name }) => name === model)
  );
  if (unavailable.length > 0) {
    const [{ model }] = unavailable;
    return unavailable.length === 1
      ? {
          kind: 'unavailable',
          title: `${findModel(model)?.text ?? model} isn't available.`,
          hint: 'Pick another model.',
        }
      : {
          kind: 'unavailable',
          title: `${unavailable.length} models aren't available.`,
          hint: 'Pick other models.',
        };
  }
  // Every slot now holds a known model, so a run mixes types exactly when it names several.
  const types = new Set(slots.map(({ model }) => findModel(model)?.type));
  const nouns = (['text', 'image', 'video'] as const)
    .filter((type) => types.has(type))
    .map((type) => outputTypeNouns[type]);
  if (nouns.length > 1) {
    return {
      kind: 'mismatch',
      title: `Can't mix ${nouns.slice(0, -1).join(', ')} and ${nouns.at(-1)} models.`,
      hint: 'Pick one type.',
    };
  }
  const duplicates = findDuplicateSlotIds(slots);
  if (duplicates.size > 0) {
    return {
      kind: 'duplicate',
      title: duplicates.size === 2 ? 'Two slots are identical.' : 'Some slots are identical.',
      hint: 'Change a setting, or use samples.',
    };
  }
  return undefined;
};

interface ComparePickersProps {
  /** Every model, as chat lists them; the ones that cannot run now are shown disabled. */
  models: readonly ModelOption[];
  /** Models the user can run right now. */
  runnableModels: readonly ModelOption[];
  slots: readonly CompareSlot[];
  findModel: (name: string) => ModelOption | undefined;
  onChange: (slots: CompareSlot[]) => void;
  /** Opens the BYOK key settings from the picker's unlock hints. */
  onAddProviderKey?: () => void;
  disabled?: boolean;
}

const ComparePickers = ({
  models,
  runnableModels,
  slots,
  findModel,
  onChange,
  onAddProviderKey,
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
  // The same list as the chat picker; models that cannot run here stay visible but locked.
  const options = useMemo(() => {
    const runnable = new Set(runnableModels.map(({ name }) => name));
    return models.map((model) =>
      runnable.has(model.name) || model.disabled ? model : { ...model, disabled: true }
    );
  }, [models, runnableModels]);
  const totalColumns = countSlotColumns(slots);
  const selectedModels = slots.map(({ model }) => model);
  const outputType = getSlotsOutputType(slots, findModel);
  // Prefer a model of the run's type that is not in use yet; the same model may still be
  // added again to compare it under different settings.
  const sameTypeModels = runnableModels.filter(({ type }) => type === outputType);
  const nextModel =
    sameTypeModels.find(({ name }) => !selectedModels.includes(name)) ?? sameTypeModels[0];
  const canAdd = totalColumns < MAX_COMPARE_MODELS && Boolean(nextModel);
  const duplicateIds = findDuplicateSlotIds(slots);
  const mismatchedIds = findMismatchedSlotIds(slots, findModel);
  const updateSlot = (slotId: string, patch: Partial<CompareSlot>) =>
    onChange(slots.map((item) => (item.id === slotId ? { ...item, ...patch } : item)));

  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="sr-only">Models to compare</legend>
      <ul className="flex min-w-0 items-start gap-1.5 overflow-x-auto overscroll-x-contain p-0.5 [scrollbar-width:none] sm:flex-wrap sm:gap-2 sm:overflow-visible">
        {slots.map((slot) => {
          const current = findModel(slot.model);
          const samples = slot.samples ?? 1;
          // Flagged by its border only; the banner above the composer says what to fix.
          const isFlagged =
            !runnableModels.some(({ name }) => name === slot.model) ||
            mismatchedIds.has(slot.id) ||
            duplicateIds.has(slot.id);
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
                    isFlagged && 'border-destructive/60'
                  )}
                  onAddProviderKey={onAddProviderKey}
                  onValueChange={(nextModelName) => {
                    if (!nextModelName) return;
                    // Settings the new model does not offer (or of another type) are dropped.
                    updateSlot(slot.id, {
                      model: nextModelName,
                      settings: normalizeSettings(slot.settings, findModel(nextModelName)),
                    });
                  }}
                />
                {variant && (
                  <p className="mt-1 truncate px-2 text-[0.6875rem] text-primary duration-150 ease-[var(--ease-out)] animate-in fade-in-0">
                    {variant}
                  </p>
                )}
              </div>
              <SlotSettingsPopover
                label={label}
                model={current}
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
