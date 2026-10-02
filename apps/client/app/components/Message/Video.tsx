import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DownloadIcon, FilmIcon, LoaderCircleIcon, RefreshCwIcon } from 'lucide-react';
import { useUser } from '@clerk/react-router';
import { useSetAtom } from 'jotai';
import { fetchVideoApi, VideoApiError } from 'utils';

import type { IMessageCommons, IVideoMessage, ThreadId } from '@/store';
import {
  upsertThreadMessageAtom,
  userSettingsOpenAtom,
  userSettingsScrollTargetAtom,
} from '@/store';
import { getAnonymousWorkspaceAccount } from '@/utils/lforage';
import { getProviderKey, subscribeVault } from '@/utils/byok-vault';
import { finishVideoJob, isVideoJobActive } from '@/utils/video-jobs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface VideoProps {
  id: IMessageCommons['id'];
  video: IVideoMessage['video_url'];
  model: string;
  threadId: ThreadId;
  metadata: IMessageCommons['metadata'];
}

const Video = ({ id, video, threadId, metadata }: VideoProps) => {
  const { user } = useUser();
  const accountId = user?.id ?? getAnonymousWorkspaceAccount();
  const apiKey = useSyncExternalStore(
    subscribeVault,
    () => getProviderKey(accountId, 'openrouter') || '',
    () => ''
  );
  const upsert = useSetAtom(upsertThreadMessageAtom);
  const setSettingsOpen = useSetAtom(userSettingsOpenAtom);
  const setSettingsTarget = useSetAtom(userSettingsScrollTargetAtom);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [reload, setReload] = useState(0);
  const resumeController = useRef<AbortController | null>(null);

  const save = (next: IVideoMessage['video_url']) =>
    upsert({
      threadId,
      message: {
        id,
        content: '',
        role: 'assistant',
        type: 'video_url',
        video_url: next,
        metadata: { ...metadata, requestState: undefined },
      },
    });
  const openSettings = () => {
    setSettingsTarget('byok');
    setSettingsOpen(true);
  };

  useEffect(() => () => resumeController.current?.abort(), [accountId, threadId, id]);

  useEffect(() => {
    setPlaybackUrl(null);
    setError(undefined);
    if (video.status === 'generating' || video.status === 'failed' || video.status === 'expired')
      return;
    const controller = new AbortController();
    let localUrl: string | undefined;
    const load = async () => {
      try {
        let response: Response;
        if (video.url.startsWith('blob:')) {
          try {
            response = await fetch(video.url, { signal: controller.signal });
          } catch (error) {
            if (controller.signal.aborted || !video.sourceUrl) throw error;
            response = await fetchVideoApi(video.sourceUrl, apiKey, { signal: controller.signal });
          }
        } else {
          response = await fetchVideoApi(video.sourceUrl || video.url, apiKey, {
            signal: controller.signal,
          });
        }
        const blob = await response.blob();
        controller.signal.throwIfAborted();
        if (!blob.type.startsWith('video/'))
          throw new Error('This file could not be played as a video.');
        localUrl = URL.createObjectURL(blob);
        setPlaybackUrl(localUrl);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof VideoApiError && (error.status === 404 || error.status === 410)) {
          save({ ...video, status: 'expired' });
        } else {
          setError(error instanceof Error ? error.message : 'Could not load the video. Try again.');
        }
      }
    };
    void load();
    return () => {
      controller.abort();
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [video.url, video.sourceUrl, video.status, apiKey, reload, accountId, threadId, id]);

  const resume = async () => {
    if (!video.jobId || checking || isVideoJobActive(video.jobId)) return;
    const controller = new AbortController();
    resumeController.current = controller;
    setChecking(true);
    setError(undefined);
    try {
      const result = await finishVideoJob(
        { id: video.jobId, status: 'pending' },
        apiKey,
        controller.signal
      );
      save({ ...result, startedAt: video.startedAt });
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : 'Could not check the video.';
        setError(message);
        save({
          ...video,
          status: 'failed',
          error: message,
          terminal: error instanceof VideoApiError && error.terminal,
        });
      }
    } finally {
      if (resumeController.current === controller) {
        resumeController.current = null;
        setChecking(false);
      }
    }
  };

  const generating = video.status === 'generating';
  const expired = video.status === 'expired';
  const failed = video.status === 'failed';
  const active = checking || !!(video.jobId && isVideoJobActive(video.jobId));
  const canResume = !!video.jobId && !video.terminal && !active && (generating || failed);
  const needsKey = !apiKey && (canResume || !!error);
  const title = checking
    ? 'Checking existing video...'
    : expired
      ? 'This video is no longer available'
      : failed
        ? 'Could not finish loading your video'
        : canResume
          ? 'Your video can be checked again'
          : video.jobStatus === 'completed'
            ? 'Downloading video...'
            : video.jobStatus === 'pending'
              ? 'Video queued...'
              : 'Generating video...';

  if (generating || failed || expired || error) {
    return (
      <Card className="w-full min-w-0 max-w-[52rem] bg-muted shadow-none">
        <CardContent
          className="flex min-h-48 flex-col items-center justify-center gap-3 p-5 text-center"
          aria-live="polite">
          {(generating && !canResume) || checking ? (
            <LoaderCircleIcon
              className="size-7 animate-spin motion-reduce:animate-none text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            <FilmIcon className="size-7 text-muted-foreground" aria-hidden="true" />
          )}
          {expired && video.thumbnail && (
            <img
              src={video.thumbnail}
              alt="Generated video preview"
              className="max-h-40 w-full rounded-lg object-contain"
            />
          )}
          <p className="text-sm font-medium">
            {error && !failed ? 'Could not load the video' : title}
          </p>
          <p className="max-w-md text-xs text-muted-foreground break-words">
            {error ||
              video.error ||
              (expired
                ? 'Download completed videos to keep a permanent copy.'
                : canResume
                  ? 'Check the existing job without starting or paying for another generation.'
                  : 'This can take several minutes. Your job is saved once the provider accepts it.')}
          </p>
          {needsKey ? (
            <Button variant="outline" size="sm" onClick={openSettings}>
              Open BYOK settings
            </Button>
          ) : canResume ? (
            <Button variant="outline" size="sm" onClick={() => void resume()}>
              <RefreshCwIcon aria-hidden="true" />
              Check existing video
            </Button>
          ) : error && !failed && !expired ? (
            <Button variant="outline" size="sm" onClick={() => setReload((value) => value + 1)}>
              Retry loading
            </Button>
          ) : null}
          {checking && (
            <Button variant="ghost" size="sm" onClick={() => resumeController.current?.abort()}>
              Stop checking
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <section
      className="flex w-full min-w-0 max-w-[52rem] flex-col gap-2"
      aria-label="Generated video">
      {playbackUrl ? (
        <video
          className="video-playback-entry max-h-[min(70vh,40rem)] w-full rounded-xl border border-border bg-muted object-contain"
          src={playbackUrl}
          controls
          playsInline
          preload="metadata"
          onError={() => setError('Your browser could not play this video. Try loading it again.')}
        />
      ) : (
        <Card className="bg-muted shadow-none">
          <CardContent
            className="flex aspect-video items-center justify-center p-4"
            role="status"
            aria-label="Loading video">
            <LoaderCircleIcon
              className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground"
              aria-hidden="true"
            />
          </CardContent>
        </Card>
      )}
      {playbackUrl && (
        <Button variant="outline" size="sm" className="video-playback-entry self-start" asChild>
          <a
            href={playbackUrl}
            download={`polychat-video-${id}.${video.mediaType === 'video/webm' ? 'webm' : 'mp4'}`}>
            <DownloadIcon aria-hidden="true" />
            Download video
          </a>
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Video links are temporary. Download to keep a copy.
        {typeof video.cost === 'number' && ` Provider cost: $${video.cost.toFixed(4)}.`}
      </p>
    </section>
  );
};
export default Video;
