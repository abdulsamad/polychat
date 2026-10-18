import { RotateCcwIcon, Trash2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { DangerAction } from '@/components/AppSidebar/UserSettings/shared';

interface DangerZoneSectionProps {
  isPending: boolean;
  onRequestAction: (action: DangerAction) => void;
}

const DangerZoneSection = ({ isPending, onRequestAction }: DangerZoneSectionProps) => (
  <section className="rounded-xl border border-destructive/25 bg-destructive/[0.035] p-4">
    <div className="mb-4 flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <Trash2Icon className="size-4" />
      </span>
      <div>
        <h2 className="text-sm font-semibold">Danger zone</h2>
        <p className="text-xs text-muted-foreground">
          Remove local data from this browser. These actions cannot be undone.
        </p>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="destructive"
        disabled={isPending}
        onClick={() => onRequestAction('delete-chats')}>
        <Trash2Icon className="mr-2 size-4" />
        Delete all chats
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => onRequestAction('reset-data')}>
        <RotateCcwIcon className="mr-2 size-4" />
        Purge Everything
      </Button>
    </div>
  </section>
);

export default DangerZoneSection;
