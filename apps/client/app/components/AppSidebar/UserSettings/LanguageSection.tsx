import { useAtom } from 'jotai';
import { LanguagesIcon } from 'lucide-react';
import { toast } from 'sonner';

import { languages } from 'utils';

import { configAtom } from '@/store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LanguageSection = () => {
  const [config, setConfig] = useAtom(configAtom);

  return (
    <section className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <LanguagesIcon className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Language</h2>
          <p className="text-xs text-muted-foreground">Set the language used in responses.</p>
        </div>
      </div>
      <Select
        value={config.language}
        onValueChange={(language) => {
          setConfig({ ...config, language: language as typeof config.language });
          toast.success('Settings updated');
        }}>
        <SelectTrigger className="bg-background/70">
          <SelectValue placeholder="Language" />
        </SelectTrigger>
        <SelectContent>
          {languages.map(({ code, text }) => (
            <SelectItem key={code} value={code}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </section>
  );
};

export default LanguageSection;
