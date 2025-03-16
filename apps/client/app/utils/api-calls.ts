import axios from 'axios';
import { useAuth, useUser } from '@clerk/react-router';

import { enabledModelsType, variationsType } from 'utils';

import { IConfig } from '@/store/index';

const baseURL = import.meta.env.VITE_API_ENDPOINT;
const axiosInstance = axios.create({ baseURL });

type GetTokenOptions = Parameters<ReturnType<typeof useAuth>['getToken']>[0];
type ErrorType = { success: boolean; err: string };

interface IGetGeneratedText {
  prompt: string;
  model: enabledModelsType;
  variation: variationsType;
  language?: string;
  user: ReturnType<typeof useUser>['user'];
  getToken: (options?: GetTokenOptions) => Promise<string | null>;
}

/**
 * Streams the generated text from the API
 * @param {prompt, language, user}
 * @returns {Stream}
 */
export const getGeneratedText = async ({
  prompt,
  model,
  variation,
  language,
  user,
  getToken,
}: IGetGeneratedText): Promise<ReadableStream<string> | ErrorType> => {
  const token = await getToken();

  const res = await fetch(`${baseURL}/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      language,
      variation,
      model,
      user,
    }),
  });

  if (!res.ok || !res.body) {
    switch (res.status) {
      case 429:
        return { success: false, err: 'Rate limit exceeded. Please try again later.' };
      case 401:
        return { success: false, err: 'Unauthorized. Please check your authentication.' };
      case 400:
        const errorData = await res.json();
        return { success: false, err: errorData.message || 'Invalid request parameters.' };
      default:
        return await res.json();
    }
  }

  return res.body.pipeThrough(new TextDecoderStream());
};

interface IGetGeneratedImage {
  prompt: string;
  model: enabledModelsType;
  user: ReturnType<typeof useUser>['user'];
  quality: IConfig['quality'];
  style: IConfig['style'];
  size?: string;
  getToken: (options?: GetTokenOptions) => Promise<string | null>;
}

export const getGeneratedImage = async ({
  prompt,
  model,
  user,
  quality,
  style,
  size,
  getToken,
}: IGetGeneratedImage): Promise<any | ErrorType> => {
  const token = await getToken();

  const res = await axiosInstance.post(
    '/image',
    { prompt, user, model, quality, style, size },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.data) {
    switch (res.status) {
      case 429:
        return { success: false, err: 'Rate limit exceeded. Please try again later.' };
      case 401:
        return { success: false, err: 'Unauthorized. Please check your authentication.' };
      case 400:
        const errorData = await res.data;
        return { success: false, err: errorData.message || 'Invalid request parameters.' };
      default:
        return await res.data;
    }
  }

  return res.data;
};
