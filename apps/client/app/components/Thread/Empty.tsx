import { useMemo } from 'react';
import { useAtomValue } from 'jotai';

import { profiles } from 'utils';

import useSubmitMessage from '@/hooks/useSubmitMessage';
import { threadAtom } from '@/store';
import { Button } from '@/components/ui/button';

interface IEmpty {
  name: string;
}

const Empty = ({ name }: IEmpty) => {
  const thread = useAtomValue(threadAtom);
  const profile = thread?.settings.profile;

  const { isChatLoading, submitMessage } = useSubmitMessage();

  const hints = useMemo(
    () => profiles.find(({ code }) => code === profile)?.hints,
    [profile]
  );
  const description = useMemo(
    () => profiles.find(({ code }) => code === profile)?.description,
    [profile]
  );

  return (
    <div className="flex min-h-full items-center justify-center px-1 py-8 sm:px-4">
      <div className="w-full max-w-3xl text-center">
        <div className="mx-auto">
          <h1 className="text-2xl font-semibold capitalize tracking-tight text-balance sm:text-3xl lg:text-4xl">
            <span
              role="img"
              className="animate-wave origin-[70%_70%] inline-block mr-2  "
              aria-hidden={true}>
              👋
            </span>
            Hi <span className="capitalize">{name || 'there'}, </span>
          </h1>
          <h2 className="mx-auto max-w-lg py-5 text-sm leading-6 text-muted-foreground [text-wrap:pretty] sm:text-base">
            {`Type in the input box in the bottom and start chatting. You can also change settings from the hamburger menu in the top left corner.`}
          </h2>
        </div>
        {description && hints?.length && (
          <>
            <blockquote className="mx-auto mt-6 mb-3 max-w-2xl text-muted-foreground italic">
              {description}
            </blockquote>
            <h3 className="my-3 font-semibold">Try a prompt</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {hints.map((hint) => (
                <Button
                  key={hint}
                  variant="outline"
                  onClick={() => submitMessage(hint)}
                  disabled={isChatLoading}
                  className="h-full min-w-0 rounded-xl bg-card/70 px-3 py-3 text-left shadow-sm hover:border-primary/50 hover:bg-accent/70">
                  <p className="max-w-full whitespace-break-spaces [overflow-wrap:anywhere]">
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
