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
      message(
        'demo-formatting-user',
        'user',
        'Can you show me the formatting and code features you support?',
        now - 6_000
      ),
      message(
        'demo-formatting-assistant',
        'assistant',
        `## Formatting showcase

You can use **bold text**, *italics*, and \`inline code\` in a response.

> A short quote can highlight an important idea without interrupting the flow.

Here is a useful checklist:

- Headings and paragraphs
- Ordered and unordered lists
- Links and inline code

Run this command in your terminal:

\`\`\`bash
pnpm --filter client run typecheck
\`\`\`

\`src/example.ts\`
\`\`\`ts
type Greeting = {
  message: string;
};

const greeting: Greeting = { message: 'Hello, PolyChat!' };
console.log(greeting.message);
\`\`\`

| Feature | Supported |
| --- | :---: |
| Markdown | Yes |
| Tables | Yes |
| Code blocks | Yes |

That gives you a quick view of the main rich message formats available in the chat.`,
        now - 4_000,
        {
          reasoning:
            'I will group the examples by the kinds of content the renderer supports: text styles, block elements, commands, code, and tabular data. This keeps the demo easy to scan while exercising each renderer path.',
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
        'This is an image and extracted text of a standard sample PDF file used for testing purposes.\n\nIt contains:\n* A title: "Sample PDF"\n* A subtitle: "This is a simple PDF file. Fun fun fun."\n* Placeholder text: Standard "Lorem ipsum" dummy text, which is commonly used in publishing and graphic design to demonstrate the visual form of a document without relying on meaningful content.',
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
