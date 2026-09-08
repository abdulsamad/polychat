import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { modelProviderLabels, modelProviders } from 'utils';

import { cn } from '@/utils';
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
}

const getOpenRouterParts = (text: string) => {
  const separator = text.indexOf(':');
  if (separator === -1) return { provider: 'OpenRouter', name: text };
  return { provider: text.slice(0, separator).trim(), name: text.slice(separator + 1).trim() };
};

const getDisplayName = (model: ModelOption) =>
  model.provider === 'openrouter' ? getOpenRouterParts(model.text).name : model.text;

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

const ModelOptionContent = ({
  models,
  onSelect,
  selectedValue,
  command = false,
}: {
  models: readonly ModelOption[];
  onSelect?: (value: string) => void;
  selectedValue?: string;
  command?: boolean;
}) =>
  getGroups(models).map(({ label, models: groupedModels }) =>
    command ? (
      <CommandGroup
        key={label}
        heading={label}
        className="[&_[cmdk-group-heading]]:mx-1 [&_[cmdk-group-heading]]:rounded-md [&_[cmdk-group-heading]]:bg-muted/60 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-foreground">
        {groupedModels.map((model) => (
          <CommandItem
            key={model.name}
            value={`${label} ${model.text}`}
            disabled={model.disabled}
            onSelect={() => onSelect?.(model.name)}>
            <Check className={cn('opacity-0', model.name === selectedValue && 'opacity-100')} />
            <span className="min-w-0 truncate">{getDisplayName(model)}</span>
            {model.isSpecial && <Badge variant="outline">Special</Badge>}
            {model.isExperimental && <Badge variant="outline">Experimental</Badge>}
          </CommandItem>
        ))}
      </CommandGroup>
    ) : (
      <SelectGroup key={label}>
        <SelectLabel className="mx-1 my-1 rounded-md bg-muted/60 px-2 py-1.5 text-xs font-semibold text-foreground">
          {label}
        </SelectLabel>
        {groupedModels.map((model) => (
          <SelectItem key={model.name} value={model.name} disabled={model.disabled}>
            <span className="flex items-center gap-2">
              {getDisplayName(model)}
              {model.isSpecial && <Badge variant="outline">Special</Badge>}
              {model.isExperimental && <Badge variant="outline">Experimental</Badge>}
            </span>
          </SelectItem>
        ))}
      </SelectGroup>
    )
  );

export const ModelCombobox = ({
  models,
  value,
  onValueChange,
  placeholder = 'Model',
  disabled,
  className,
}: ModelComboboxProps) => {
  const [open, setOpen] = useState(false);
  const searchable = models.length > 10;

  if (!searchable) {
    return (
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <ModelOptionContent models={models} />
        </SelectContent>
      </Select>
    );
  }

  const selectedModel = models.find((model) => model.name === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}>
          <span className="truncate">
            {selectedModel ? getDisplayName(selectedModel) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search models..." />
          <CommandList>
            <CommandEmpty>No models found.</CommandEmpty>
            <ModelOptionContent
              models={models}
              command
              selectedValue={value}
              onSelect={(nextValue) => {
                onValueChange(nextValue);
                setOpen(false);
              }}
            />
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
