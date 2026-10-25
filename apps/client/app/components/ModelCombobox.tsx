import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  BrainCircuit,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Clapperboard,
  Eye,
  Film,
  ImageIcon,
  ImagePlus,
  KeyRound,
  LayoutGrid,
  MessageSquare,
  Paperclip,
  type LucideIcon,
} from 'lucide-react';

import { modelProviderLabels, modelProviders } from 'utils';

import { cn } from '@/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ModelOption } from '@/hooks/useByokModelAvailability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ModelComboboxProps {
  models: readonly ModelOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  // Opens the picker on mount, for a slot the user just added.
  defaultOpen?: boolean;
  // Opens the BYOK key settings; enables the unlock hints for locked and empty categories.
  onAddProviderKey?: () => void;
}

type ModelTab = 'all' | ModelOption['type'];

interface ModelTabOption {
  id: ModelTab;
  label: string;
  noun: string;
  icon: LucideIcon;
}

const modelTabs: readonly ModelTabOption[] = [
  { id: 'all', label: 'All', noun: 'models', icon: LayoutGrid },
  { id: 'text', label: 'Chat', noun: 'chat models', icon: MessageSquare },
  { id: 'image', label: 'Image', noun: 'image models', icon: ImageIcon },
  { id: 'video', label: 'Video', noun: 'video models', icon: Clapperboard },
];

const metaBadgeClassName = 'shrink-0 px-1.5 py-0 text-[10px] font-medium text-muted-foreground';

const getOpenRouterParts = (text: string) => {
  const separator = text.indexOf(':');
  if (separator === -1) return { provider: 'OpenRouter', name: text };
  return { provider: text.slice(0, separator).trim(), name: text.slice(separator + 1).trim() };
};

const getDisplayName = (model: ModelOption) =>
  model.provider === 'openrouter' ? getOpenRouterParts(model.text).name : model.text;

// Input abilities, so a multimodal model reads as one in every tab. Image and video models
// take image input as references, which their discovery also reports as vision.
const getCapabilities = (model: ModelOption) =>
  [
    model.supportsReasoning && { label: 'Thinking', icon: BrainCircuit },
    model.type === 'text' && model.supportsVision && { label: 'Reads images', icon: Eye },
    model.supportsFiles && { label: 'Reads files', icon: Paperclip },
    model.type !== 'text' &&
      model.supportsImageReferences && { label: 'Image references', icon: ImagePlus },
    model.supportsVideoReferences && { label: 'Video references', icon: Film },
  ].filter((capability): capability is { label: string; icon: LucideIcon } => Boolean(capability));

const getGroups = (models: readonly ModelOption[]) =>
  modelProviders.flatMap((provider) => {
    const providerModels = models.filter((model) => model.provider === provider);
    if (!providerModels.length) return [];

    if (provider !== 'openrouter') {
      return [{ label: modelProviderLabels[provider], models: providerModels }];
    }

    const nested = new Map<string, ModelOption[]>();
    providerModels.forEach((model) => {
      const nestedProvider = getOpenRouterParts(model.text).provider;
      nested.set(nestedProvider, [...(nested.get(nestedProvider) || []), model]);
    });

    return [...nested.entries()].map(([nestedProvider, nestedModels]) => ({
      label: `${modelProviderLabels[provider]} - ${nestedProvider}`,
      models: nestedModels,
    }));
  });

