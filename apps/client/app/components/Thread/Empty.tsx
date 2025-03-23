import { useCallback, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { toast } from 'sonner';

import { variations } from 'utils';

import useCustomEditor from '@/hooks/useCustomEditor';
import { threadAtom } from '@/store';
import { Button } from '@/components/ui/button';

interface IEmpty {
  name: string;
}

const Empty = ({ name }: IEmpty) => {
  const thread = useAtomValue(threadAtom);
  const variation = thread?.settings.variation;

  const { editor, handleSubmit } = useCustomEditor();

  const hints = useMemo(
    () => variations.find(({ code }) => code === variation)?.hints,
    [variation]
  );
  const description = useMemo(
    () => variations.find(({ code }) => code === variation)?.description,
    [variation]
  );

  const handleOnClick = useCallback(
    async (prompt: string) => {
      if (!editor) return;

      const cursorPos = editor.state.selection.$head.pos;

      editor?.commands?.clearContent();
      editor?.commands.insertContent(prompt);

      // Reset cursor position after inserting content
      editor.chain().focus().setTextSelection(cursorPos).run();

      const isSubmitSuccess = await handleSubmit();

      if (!isSubmitSuccess) return;

      // First success message
      setTimeout(() => {
        toast.success(`Cool! You've just got started`);
      }, 1000);
    },
    [editor, handleSubmit]
  );

  return (
    <div className="flex gradient justify-center items-center min-h-[250px] bg-base-200">
      <div className="text-center">
        <div className="max-w-screen mx-auto mt-16">
          <h1 className="text-2xl lg:text-4xl font-bold capitalize break-all">
            <span
              role="img"
              className="animate-wave origin-[70%_70%] inline-block mr-2  "
              aria-hidden={true}>
              👋
            </span>
            Hi <span className="capitalize">{name || 'there'}, </span>
          </h1>
          <h2 className="py-6 italic break-words [text-wrap:pretty] max-w-md mx-auto">
            {`Type in the input box in the bottom and start chatting. You can also change settings from the hamburger menu in the top left corner.`}
          </h2>
        </div>
        {description && hints?.length && (
          <>
            <blockquote className="mt-6 mb-3 italic">{description}</blockquote>
            <h3 className="my-3 font-semibold">Query Hints:&nbsp;</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {hints.map((hint) => (
                <Button
                  key={hint}
                  variant="ghost"
                  onClick={() => handleOnClick(hint)}
                  className="bg-[rgba(_255,_255,_255,_0.25)] [box-shadow:0_8px_32px_0_rgba(_0,_0,_0,_0.1)] dark:[box-shadow:0_8px_32px_0_rgba(_31,_38,_135,_0.37)] backdrop-filter backdrop-blur-sm rounded-[10px] border border-solid border-[rgba(255,255,255,0.18)] cursor-default overflow-hidden h-fit">
                  <p className="my-3 px-2 whitespace-break-spaces max-w-full text-ellipsis">
                    {hint}
                  </p>
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Empty;
