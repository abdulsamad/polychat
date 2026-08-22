## PolyChat

Welcome to PolyChat, where I'm just exploring LLMs! Below, you'll find information on technologies used, supported browsers, installation instructions, and how to set up the environment.

## Features

- Voice input capability
- Save chats (including images converted to base64) locally in IndexDB
- Download generated images

## Technologies

- Turborepo
- TypeScript
- React Router 7
- shadcn
- Jotai
- Clerk
- Node.js (TypeScript)
- AWS Lambda
- Vercel AI SDK

## Support

Voice input is currently compatible only with Chrome and WebKit-based browsers. Please ensure you are using one of these browsers for the optimal experience.

## Installation

To get started with PolyChat, follow these simple steps:

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/abdulsamad/polychat.git
   ```

2. **Install Dependencies:**

   ```bash
   cd polychat
   pnpm install
   ```

3. **Environment Variables:**
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

This runs:

- Frontend: <http://localhost:3000>
- Local SAM/Lambda API: <http://localhost:3001>
- Frontend API proxy: `/api/*` → `http://localhost:3001/*`

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

<!--
## Demo
<p align="center">
<br/>
<img width="402" height="872" src="readme/demo.gif" alt="polychat demo">
<br/>
</p>
-->
