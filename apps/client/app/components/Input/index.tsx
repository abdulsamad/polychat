import { useMemo } from 'react';
import { EditorContent } from '@tiptap/react';
import { useAtomValue } from 'jotai';
import { SendHorizonal } from 'lucide-react';

import { threadLoadingAtom } from '@/store';
import useCustomTiptapEditor from '@/hooks/useCustomEditor';
import { IS_SPEECH_RECOGNITION_SUPPORTED } from '@/utils';
import Voice from '@/components/Input/Voice';
import { Button } from '@/components/ui/button';

const Text = () => {
  const { editor, handleSubmit } = useCustomTiptapEditor();
  const isChatResponseLoading = useAtomValue(threadLoadingAtom);

  const hasText = useMemo(() => editor?.getText(), [editor?.getText()]);

  return (
    <div className="flex gap-5 items-center">
      <EditorContent
        editor={editor}
        className="rounded-4xl px-3 py-2 [scrollbar-width:none] border-gray-500 border min-h-[20px] max-h-[60px] w-full"
      />
      <div className="flex items-center">
        {!hasText && IS_SPEECH_RECOGNITION_SUPPORTED() ? (
          <Voice />
        ) : (
          <Button
            id="text-submit-btn"
            className="text-accent bg-primary rounded-3xl hover:text-gray-400 hover:shadow-xl"
            onClick={handleSubmit}
            disabled={isChatResponseLoading}>
            <SendHorizonal className="size-4" />
            <span className="sr-only">Send</span>
          </Button>
        )}
      </div>
    </div>
  );
};

export default Text;
