import { fetchVideoApi, parseVideoJob, VideoApiError, type VideoJob } from 'utils';

const activeJobs = new Set<string>();
export const isVideoJobActive = (id: string) => activeJobs.has(id);

const waitForPoll = (milliseconds: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      reject(new DOMException('Stopped checking video generation.', 'AbortError'));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', abort, { once: true });
  });

const createVideoThumbnail = async (blob: Blob) => {
  const video = document.createElement('video');
  const objectUrl = URL.createObjectURL(blob);
  video.preload = 'metadata';
  video.muted = true;
  video.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Video thumbnail timed out.')), 5000);
      video.onloadeddata = () => {
        clearTimeout(timeout);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Video thumbnail could not be created'));
      };
    });
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;
    const scale = Math.min(1, 640 / width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute('src');
    video.load();
  }
};

export const finishVideoJob = async (
  initialJob: VideoJob,
  apiKey: string,
  signal?: AbortSignal,
  onProgress?: (job: VideoJob, downloading: boolean) => void
) => {
  if (!apiKey.trim())
    throw new VideoApiError('Unlock or add your OpenRouter BYOK key in Settings.');
  if (activeJobs.has(initialJob.id))
    throw new VideoApiError('This video is already being checked.');
  activeJobs.add(initialJob.id);
  try {
    let job = initialJob;
    const deadline = Date.now() + 15 * 60 * 1000;
    const pollingUrl = job.polling_url || `/api/v1/videos/${encodeURIComponent(job.id)}`;
    let interval = 3000;
    while (job.status !== 'completed') {
      signal?.throwIfAborted();
      if (['failed', 'cancelled', 'expired'].includes(job.status)) {
        const message = typeof job.error === 'string' ? job.error : job.error?.message;
        throw new VideoApiError(message || `Video generation ${job.status}.`, undefined, true);
      }
      onProgress?.(job, false);
      if (Date.now() >= deadline) {
        throw new VideoApiError('The video is taking longer than expected. Check it again later.');
      }
      await waitForPoll(interval, signal);
      try {
        const response = await fetchVideoApi(pollingUrl, apiKey, { signal });
        const nextJob = parseVideoJob(await response.json());
        if (nextJob.id !== initialJob.id)
          throw new VideoApiError('The video service returned a different job.');
        job = nextJob;
      } catch (error) {
        if (
          !(error instanceof VideoApiError) ||
          (error.status !== 429 && (error.status ?? 0) < 500)
        )
          throw error;
      }
      interval = Math.min(30000, interval * 1.5);
    }
    onProgress?.(job, true);
    const sourceUrl =
      job.unsigned_urls?.[0] || `/api/v1/videos/${encodeURIComponent(job.id)}/content?index=0`;
    const response = await fetchVideoApi(sourceUrl, apiKey, { signal });
    const blob = await response.blob();
    if (!blob.type.startsWith('video/') || !blob.size)
      throw new VideoApiError('The video service returned invalid video content.');
    const thumbnail = await createVideoThumbnail(blob).catch(() => undefined);
    signal?.throwIfAborted();
    return {
      ...(thumbnail ? { thumbnail } : {}),
      url: URL.createObjectURL(blob),
      sourceUrl: response.url || sourceUrl,
      jobId: job.id,
      mediaType: blob.type,
      size: blob.size,
      status: 'ready' as const,
      ...(typeof job.usage?.cost === 'number' && Number.isFinite(job.usage.cost)
        ? { cost: job.usage.cost }
        : {}),
    };
  } finally {
    activeJobs.delete(initialJob.id);
  }
};
