import { useEffect, useState } from 'react';
import { FilmIcon, LoaderCircleIcon, RefreshCwIcon } from 'lucide-react';
import { useUser } from '@clerk/react-router';
import { useSetAtom } from 'jotai';

import type { IMessageCommons, IVideoMessage, ThreadId } from '@/store';
import { upsertThreadMessageAtom } from '@/store';
import { getAnonymousWorkspaceAccount } from '@/utils/lforage';
import { getProviderKey } from '@/utils/byok-vault';

interface VideoProps {
  id: IMessageCommons['id'];
  video: IVideoMessage['video_url'];
  model: string;
  threadId: ThreadId;
  metadata: IMessageCommons['metadata'];
}

const Video = ({ id, video, model, threadId, metadata }: VideoProps) => {
  const { user } = useUser();
  const upsertThreadMessage = useSetAtom(upsertThreadMessageAtom);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(
    video.url.startsWith('blob:') ? video.url : null
  );
  const [isExpired, setIsExpired] = useState(video.status === 'expired');

  const markExpired = () => {
    if (isExpired || video.status === 'expired') return;
    setIsExpired(true);
    upsertThreadMessage({
      threadId,
      message: {
        id,
        content: '',
        role: 'assistant',
        type: 'video_url',
        video_url: { ...video, status: 'expired' },
        metadata: { ...metadata, requestState: undefined },
      },
    });
  };

  useEffect(() => {
    if (video.status === 'generating' || video.status === 'failed' || video.status === 'expired') {
      return;
    }
    if (video.expiresAt && Date.now() >= video.expiresAt) {
      markExpired();
      return;
    }
    if (video.url.startsWith('blob:')) return;

    const controller = new AbortController();
    let localUrl: string | undefined;
    void fetch(video.url, {
      headers: {
        Authorization: `Bearer ${getProviderKey(user?.id ?? getAnonymousWorkspaceAccount(), 'openrouter') || ''}`,
      },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Video request failed: ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        localUrl = URL.createObjectURL(blob);
        setPlaybackUrl(localUrl);
      })
      .catch((error: unknown) => {
        if ((error as Error).name !== 'AbortError') markExpired();
      });

    return () => {
      controller.abort();
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [video.url, video.status, video.expiresAt]);

  if (video.status === 'generating') {
    return (
      <div className="relative flex aspect-video w-full max-w-[52rem] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-accent/40 to-muted" />
        <div className="relative flex flex-col items-center gap-3 text-muted-foreground">
          <LoaderCircleIcon className="size-8 animate-spin" aria-hidden="true" />
          <p className="text-sm">Generating video...</p>
          <p className="text-xs">This may take a few minutes.</p>
        </div>
      </div>
    );
  }

  if (isExpired || video.status === 'expired') {
    return (
      <div className="relative aspect-video w-full max-w-[52rem] overflow-hidden rounded-xl border border-border bg-muted">
        {video.thumbnail ? (
          <img
            className="size-full object-cover blur-md scale-105 opacity-60"
            src={video.thumbnail}
            alt="Expired video thumbnail"
          />
        ) : (
          <div className="size-full bg-gradient-to-br from-muted to-accent/40" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/65 px-4 text-center backdrop-blur-sm">
          <FilmIcon className="size-7 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">This video link has expired</p>
          <p className="text-xs text-muted-foreground">Generate again to watch it.</p>
        </div>
      </div>
    );
  }

  if (video.status === 'failed') {
    return (
      <div className="flex aspect-video w-full max-w-[52rem] flex-col items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 text-center">
        <FilmIcon className="size-7 text-destructive" aria-hidden="true" />
        <p className="text-sm font-medium">Video generation failed</p>
        <p className="text-xs text-muted-foreground">Check your BYOK key and try again.</p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[52rem] flex-col gap-2">
      {playbackUrl ? (
        <video
          className="max-h-[min(70vh,40rem)] w-full rounded-xl border border-border bg-muted object-contain"
          src={playbackUrl}
          controls
          playsInline
          preload="metadata"
          onError={markExpired}
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-xl border border-border bg-muted">
          <RefreshCwIcon className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      <p className="text-xs text-muted-foreground">Video links are temporary and may expire.</p>
    </div>
  );
};

export default Video;
