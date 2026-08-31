import axios from 'axios';
import { useAuth } from '@clerk/react-router';

import { enabledModelsType, variationsType } from 'utils';

import { IConfig } from '@/store/index';

const baseURL = import.meta.env.VITE_API_ENDPOINT;
const axiosInstance = axios.create({ baseURL });

type GetTokenOptions = Parameters<ReturnType<typeof useAuth>['getToken']>[0];
type ErrorType = { success: false; err: string };

const getErrorMessage = (data: unknown, fallback: string) => {
  if (typeof data === 'object' && data !== null) {
    const errorData = data as { err?: unknown; message?: unknown };

    if (typeof errorData.err === 'string') return errorData.err;
    if (typeof errorData.message === 'string') return errorData.message;
  }

  return fallback;
};

interface IMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface IGetGeneratedTextBase {
  model: enabledModelsType;
  variation: variationsType;
  language?: string;
  getToken: (options?: GetTokenOptions) => Promise<string | null>;
}

interface IGetGeneratedTextWithMessages extends IGetGeneratedTextBase {
  messages: IMessage[];
  prompt?: never;
}

interface IGetGeneratedTextWithPrompt extends IGetGeneratedTextBase {
  prompt: string;
  messages?: never;
}

type IGetGeneratedText = IGetGeneratedTextWithMessages | IGetGeneratedTextWithPrompt;

/**
 * Streams the generated text from the API
 * @param {prompt, language}
 * @returns {Stream}
 */
export const getGeneratedText = async ({
  prompt,
  messages,
  model,
  variation,
  language,
  getToken,
}: IGetGeneratedText): Promise<ReadableStream<string> | ErrorType> => {
  const token = await getToken();

  const res = await fetch(`${baseURL}/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      messages,
      language,
      variation,
      model,
    }),
  });

  if (!res.ok || !res.body) {
    switch (res.status) {
      case 429:
        return { success: false, err: 'Rate limit exceeded. Please try again later.' };
      case 401:
        return { success: false, err: 'Unauthorized. Please check your authentication.' };
      case 400:
        return { success: false, err: getErrorMessage(await res.json(), 'Invalid request parameters.') };
      default:
        return { success: false, err: getErrorMessage(await res.json(), 'Something went wrong.') };
    }
  }

  return res.body.pipeThrough(new TextDecoderStream());
};

interface IGetGeneratedImage {
  prompt: string;
  model: enabledModelsType;
  quality: IConfig['quality'];
  style: IConfig['style'];
  size?: string;
  getToken: (options?: GetTokenOptions) => Promise<string | null>;
}

interface GeneratedImageResponse {
  b64_json: string;
}

export const getGeneratedImage = async ({
  prompt,
  model,
  quality,
  style,
  size,
  getToken,
}: IGetGeneratedImage): Promise<GeneratedImageResponse | ErrorType> => {
  const token = await getToken();

  const res = await axiosInstance.post(
    '/image',
    { prompt, model, quality, style, size },
    {
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true,
    }
  );

  if (res.status < 200 || res.status >= 300 || !res.data) {
    switch (res.status) {
      case 429:
        return { success: false, err: 'API rate limit exceeded. Please try again later.' };
      case 401:
        return { success: false, err: 'Unauthorized. Please check your authentication.' };
      case 400:
        return { success: false, err: getErrorMessage(res.data, 'Invalid request parameters.') };
      default:
        return { success: false, err: getErrorMessage(res.data, 'Something went wrong.') };
    }
  }

  return res.data;
};
