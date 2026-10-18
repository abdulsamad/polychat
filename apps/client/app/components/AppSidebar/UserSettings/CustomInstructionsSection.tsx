import type { RefObject } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { SlidersHorizontalIcon } from 'lucide-react';
import { toast } from 'sonner';

import { configAtom, threadAtom, updateThreadSettingsAtom } from '@/store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface CustomInstructionsSectionProps {
  sectionRef: RefObject<HTMLElement | null>;
  customInstructions: string;
  setCustomInstructionsDraft: (value: string) => void;
}

const CustomInstructionsSection = ({
  sectionRef,
  customInstructions,
  setCustomInstructionsDraft,
}: CustomInstructionsSectionProps) => {
  const [config, setConfig] = useAtom(configAtom);
  const activeThread = useAtomValue(threadAtom);
  const updateActiveThreadSettings = useSetAtom(updateThreadSettingsAtom);

  return (
    <section
      ref={sectionRef}
      className="rounded-xl border border-primary/20 bg-primary/[0.035] p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SlidersHorizontalIcon className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Custom instructions</h2>
          <p className="text-xs text-muted-foreground">
            Saved only in this browser. They are sent to the provider when the Custom profile is
            selected.
          </p>
        </div>
      </div>
      <Textarea
        value={customInstructions}
        maxLength={4000}
        onChange={(event) => setCustomInstructionsDraft(event.target.value)}
        placeholder="For example: Keep answers concise and use metric units."
        className="min-h-28 resize-y bg-background/70"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {customInstructions.length}/4000 characters
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={!customInstructions}
            onClick={() => {
              setCustomInstructionsDraft('');
              setConfig({ ...config, customInstructions: '' });
              if (activeThread?.settings.profile === 'custom') {
                updateActiveThreadSettings({ profile: 'normal' });
              }
            }}>
            Clear
          </Button>
          <Button
            type="button"
            onClick={() => {
              setConfig({ ...config, customInstructions: customInstructions.trim() });
              toast.success('Custom instructions saved');
            }}>
            Save instructions
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CustomInstructionsSection;
