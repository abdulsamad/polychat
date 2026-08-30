# PolyChat

PolyChat is a local-first AI chat application for exploring multiple language and image models. Conversations and generated images are stored in the browser, while authenticated API requests are handled by an AWS Lambda-compatible Hono service.

## Features

- Streamed AI conversations with Markdown, tables, lists, links, and syntax-highlighted code
- Copy or download code blocks, including responses that provide a filename
- Save chats and base64-encoded images locally in IndexedDB
- Download generated images
- Voice input in supported browsers
- High-contrast light, dark, and system themes
- Responsive layouts for desktop and mobile screens
- A TipTap message composer that expands while typing, then becomes scrollable

## Technologies

- pnpm and Turborepo
- TypeScript 7
- React 19 and React Router 7
- Tailwind CSS 4, shadcn, and Radix UI
- TipTap and Jotai
- Clerk authentication
- Hono on Node.js 22 and AWS Lambda
- Vercel AI SDK 7

## Chat interface

- Press `Enter` to send a message and `Shift+Enter` to insert a new line.
- The composer expands to 4 lines on mobile and 6 lines on larger screens. Additional content scrolls inside the editor so the active caret stays visible without moving the entire page.
- Long words, URLs, tables, code blocks, and images are contained within the message width on small screens.
- Fenced code blocks expose copy and download actions. A language or filename supplied by the model is shown in the code header and used for the downloaded file.
- Theme selection supports light, dark, and system preferences with accessible foreground and background contrast.

## Support

Voice input is currently compatible only with Chrome and WebKit-based browsers. The remaining chat features work in current evergreen browsers.

## Installation

To get started with PolyChat, follow these simple steps:

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/abdulsamad/polychat.git
   ```

2. **Install dependencies:**

   ```bash
   cd polychat
   pnpm install
   ```

3. **Configure environment variables:**

   Create `apps/client/.env` and `apps/serverless/.env` from their respective `.env.example` files. Keep the real provider keys and Clerk values local; never commit them.

   For local frontend development, set:

   ```env
   VITE_API_ENDPOINT=/api
   ```

   Vite proxies `/api` to the local SAM API on port `3001`.

## Local development

Install the AWS SAM CLI and Docker Desktop first. Then start both the React frontend and the Lambda API with:

```bash
pnpm dev
```

This starts:

- Frontend: <http://localhost:3000>
- Local SAM/Lambda API: <http://localhost:3001>
- Frontend API proxy: `/api/*` to `http://localhost:3001/*`

The SAM command bundles the serverless app and runs it in the Node.js 22 Lambda container. The local template is `apps/serverless/template.local.yaml`; it is intentionally ignored and is not used for production deployment.

To run only the local Lambda API:

```bash
pnpm serverless:sam
```

After changing serverless source code, restart the command so the bundle is rebuilt. The local API still verifies real Clerk development tokens, so sign in through Clerk in the frontend before calling `/chat` or `/image`.

To stop the development servers, press `Ctrl+C`. If a port is stuck:

```bash
pnpm kill-ports
```

## Validation

Run the relevant checks from the repository root before submitting a change:

```bash
pnpm --filter client run typecheck
pnpm client:build
pnpm serverless:build
git diff --check
```

The codebase knowledge graph is generated locally with `graphify update .`. Its output lives in `graphify-out/` and is intentionally ignored by Git.

<!--
## Demo
<p align="center">
<br/>
<img width="402" height="872" src="readme/demo.gif" alt="polychat demo">
<br/>
</p>
-->
