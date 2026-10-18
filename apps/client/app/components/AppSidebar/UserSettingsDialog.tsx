import { useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { SlidersHorizontalIcon } from 'lucide-react';
import { useUser } from '@clerk/react-router';

import { userSettingsScrollTargetAtom } from '@/store';
import { getAnonymousWorkspaceAccount } from '@/utils/lforage';
import type { ByokProvider } from '@/utils/byok-vault';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useByokModelAvailability } from '@/hooks/useByokModelAvailability';
import AppearanceSection from '@/components/AppSidebar/UserSettings/AppearanceSection';
import ByokKeysSection from '@/components/AppSidebar/UserSettings/ByokKeysSection';
import ConfirmActionDialog from '@/components/AppSidebar/UserSettings/ConfirmActionDialog';
import CustomInstructionsSection from '@/components/AppSidebar/UserSettings/CustomInstructionsSection';
import DangerZoneSection from '@/components/AppSidebar/UserSettings/DangerZoneSection';
import LanguageSection from '@/components/AppSidebar/UserSettings/LanguageSection';
import ThreadDefaultsSection from '@/components/AppSidebar/UserSettings/ThreadDefaultsSection';
import type { ConfirmState, DangerAction } from '@/components/AppSidebar/UserSettings/shared';
import { useByokSettings } from '@/components/AppSidebar/UserSettings/useByokSettings';
import { useDangerActions } from '@/components/AppSidebar/UserSettings/useDangerActions';
import { useThreadDefaults } from '@/components/AppSidebar/UserSettings/useThreadDefaults';

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UserSettingsDialog = ({ open, onOpenChange }: UserSettingsDialogProps) => {
  const [scrollTarget, setScrollTarget] = useAtom(userSettingsScrollTargetAtom);
  const { user } = useUser();
  const accountId = user?.id ?? getAnonymousWorkspaceAccount();
  const isMobile = useIsMobile();
  const customInstructionsRef = useRef<HTMLElement>(null);
  const byokRef = useRef<HTMLElement>(null);
  const [customInstructionsDraft, setCustomInstructionsDraft] = useState('');
  const [dangerAction, setDangerAction] = useState<DangerAction | null>(null);
  const [providerToRemove, setProviderToRemove] = useState<ByokProvider | null>(null);
  const [isDangerActionPending, setIsDangerActionPending] = useState(false);
  const confirm: ConfirmState = {
    dangerAction,
    setDangerAction,
    providerToRemove,
    setProviderToRemove,
    isPending: isDangerActionPending,
    setIsPending: setIsDangerActionPending,
  };
  const availability = useByokModelAvailability();

  useEffect(() => {
    if (!open || !scrollTarget) return;

    const frame = requestAnimationFrame(() => {
      const target = scrollTarget === 'custom-instructions' ? customInstructionsRef : byokRef;
      target.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollTarget(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [open, scrollTarget, setScrollTarget]);

  // Form state lives in this shell rather than in the sections: Radix unmounts the
  // dialog content on close, and the original single-component dialog kept these
  // values across close, reopen and mobile/desktop switches.
  const byok = useByokSettings({ open, accountId, confirm });
  const { threadSettings, setThreadSettings, isLoading } = useThreadDefaults({
    open,
    availability,
    setCustomInstructionsDraft,
  });
  const danger = useDangerActions({
    accountId,
    onOpenChange,
    confirm,
    setThreadSettings,
    setCustomInstructionsDraft,
    clearVaultState: byok.clearVaultState,
  });

  const handleConfirmAction = () => {
    if (providerToRemove) void byok.handleConfirmRemoveKey();
    else void danger.handleDangerAction();
  };

  const settingsBody = (
    <>
      <DialogHeader className="border-b border-border/60 bg-background px-6 py-5">
        <DialogTitle className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <SlidersHorizontalIcon className="size-4" />
          </span>
          Settings
        </DialogTitle>
        <DialogDescription>Personalize PolyChat and choose how new chats begin.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-5 p-6">
        <AppearanceSection />
        <CustomInstructionsSection
          sectionRef={customInstructionsRef}
          customInstructions={customInstructionsDraft}
          setCustomInstructionsDraft={setCustomInstructionsDraft}
        />
        <ByokKeysSection sectionRef={byokRef} byok={byok} />
        <LanguageSection />
        <ThreadDefaultsSection
          threadSettings={threadSettings}
          setThreadSettings={setThreadSettings}
          isLoading={isLoading}
          models={availability.models}
          findModel={availability.findModel}
          customInstructions={customInstructionsDraft}
        />
        <DangerZoneSection isPending={isDangerActionPending} onRequestAction={setDangerAction} />
        <ConfirmActionDialog confirm={confirm} onConfirm={handleConfirmAction} />
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground>
        <DrawerContent className="max-h-[92dvh] rounded-t-2xl border-t border-border/70 bg-background p-0 shadow-[0_-12px_32px_hsl(var(--foreground)/0.08)] [&>div:first-child]:mb-3">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Settings</DrawerTitle>
            <DrawerDescription>
              Personalize PolyChat and choose how new chats begin.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {settingsBody}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(46rem,calc(100dvh-2rem))] max-w-2xl overflow-y-auto rounded-2xl border-border/70 p-0">
        {settingsBody}
      </DialogContent>
    </Dialog>
  );
};

export default UserSettingsDialog;
