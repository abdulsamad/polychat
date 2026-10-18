import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { toast } from 'sonner';

import type { enabledModelsType } from 'utils';
import { defaultModel } from 'utils';

import { configAtom, getDefaultThread, type IThreadSettings } from '@/store';
import { getUserSettings, setUserSettings } from '@/utils/lforage';
import type { useByokModelAvailability } from '@/hooks/useByokModelAvailability';

type ModelAvailability = ReturnType<typeof useByokModelAvailability>;

interface UseThreadDefaultsOptions {
  open: boolean;
  availability: Pick<ModelAvailability, 'findModel' | 'isModelAvailable' | 'isProviderAvailable'>;
  setCustomInstructionsDraft: (value: string) => void;
}

export const useThreadDefaults = ({
  open,
  availability,
  setCustomInstructionsDraft,
}: UseThreadDefaultsOptions) => {
  const config = useAtomValue(configAtom);
  const [threadSettings, setThreadSettings] = useState<IThreadSettings<enabledModelsType>>(
    () => getDefaultThread().settings
  );
  const [isLoading, setIsLoading] = useState(true);
  const { findModel, isModelAvailable, isProviderAvailable } = availability;

  useEffect(() => {
    if (!open) return;
    setCustomInstructionsDraft(config.customInstructions || '');

    let isActive = true;
    setIsLoading(true);
    void getUserSettings()
      .then((savedSettings) => {
        if (isActive) {
          setThreadSettings(getDefaultThread(savedSettings || undefined).settings);
        }
      })
      .catch(() => {
        if (isActive) toast.error('Could not load thread defaults');
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [config.customInstructions, open]);

  useEffect(() => {
    const currentModel = findModel(threadSettings.model);
    const modelProviderAvailable = threadSettings.modelProvider
      ? isProviderAvailable(threadSettings.modelProvider)
      : false;
    if (
      isLoading ||
      (currentModel && isModelAvailable(currentModel)) ||
      (!currentModel && (!threadSettings.modelProvider || modelProviderAvailable))
    ) {
      return;
    }

    const nextSettings: IThreadSettings<enabledModelsType> = {
      ...threadSettings,
      model: defaultModel,
    };
    setThreadSettings(nextSettings);
    void setUserSettings(nextSettings).catch((error) => {
      console.error('Failed to restore an available default model', error);
    });
  }, [findModel, isLoading, isModelAvailable, isProviderAvailable, threadSettings]);

  return { threadSettings, setThreadSettings, isLoading };
};
