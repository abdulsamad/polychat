import type { VideoModelCapabilities } from 'utils';

/** Clip options a video model offers, with fallbacks for models that do not report them. */
export const getVideoSettingOptions = (capabilities?: VideoModelCapabilities) => ({
  durations: capabilities?.durations?.length ? capabilities.durations : [4, 5, 6, 8, 10, 15],
  resolutions: capabilities?.resolutions?.length
    ? capabilities.resolutions
    : ['480p', '720p', '1080p'],
  aspectRatios: capabilities?.aspectRatios?.length
    ? capabilities.aspectRatios
    : ['16:9', '9:16', '1:1'],
});
