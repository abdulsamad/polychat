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
      variant="link"
      title={isListening ? 'Stop Voice Recognition' : 'Start Voice Recognition'}
      size="icon"
      className={clsx(
        'bg-primary rounded-3xl flex items-center justify-center text-accent shadow-md hover:text-gray-300 group hover:shadow-slate-700 size-10',
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