const ModelRow = ({ model, showType }: { model: ModelOption; showType: boolean }) => {
  const capabilities = getCapabilities(model);
  const capabilityLabel = capabilities.map(({ label }) => label).join(', ');
  const typeLabel =
    showType && model.type !== 'text'
      ? modelTabs.find(({ id }) => id === model.type)?.label
      : undefined;

  return (
    <span className="flex w-full min-w-0 max-w-full items-center gap-2">
      <span className="min-w-0 flex-1 line-clamp-2 whitespace-normal break-words leading-snug">
        {getDisplayName(model)}
      </span>
      {capabilities.length > 0 && (
        <>
          <span
            aria-hidden="true"
            title={capabilityLabel}
            className="flex shrink-0 items-center gap-1 text-muted-foreground">
            {capabilities.map(({ label, icon: Icon }) => (
              <Icon key={label} className="size-3.5!" />
            ))}
          </span>
          <span className="sr-only">{capabilityLabel}</span>
        </>
      )}
      {typeLabel && (
        <Badge variant="outline" className={metaBadgeClassName}>
          {typeLabel}
        </Badge>
      )}
      {model.isDiscovered && (
        <Badge variant="outline" className={metaBadgeClassName}>
          BYOK
        </Badge>
      )}
      {model.isSpecial && <Badge variant="outline">Special</Badge>}
      {model.isExperimental && <Badge variant="outline">Experimental</Badge>}
    </span>
  );
};

const ModelOptionContent = ({
  models,
  onSelect,
  selectedValue,
  command = false,
  showType = false,
}: {
  models: readonly ModelOption[];
  onSelect?: (value: string) => void;
  selectedValue?: string;
  command?: boolean;
  showType?: boolean;
}) =>
  getGroups(models).map(({ label, models: groupedModels }) =>
    command ? (
      <CommandGroup
        key={label}
        heading={label}
        className="[&_[cmdk-group-heading]]:mx-1 [&_[cmdk-group-heading]]:max-w-[calc(100vw-2rem)] [&_[cmdk-group-heading]]:truncate [&_[cmdk-group-heading]]:rounded-md [&_[cmdk-group-heading]]:bg-muted/60 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-foreground">
        {groupedModels.map((model) => (
          <CommandItem
            key={model.name}
            value={`${label} ${model.text}`}
            disabled={model.disabled}
            className="min-w-0"
            onSelect={() => onSelect?.(model.name)}>
            <Check className={cn('opacity-0', model.name === selectedValue && 'opacity-100')} />
            <ModelRow model={model} showType={showType} />
          </CommandItem>
        ))}
      </CommandGroup>
    ) : (
      <SelectGroup key={label}>
        <SelectLabel className="mx-1 my-1 block max-w-[calc(100vw-2rem)] truncate rounded-md bg-muted/60 px-2 py-1.5 text-xs font-semibold text-foreground">
          {label}
        </SelectLabel>
        {groupedModels.map((model) => (
          <SelectItem
            key={model.name}
            value={model.name}
            disabled={model.disabled}
            className="min-w-0">
            <ModelRow model={model} showType={showType} />
          </SelectItem>
        ))}
      </SelectGroup>
    )
  );

