import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const AppearanceSection = () => {
  const { theme, setTheme } = useTheme();

  return (
    <section className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {theme === 'dark' ? <MoonIcon className="size-4" /> : <SunIcon className="size-4" />}
        </span>
        <div>
          <h2 className="text-sm font-semibold">Appearance</h2>
          <p className="text-xs text-muted-foreground">Choose the look that feels right.</p>
        </div>
      </div>

      <Select
        value={theme ?? 'system'}
        onValueChange={(value) => {
          setTheme(value);
          toast.success('Settings updated');
        }}>
        <SelectTrigger className="bg-background/70">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
          <SelectItem value="system">System</SelectItem>
        </SelectContent>
      </Select>
    </section>
  );
};

export default AppearanceSection;
