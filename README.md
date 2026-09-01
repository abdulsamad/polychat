# PolyChat

PolyChat is a focused workspace for thinking, creating, and working with AI. Compare language models, generate images, save conversations locally, and keep your preferred workflow in one calm, responsive interface.

- **Choose the right model** - Switch between supported language and image models from a single conversation workspace.
- **Keep your work close** - Threads and generated images are stored locally in your browser, so your conversations remain available between sessions.
- **Bring your own keys** - Use supported provider keys through an encrypted, browser-local vault when you want direct provider access.
- **Write and read naturally** - Use a responsive TipTap composer, voice input, and speech playback where your browser supports them.
- **Work with rich answers** - Stream Markdown responses with tables, links, lists, syntax-highlighted code, copy actions, and downloadable files.
- **Create visuals** - Generate images from prompts and download the results for use elsewhere.
- **Stay comfortable anywhere** - Light, dark, and system themes, keyboard-friendly controls, and layouts that adapt from desktop to mobile.

## A considered chat experience

PolyChat keeps the interface out of the way while giving detailed responses room to breathe. Press `Enter` to send and `Shift+Enter` for a new line. The composer grows as you write, then scrolls internally when the message gets longer. Long URLs, tables, code, and images stay contained on smaller screens, while fenced code blocks retain their own useful copy and download controls.

Voice input is available in supported browsers, and responses can be read aloud with browser speech synthesis. Voice playback removes formatting that is not useful when listening, such as code blocks, links, and table markup.

## Built with

PolyChat is a local-first React application backed by a small authenticated API:

- React 19, React Router 7, TypeScript 7, and Tailwind CSS 4
- TipTap, Jotai, shadcn, and Radix UI for the interface
- Clerk for authentication
- Vercel AI SDK 7 with Google, OpenAI, Anthropic, Mistral, and DeepSeek provider integrations
- Hono, Node.js 22, and AWS Lambda for authenticated chat and image requests
- IndexedDB via localForage for local threads, images, and the encrypted BYOK vault

## Browser support

PolyChat works in current evergreen browsers. Voice input depends on browser speech-recognition support, while voice playback depends on the Web Speech API and the voices installed on your device.

## Local Development

The repository is a pnpm/Turborepo monorepo. With Node.js 22+ and pnpm 11 available, install dependencies and start the local app from the repository root:

```bash
pnpm install
pnpm dev
```

The frontend runs at <http://localhost:3000>. The local authenticated API runs at <http://localhost:3001> and is proxied through `/api`.

For local API work, AWS SAM CLI and Docker Desktop are required. Copy the example environment files in `apps/client` and `apps/serverless`, then configure the Clerk values and provider credentials for your environment. Never commit real credentials or `.env` files.
