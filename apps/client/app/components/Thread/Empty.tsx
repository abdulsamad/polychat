import { useEffect, useMemo, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { profiles } from 'utils';

import useSubmitMessage from '@/hooks/useSubmitMessage';
import {
  threadAtom,
  anyThreadLoadingAtom,
  threadSettingsOpenAtom,
  userSettingsOpenAtom,
  userSettingsScrollTargetAtom,
} from '@/store';
import { Button } from '@/components/ui/button';

interface IEmpty {
  name: string;
}

const emptyTips = [
  {
    before: 'Open ',
    link: 'thread settings',
    after: ' to switch models or profiles.',
    target: 'thread',
  },
  {
    before: 'Enable context in ',
    link: 'thread settings',
    after: ' to keep earlier messages in view.',
    target: 'thread',
  },
  {
    before: 'Turn on text-to-speech from ',
    link: 'thread settings',
    after: '.',
    target: 'thread',
  },
  {
    before: 'Add your own provider key in ',
    link: 'Settings',
    after: '.',
    target: 'byok',
  },
] as const;

const Empty = ({ name }: IEmpty) => {
  const thread = useAtomValue(threadAtom);
  const profile = thread?.settings.profile;
  const setThreadSettingsOpen = useSetAtom(threadSettingsOpenAtom);
  const setUserSettingsOpen = useSetAtom(userSettingsOpenAtom);
  const setUserSettingsScrollTarget = useSetAtom(userSettingsScrollTargetAtom);

  const { isChatLoading, submitMessage } = useSubmitMessage();
  const isAnyChatLoading = useAtomValue(anyThreadLoadingAtom);

  const hints = useMemo(
    () => profiles.find(({ code }) => code === profile)?.hints,
    [profile]
  );
  const description = useMemo(
    () => profiles.find(({ code }) => code === profile)?.description,
    [profile]
  );
  const [tip, setTip] = useState<(typeof emptyTips)[number]>(emptyTips[0]);

  useEffect(() => {
    const nextTip = emptyTips[Math.floor(Math.random() * emptyTips.length)];
    setTip(nextTip);
  }, []);

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
                  disabled={isChatLoading || isAnyChatLoading}
                  className="h-full min-w-0 rounded-xl bg-card/70 px-3 py-3 text-left shadow-sm hover:border-primary/50 hover:bg-accent/70">
                  <p className="max-w-full whitespace-break-spaces [overflow-wrap:anywhere]">
                    {hint}
                  </p>
                </Button>
              ))}
            </div>
          </>
        )}
        <p className="mx-auto mt-10 max-w-2xl border-t border-border/60 px-4 pt-4 text-xs leading-5 text-muted-foreground/80 sm:text-sm">
          Tip: {tip.before}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-inherit underline underline-offset-2"
            onClick={() => {
              if (tip.target === 'thread') {
                setThreadSettingsOpen(true);
                return;
              }

              setUserSettingsScrollTarget('byok');
              setUserSettingsOpen(true);
            }}>
            {tip.link}
          </Button>
          {tip.after}
        </p>
      </div>
    </div>
  );
};

export default Empty;
