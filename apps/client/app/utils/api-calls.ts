import axios from 'axios';
import { useAuth } from '@clerk/react-router';

import { chatRequestSchema, enabledModelsType, imageRequestSchema, variationsType } from 'utils';

import { IConfig } from '@/store/index';
import { generateByokImage, streamByokText } from './byok-providers';

const baseURL = import.meta.env.VITE_API_ENDPOINT;
const axiosInstance = axios.create({ baseURL });

type GetTokenOptions = Parameters<ReturnType<typeof useAuth>['getToken']>[0];
type ErrorType = { success: false; err: string; status?: number };

const getErrorMessage = (data: unknown, fallback: string) => {
  if (typeof data === 'object' && data !== null) {
    const errorData = data as { err?: unknown; message?: unknown };

    if (typeof errorData.err === 'string') return errorData.err;
    if (typeof errorData.message === 'string') return errorData.message;
  }

  return fallback;
};

const getResponseErrorMessage = async (res: Response, fallback: string) => {
  try {
    return getErrorMessage(await res.json(), fallback);
  } catch {
    return fallback;
  }
};

interface IMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponseMetadata {
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
  };
  finishReason?: string;
  responseId?: string;
  modelId?: string;
  timestamp?: string;
}

export type ChatStreamPart =
  | { type: 'text'; text: string }
  | { type: 'metadata'; metadata: ChatResponseMetadata }
  | { type: 'error'; error: string };

interface IGetGeneratedTextBase {
  model: enabledModelsType;
  variation: variationsType;
  customInstructions?: string;
  language?: string;
  getToken: (options?: GetTokenOptions) => Promise<string | null>;
  apiKey?: string;
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
  apiKey,
  customInstructions,
}: IGetGeneratedText): Promise<ReadableStream<ChatStreamPart> | ErrorType> => {
  const requestBody = chatRequestSchema.safeParse({
    prompt,
    messages,
    language,
    variation,
    model,
    customInstructions,
  });
  if (!requestBody.success) {
    return { success: false, err: 'Invalid chat request.' };
  }
  if (apiKey) {
    try {
      return await streamByokText({
        model,
        variation,
        customInstructions,
        language: (language || 'en-US') as Parameters<typeof streamByokText>[0]['language'],
        prompt,
        messages,
        apiKey,
      });
    } catch {
      return {
        success: false,
        err: 'Provider request failed. Check your API key and browser access.',
      };
    }
  }
  const token = await getToken();

  const res = await fetch(`${baseURL}/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody.data),
  });

  if (!res.ok || !res.body) {
    const fallback =
      res.status === 429
        ? 'API rate limit exceeded. Please try again later.'
        : res.status === 401
          ? 'Unauthorized. Please check your authentication.'
          : res.status === 400
            ? 'Invalid request parameters.'
            : 'Something went wrong.';
    const serverError = await getResponseErrorMessage(res, fallback);

    switch (res.status) {
      case 429:
        return { success: false, err: serverError, status: res.status };
      case 401:
        return { success: false, err: serverError, status: res.status };
      case 400:
        return { success: false, err: serverError, status: res.status };
      default:
        return { success: false, err: serverError, status: res.status };
    }
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  return new ReadableStream<ChatStreamPart>({
    async pull(controller) {
      const { value, done } = await reader.read();

      if (done) {
        if (buffer.trim()) controller.enqueue(JSON.parse(buffer) as ChatStreamPart);
        controller.close();
        return;
      }

      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) controller.enqueue(JSON.parse(line) as ChatStreamPart);
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
};

interface IGetGeneratedImage {
  prompt: string;
  model: enabledModelsType;
  quality: IConfig['quality'];
  style: IConfig['style'];
  size?: string;
  getToken: (options?: GetTokenOptions) => Promise<string | null>;
  apiKey?: string;
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
  apiKey,
}: IGetGeneratedImage): Promise<GeneratedImageResponse | ErrorType> => {
  const requestBody = imageRequestSchema.safeParse({ prompt, model, quality, style, size });
  if (!requestBody.success) {
    return { success: false, err: 'Invalid image request.' };
  }
  if (apiKey) {
    try {
      return await generateByokImage({ prompt, model, quality, style, size, apiKey });
    } catch {
      return {
        success: false,
        err: 'Provider request failed. Check your API key and browser access.',
      };
    }
  }
  const token = await getToken();

  const res = await axiosInstance.post('/image', requestBody.data, {
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true,
  });

  if (res.status < 200 || res.status >= 300 || !res.data) {
    const fallback =
      res.status === 429
        ? 'API rate limit exceeded. Please try again later.'
        : res.status === 401
          ? 'Unauthorized. Please check your authentication.'
          : res.status === 400
            ? 'Invalid request parameters.'
            : 'Something went wrong.';
    const serverError = getErrorMessage(res.data, fallback);

    switch (res.status) {
      case 429:
        return { success: false, err: serverError, status: res.status };
      case 401:
        return { success: false, err: serverError, status: res.status };
      default:
        return { success: false, err: serverError, status: res.status };
    }
  }

  return res.data;
};
