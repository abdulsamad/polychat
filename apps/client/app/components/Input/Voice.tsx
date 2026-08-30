import { useAtomValue } from 'jotai';
import { Mic, Loader2 } from 'lucide-react';
import clsx from 'clsx';

import { threadLoadingAtom } from '@/store';
import useSpeech from '@/hooks/useSpeech';
import { Button } from '@/components/ui/button';

const Voice = () => {
  const isChatResponseLoading = useAtomValue(threadLoadingAtom);

  const { startRecognition, stopRecognition, isListening } = useSpeech();

  return (
    <Button
      type="button"
      variant="link"
      title={isListening ? 'Stop Voice Recognition' : 'Start Voice Recognition'}
      size="icon"
      className={clsx(
        'group flex size-10 items-center justify-center rounded-full bg-primary p-0 text-primary-foreground shadow-md hover:text-primary-foreground hover:shadow-primary/30 sm:size-11',
        isListening &&
          'text-sky-200 border-2  border-sky-200 shadow-[0_0_1px_#fff,inset_0_0_1px_#fff,0_0_2px_#08f,0_0_6px_#08f,0_0_15px_#08f]'
      )}
      onClick={isListening ? stopRecognition : startRecognition}>
      {isChatResponseLoading ? (
        <Loader2 className="animate-spin size-4" />
      ) : (
        <Mic className="group-hover:scale-95 size-4" />
      )}
      <span className="sr-only">
        {isListening ? 'Stop Voice Recognition' : 'Start Voice Recognition'}
      </span>
    </Button>
  );
};

export default Voice;
