import { useSetAtom } from 'jotai';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

import type { enabledModelsType } from 'utils';

import {
  clearThreadMessagesAtom,
  configAtom,
  defaultConfig,
  getDefaultThread,
  refreshThreadsAtom,
  replaceMessagesAtom,
  resetChatQueueAtom,
  threadAtom,
  waitForPersistence,
  type IThreadSettings,
} from '@/store';
import { clearLocalData, deleteAllChats, getUserSettings } from '@/utils/lforage';
import { abortAllStreams } from '@/utils/chat-stream-registry';
import { resetVault } from '@/utils/byok-vault';
import type { ConfirmState } from '@/components/AppSidebar/UserSettings/shared';

interface UseDangerActionsOptions {
  accountId: string;
  onOpenChange: (open: boolean) => void;
  confirm: ConfirmState;
  setThreadSettings: (settings: IThreadSettings<enabledModelsType>) => void;
  setCustomInstructionsDraft: (value: string) => void;
  clearVaultState: () => void;
}

export const useDangerActions = ({
  accountId,
  onOpenChange,
  confirm,
  setThreadSettings,
  setCustomInstructionsDraft,
  clearVaultState,
}: UseDangerActionsOptions) => {
  const setConfig = useSetAtom(configAtom);
  const setThread = useSetAtom(threadAtom);
  const replaceMessages = useSetAtom(replaceMessagesAtom);
  const resetChatQueue = useSetAtom(resetChatQueueAtom);
  const clearThreadMessages = useSetAtom(clearThreadMessagesAtom);
  const refreshThreads = useSetAtom(refreshThreadsAtom);
  const { setTheme } = useTheme();

  const handleDeleteAllChats = async () => {
    abortAllStreams();
    resetChatQueue();
    clearThreadMessages();
    await deleteAllChats();
    setThread(getDefaultThread((await getUserSettings()) || undefined));
    replaceMessages([]);
    await waitForPersistence();
    await deleteAllChats();
    refreshThreads();
    onOpenChange(false);
    toast.success('All chats deleted');
  };

  const handleResetAllData = async () => {
    abortAllStreams();
    resetChatQueue();
    clearThreadMessages();
    await clearLocalData();
    await resetVault(accountId);
    setConfig(defaultConfig);
    setThread(getDefaultThread());
    replaceMessages([]);
    setCustomInstructionsDraft('');
    setThreadSettings(getDefaultThread().settings);
    setTheme('dark');
    clearVaultState();
    await waitForPersistence();
    await deleteAllChats();
    refreshThreads();
    onOpenChange(false);
    toast.success('All local data reset');
  };

  const handleDangerAction = async () => {
    const { dangerAction } = confirm;
    if (!dangerAction) return;
    confirm.setIsPending(true);
    try {
      if (dangerAction === 'delete-chats') await handleDeleteAllChats();
      else await handleResetAllData();
    } catch {
      toast.error(
        dangerAction === 'delete-chats'
          ? 'Could not delete all chats'
          : 'Could not reset all local data'
      );
    } finally {
      confirm.setIsPending(false);
      confirm.setDangerAction(null);
    }
  };

  return { handleDangerAction };
};
