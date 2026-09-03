# PolyChat

PolyChat is a focused workspace for thinking, creating, and working with AI.

## Features

- **Choose the right model** - Switch between supported language and image models from a single conversation workspace.
- **Tune each thread** - Choose a supported model, assistant profile, response language, and whether to send previous messages as multi-turn context.
- **Use focused profiles** - Switch between Normal, Developer, Snarky Bot, Grammar Corrector, Doctor, Teacher, Historian, Chef, Data Scientist, Legal Advisor, and Custom profiles.
- **Personalize responses** - Save up to 4,000 characters of custom instructions locally and use them with the Custom profile.
- **Inspect usage** - Enable detailed token counts for individual messages and the active thread.
- **Keep your work close** - Store threads, messages, generated images, preferences, and custom instructions locally in your browser.
- **Manage local data** - Rename or delete individual threads, delete all chats, or reset all local data from Settings.
- **Bring your own keys** - Use Google Gemini, OpenAI, Anthropic, Mistral, or DeepSeek keys through a browser-local session key or encrypted vault.
- **Write and read naturally** - Use a responsive TipTap composer, voice input, and speech playback where your browser supports them.
- **Work with rich answers** - Stream Markdown responses with tables, links, lists, syntax-highlighted code, copy actions, and downloadable files.
- **Create visuals** - Generate images from prompts, choose supported image options, and download the results.
- **Stay comfortable anywhere** - Light, dark, and system themes, keyboard-friendly controls, and layouts that adapt from desktop to mobile.

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
- At least one provider key for Gemini, OpenAI, Anthropic, Mistral, or DeepSeek if you are using the server-backed API. Signed-in users can alternatively configure a supported provider key through the browser-local BYOK settings.

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
VITE_API_ENDPOINT=/api
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
OPENROUTER_API_KEY=
```

`CLERK_AUTHORIZED_PARTIES` must be an exact comma-separated list of frontend origins, including protocol and port. For the default local client, use `http://localhost:3000`.

### Production API proxy security

Production requests should use the Pages `/api` proxy, with `VITE_API_ENDPOINT=/api`. Use [`apps/client/.dev.vars.example`](apps/client/.dev.vars.example) as the reference for the Pages Function runtime bindings: set `API_ORIGIN` to the Lambda Function URL and create an encrypted Pages secret named `LAMBDA_PROXY_SECRET`. Set the same random value in `apps/serverless/.env` before running the serverless deploy script. The Lambda rejects requests that do not carry the secret injected by the Pages Function.

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
