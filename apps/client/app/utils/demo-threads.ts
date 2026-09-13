import type { ImageAttachment } from 'utils';
import { defaultModel } from 'utils';
import type { IMessage, IThreads } from '@/store';
import { getDefaultThread } from '@/store';

const demoImage = '/demo/sample.jpg';
const demoPdf = '/demo/sample.pdf';
const demoMessageId = (id: string) => id as IMessage['id'];

const attachment = (id: string, name: string, mediaType: string, size: number, dataUrl: string) =>
  ({ id, name, mediaType, size, dataUrl }) as ImageAttachment;

const message = (
  id: string,
  role: IMessage['role'],
  content: string,
  timestamp: number,
  extra: Partial<IMessage> = {}
): IMessage => ({
  id: demoMessageId(id),
  role,
  content,
  type: 'text',
  metadata: {
    profile: role === 'user' ? null : 'normal',
    model: defaultModel,
    timestamp,
    reasoningComplete: role === 'assistant' ? Boolean(extra.reasoning) : undefined,
  },
  ...extra,
}) as IMessage;

const createDemo = (id: string, name: string, messages: IMessage[], offset: number) => {
  const thread = getDefaultThread({ model: defaultModel });
  return {
    ...thread,
    id: `demo-${id}` as typeof thread.id,
    metadata: {
      ...thread.metadata,
      name,
      timestamp: Date.now() - offset,
      isDemo: true,
    },
    messages,
  };
};

export const createDemoWorkspace = (): { threads: IThreads; messages: Record<string, IMessage[]> } => {
  const now = Date.now();
  const reasoning = createDemo(
    'reasoning',
    'Demo - Reasoning',
    [
      message('demo-reasoning-user', 'user', 'What makes a good morning routine?', now - 10_000),
      message(
        'demo-reasoning-assistant',
        'assistant',
        'A good morning routine is simple, repeatable, and matched to your energy. Start with water, light movement, and one clear priority for the day.',
        now - 8_000,
        {
          reasoning:
            'First identify the useful criteria: the routine should be sustainable, energizing, and focused. Then turn those criteria into a few practical steps.',
        }
      ),
    ],
    3_000
  );
  const image = createDemo(
    'image',
    'Demo - Image generation',
    [
      message('demo-image-user', 'user', 'Create a playful image of a hidden message.', now - 20_000),
      {
        ...message('demo-image-assistant', 'assistant', '', now - 18_000),
        type: 'image_url',
        image_url: { url: demoImage, alt: 'A keyboard revealed through cardboard', size: '6016x4000' },
      },
    ],
    2_000
  );
  const vision = createDemo(
    'vision',
    'Demo - Vision analysis',
    [
      message('demo-vision-user', 'user', 'What do you see in this image?', now - 30_000, {
        imageAttachments: [attachment('demo-vision-image', 'sample.jpg', 'image/jpeg', 4_000_000, demoImage)],
      }),
      message(
        'demo-vision-assistant',
        'assistant',
        'This image shows a black computer keyboard partially revealed through torn cardboard. The warm wood and paper tones contrast with the dark keys, creating a playful “hidden message” effect.',
        now - 28_000
      ),
    ],
    1_000
  );
  const files = createDemo(
    'files',
    'Demo - File analysis',
    [
      message('demo-files-user', 'user', 'Give me a quick summary of this document.', now - 40_000, {
        imageAttachments: [attachment('demo-files-pdf', 'sample.pdf', 'application/pdf', 18_000, demoPdf)],
      }),
      message(
        'demo-files-assistant',
        'assistant',
        'This document is ready to be summarized, searched, or discussed. Attach a PDF, document, or text file in a new chat and ask me what you want to find.',
        now - 38_000
      ),
    ],
    0
  );
  const demos = [reasoning, image, vision, files];
  return {
    threads: demos.map(({ messages: _messages, ...thread }) => thread),
    messages: Object.fromEntries(demos.map(({ id, messages }) => [id, messages])),
  };
};
