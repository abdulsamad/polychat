import { Loader2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { ConfirmState } from '@/components/AppSidebar/UserSettings/shared';

interface ConfirmActionDialogProps {
  confirm: ConfirmState;
  onConfirm: () => void;
}

const ConfirmActionDialog = ({ confirm, onConfirm }: ConfirmActionDialogProps) => {
  const { dangerAction, providerToRemove, isPending } = confirm;

  return (
    <AlertDialog
      open={dangerAction !== null || providerToRemove !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) {
          confirm.setDangerAction(null);
          confirm.setProviderToRemove(null);
        }
      }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {providerToRemove
              ? 'Remove this provider key?'
              : dangerAction === 'delete-chats'
                ? 'Delete all chats?'
                : 'Reset all local data?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {providerToRemove
              ? 'This provider key will be permanently deleted from this browser.'
              : dangerAction === 'delete-chats'
                ? 'Every chat and message will be permanently deleted from this browser.'
                : 'Every chat, saved setting, theme preference, and BYOK provider key will be permanently deleted from this browser.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="secondary" disabled={isPending}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}>
              {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {isPending ? 'Working…' : providerToRemove ? 'Remove key' : 'Continue'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmActionDialog;