const ModelTypeTabs = ({
  value,
  onValueChange,
  idPrefix,
}: {
  value: ModelTab;
  onValueChange: (tab: ModelTab) => void;
  idPrefix: string;
}) => {
  const tabRefs = useRef<Partial<Record<ModelTab, HTMLButtonElement | null>>>({});
  const selectedIndex = modelTabs.findIndex(({ id }) => id === value);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // cmdk drives its list from Enter, Home, and End on the root; keys pressed on a tab stay here.
    event.stopPropagation();
    const nextIndex = (
      {
        ArrowLeft: selectedIndex - 1,
        ArrowRight: selectedIndex + 1,
        Home: 0,
        End: modelTabs.length - 1,
      } as Partial<Record<string, number>>
    )[event.key];
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextTab = modelTabs[(nextIndex + modelTabs.length) % modelTabs.length];
    onValueChange(nextTab.id);
    tabRefs.current[nextTab.id]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Model type"
      className="relative grid grid-cols-4 rounded-full bg-muted p-0.5"
      onKeyDown={handleKeyDown}>
      {/* Equal segments let the thumb slide by its own width, like a native segmented control. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 w-[calc((100%-0.25rem)/4)] rounded-full bg-background shadow-sm transition-transform duration-200 ease-[var(--ease-out)] motion-reduce:transition-none dark:bg-accent"
        style={{ transform: `translateX(${selectedIndex * 100}%)` }}
      />
      {modelTabs.map(({ id, label }) => {
        const isSelected = id === value;
        return (
          <Button
            key={id}
            ref={(element) => {
              tabRefs.current[id] = element;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${id}`}
            aria-selected={isSelected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={isSelected ? 0 : -1}
            variant="ghost"
            size="sm"
            className={cn(
              'relative h-7 rounded-full px-2 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground pointer-coarse:h-9',
              isSelected && 'text-foreground dark:text-accent-foreground'
            )}
            onClick={() => onValueChange(id)}>
            {label}
          </Button>
        );
      })}
    </div>
  );
};

const EmptyModelTab = ({
  tab,
  onAddProviderKey,
}: {
  tab: ModelTabOption;
  onAddProviderKey?: () => void;
}) => {
  const Icon = tab.icon;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="grid gap-1">
        <p className="text-sm font-medium">No {tab.noun} yet</p>
        {onAddProviderKey && (
          <p className="text-balance text-xs text-muted-foreground">
            Add your own provider key to unlock {tab.noun}.
          </p>
        )}
      </div>
      {onAddProviderKey && (
        <Button type="button" size="sm" className="rounded-full" onClick={onAddProviderKey}>
          <KeyRound />
          Add API key
        </Button>
      )}
    </div>
  );
};

const ModelPickerPanel = ({
  models,
  value,
  showTabs,
  onSelect,
  onAddProviderKey,
  className,
  listClassName,
}: {
  models: readonly ModelOption[];
  value: string;
  showTabs: boolean;
  onSelect: (value: string) => void;
  onAddProviderKey?: () => void;
  className?: string;
  listClassName?: string;
}) => {
  // Mounted with the popover or sheet, so every open starts on All with an empty search.
  const [tab, setTab] = useState<ModelTab>('all');
  const idPrefix = useId();
  const activeTab = modelTabs.find(({ id }) => id === tab) ?? modelTabs[0];
  const tabModels = tab === 'all' ? models : models.filter(({ type }) => type === tab);
  const lockedCount = tabModels.filter(({ disabled }) => disabled).length;

  return (
    <Command className={cn('min-h-0 min-w-0 flex-1', className)}>
      <CommandInput className="min-w-0" placeholder={`Search ${activeTab.noun}...`} />
      {showTabs && (
        <div className="border-b px-2 py-2">
          <ModelTypeTabs value={tab} onValueChange={setTab} idPrefix={idPrefix} />
        </div>
      )}
      <div
        id={`${idPrefix}-panel`}
        role={showTabs ? 'tabpanel' : undefined}
        aria-labelledby={showTabs ? `${idPrefix}-tab-${tab}` : undefined}
        className="flex min-h-0 min-w-0 flex-1 flex-col">
        {tabModels.length > 0 ? (
          <CommandList
            className={cn(
              'min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y',
              listClassName
            )}
            onTouchMoveCapture={(event) => event.stopPropagation()}
            onWheelCapture={(event) => event.stopPropagation()}>
            <CommandEmpty>No {activeTab.noun} found.</CommandEmpty>
            <ModelOptionContent
              models={tabModels}
              command
              showType={showTabs && tab === 'all'}
              selectedValue={value}
              onSelect={onSelect}
            />
          </CommandList>
        ) : (
          <EmptyModelTab tab={activeTab} onAddProviderKey={onAddProviderKey} />
        )}
      </div>
      {onAddProviderKey && lockedCount > 0 && (
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full shrink-0 justify-start gap-2 rounded-none border-t bg-primary/[0.04] px-3 py-2.5 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary active:scale-100"
          onClick={onAddProviderKey}>
          <KeyRound />
          <span className="min-w-0 flex-1 truncate text-left">
            Unlock {lockedCount} more {lockedCount === 1 ? 'model' : 'models'} with your own key
          </span>
          <ChevronRight className="opacity-70" />
        </Button>
      )}
    </Command>
  );
};

export const ModelCombobox = ({
  models,
  value,
  onValueChange,
  placeholder = 'Model',
  disabled,
  className,
  defaultOpen = false,
  onAddProviderKey,
}: ModelComboboxProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const [isNestedSheet, setIsNestedSheet] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();

  // On top of another vaul drawer (Settings on phones), closing this sheet must leave the
  // parent's iOS body lock in place. Checked on every open, including one on mount.
  useLayoutEffect(() => {
    if (open) setIsNestedSheet(Boolean(triggerRef.current?.closest('[data-vaul-drawer]')));
  }, [open]);
  // Tabs only help when the list mixes chat, image, and video models.
  const showTabs = new Set(models.map(({ type }) => type)).size > 1;
  const selectedModel = models.find((model) => model.name === value);

  if (!showTabs && models.length <= 10) {
    return (
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        defaultOpen={defaultOpen}>
        <SelectTrigger className={cn('min-w-0', className)}>
          {/* The trigger shows the model name only; the options keep the capability hints. */}
          <SelectValue placeholder={placeholder}>
            {selectedModel && getDisplayName(selectedModel)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="w-[--radix-select-trigger-width] max-w-[calc(100vw-1rem)] min-w-0">
          <ModelOptionContent models={models} />
        </SelectContent>
      </Select>
    );
  }

  const selectModel = (nextValue: string) => {
    onValueChange(nextValue);
    setOpen(false);
  };
  const addProviderKey =
    onAddProviderKey &&
    (() => {
      setOpen(false);
      onAddProviderKey();
    });
  const trigger = (
    <Button
      ref={triggerRef}
      variant="outline"
      role="combobox"
      disabled={disabled}
      className={cn('w-full justify-between font-normal', className)}>
      <span className="truncate">{selectedModel ? getDisplayName(selectedModel) : placeholder}</span>
      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={setOpen}
        nested={isNestedSheet}
        shouldScaleBackground={false}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent
          data-model-combobox-popover
          className="h-[min(85dvh,40rem)] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <DrawerHeader className="px-4 pb-2 pt-3 text-left">
            <DrawerTitle className="text-base">Choose a model</DrawerTitle>
            <DrawerDescription className="sr-only">
              Search models, or filter them by what they create.
            </DrawerDescription>
          </DrawerHeader>
          <ModelPickerPanel
            models={models}
            value={value}
            showTabs={showTabs}
            onSelect={selectModel}
            onAddProviderKey={addProviderKey}
            // A rounded search field and taller rows suit touch, like a native sheet.
            className="bg-background [&_[cmdk-input-wrapper]]:mx-2 [&_[cmdk-input-wrapper]]:rounded-xl [&_[cmdk-input-wrapper]]:border-b-0 [&_[cmdk-input-wrapper]]:bg-muted [&_[cmdk-item]]:py-2.5"
            listClassName="max-h-none"
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className={cn(
          'z-[60] box-border flex w-[--radix-popover-trigger-width] max-w-[calc(100vw-1rem)] min-w-0 flex-col overflow-hidden p-0',
          // A fixed height keeps the popover still while switching tabs.
          showTabs
            ? 'h-[min(70dvh,32rem,var(--radix-popover-content-available-height))] min-w-72'
            : 'max-h-[min(70dvh,32rem,var(--radix-popover-content-available-height))]'
        )}
        data-vaul-no-drag
        data-model-combobox-popover
        align="start">
        <ModelPickerPanel
          models={models}
          value={value}
          showTabs={showTabs}
          onSelect={selectModel}
          onAddProviderKey={addProviderKey}
          className={showTabs ? '[&_[cmdk-input-wrapper]]:border-b-0' : undefined}
          listClassName={
            showTabs
              ? 'max-h-none'
              : 'max-h-[min(70dvh,32rem,var(--radix-popover-content-available-height))]'
          }
        />
      </PopoverContent>
    </Popover>
  );
};
