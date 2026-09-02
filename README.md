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

PolyChat uses Node.js 22+, pnpm 11+, a Clerk development instance, and at least one supported AI provider key for server-backed chat. Native local development uses Hono directly so responses stream exactly as they do in the client. Docker and AWS SAM are not required for this workflow.

### 1. Install prerequisites

- Node.js 22 or newer
- pnpm 11 or newer
- A Clerk development application
- At least one provider key for Gemini, OpenAI, Anthropic, Mistral, or DeepSeek

Install workspace dependencies from the repository root:

```bash
pnpm install
```

### 2. Create local test environment files

Test credentials are deliberately separate from any deployed or personal local configuration. Copy the templates, then edit the ignored files:

```bash
cp apps/client/.env.test.example apps/client/.env.test
cp apps/serverless/.env.test.example apps/serverless/.env.test
```

Configure `apps/client/.env.test`:

```dotenv
VITE_API_ENDPOINT=http://localhost:3001
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
```

Configure `apps/serverless/.env.test`:

```dotenv
PORT=3001
CLERK_ISSUER_BASE_URL=https://your-clerk-instance.clerk.accounts.dev
CLERK_AUTHORIZED_PARTIES=http://localhost:3000

# Supply only the providers you intend to use locally.
GEMINI_API_KEY=your_key
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
MISTRAL_API_KEY=
DEEPSEEK_API_KEY=
```

`CLERK_AUTHORIZED_PARTIES` must be an exact comma-separated list of frontend origins, including protocol and port. For the default local client, use `http://localhost:3000`.

### 3. Start the app

Run the client and streaming local API together:

```bash
pnpm dev:local
```

Open <http://localhost:3000>, sign in through Clerk, and send a message using a model backed by one of the configured provider keys. The client runs on port 3000 and calls the native streaming Hono API on port 3001.

To run each process separately:

```bash
pnpm client:dev:test
pnpm serverless:dev:test
```

### Streaming behavior

`pnpm serverless:dev:test` starts the Hono application through Node's HTTP server. It preserves the `/chat` newline-delimited JSON response stream, so token updates appear in the client as they arrive.

### Optional SAM verification

Use SAM only when validating the Lambda proxy integration. It is not the streaming development server because API Gateway local emulation uses a standard Lambda proxy response.

```bash
cp apps/serverless/env.test.json.example apps/serverless/env.test.json
# Add the same Clerk and provider values as above in JSON form.
pnpm serverless:sam
```

### Troubleshooting

- `401 Unauthorized`: Verify the client publishable key, `CLERK_ISSUER_BASE_URL`, and that the Clerk token's authorized party exactly matches `http://localhost:3000`.
- Browser CORS error: Add the exact client origin to `CLERK_AUTHORIZED_PARTIES`, then restart the local API.
- `Invalid chat request` or provider error: Check that the selected model has a corresponding provider key in `apps/serverless/.env.test`.
- Port already in use: Stop the existing process or run `pnpm kill-ports` before starting again.

Never commit real credentials, `.env.test`, or `env.test.json` files.
