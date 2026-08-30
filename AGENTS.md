# PolyChat contributor and agent guide

## Project overview

PolyChat is a pnpm/Turborepo monorepo for a local-first AI chat app.

- `apps/client` is a React 19 + React Router 7 SPA. It uses Jotai for state, TipTap for input, shadcn/Radix UI components, Clerk for auth, and localForage/IndexedDB for thread persistence.
- `apps/serverless` is a Hono API bundled for AWS Lambda with esbuild. It authenticates Clerk JWTs and exposes `/chat` and `/image` endpoints.
- `packages/utils` is the shared package for model metadata, AI SDK-derived model types, languages, variations, and assistant configuration.
- `pnpm-lock.yaml` is the workspace lockfile. Use the globally installed pnpm 11 store and Node.js 22+; do not create or configure a workspace-local pnpm store.

## Before changing code

- Read the relevant route, component/hook, store atom, and shared utility together. Client behavior often crosses those boundaries.
- Check `git status --short` first. Preserve existing staged, unstaged, and unrelated changes.
- Do not edit generated folders such as `apps/client/.react-router`, `build`, `dist`, `.turbo`, or `node_modules`.
- Treat `graphify-out/` as generated local context. It is ignored by Git and must not be staged or committed.
- Do not commit secrets, `.env` files, AWS templates generated from `template.example.yaml`, or local credentials.

## Graphify

- When `graphify-out/graph.json` exists, use `graphify query`, `graphify path`, or `graphify explain` before broad source searches for codebase questions.
- Use `graphify-out/wiki/index.md` for broad navigation when it exists. Read `GRAPH_REPORT.md` only for architecture-wide review or when a scoped command does not provide enough context.
- Run `graphify update .` after modifying code. Keep the generated `graphify-out/` directory local and out of commits.

## Common commands

Run from the repository root:

```bash
pnpm install
pnpm dev                    # client and serverless development tasks
pnpm client:dev             # client only, port 3000
pnpm serverless:dev         # local API
pnpm client:build
pnpm serverless:build
pnpm build
pnpm format
```

TypeScript is pinned to the current v7 line in the client, serverless app, and shared utils package. Keep those compiler versions aligned.

Typecheck each project explicitly:

```bash
pnpm --filter client run typecheck
apps/serverless/node_modules/.bin/tsc -p apps/serverless/tsconfig.json --noEmit
packages/utils/node_modules/.bin/tsc -p packages/utils/tsconfig.json --noEmit
```

The client `typecheck` script runs React Router type generation before TypeScript. TypeScript 7 removed `baseUrl`, so keep path substitutions explicitly relative (`./app/*`, `./.react-router/*`) and do not reintroduce `baseUrl`.

There is no reliable test suite configured in the individual packages currently. For code changes, run the relevant typecheck and build command, then run `git diff --check`.

## Client architecture and rules

- Routes are defined in `apps/client/app/routes.ts`; the main route is `routes/home.tsx` under `layouts/home.tsx`.
- Use `@/*` imports for client application code and `utils` for shared package exports. Keep generated React Router types under `.react-router/types`. Client aliases are defined with relative `paths` entries because TypeScript 7 no longer supports `baseUrl`.
- Jotai atoms live in `apps/client/app/store/index.tsx`. `threadAtom` and `messagesAtom` represent the active conversation.
- Threads and messages are persisted through `apps/client/app/utils/lforage.ts`. Keep thread IDs stable and keep the route `/:threadId` synchronized with the active thread.
- When changing sidebar navigation, avoid nesting interactive elements. `SidebarMenuButton asChild` should wrap a `NavLink` rather than placing an anchor inside a button.
- New/default threads must use a valid `enabledModelsType` model from `utils`; never use an empty string as a model value.
- Keep message unions (`ITextMessage`/`IImageMessage`) and metadata consistent when adding or updating messages.
- Client API calls use `VITE_API_ENDPOINT` and Clerk bearer tokens. Do not expose server-side provider keys in client code.
- Respect the existing responsive/mobile sidebar behavior and close the mobile sidebar after navigation.
- Keep the application shell based on `h-dvh` with `min-h-0` and `min-w-0` through nested flex layouts. Avoid `100vw` and hard-coded viewport height calculations that can cause mobile overflow.
- Keep one visible TipTap editor instance. Synchronize external content only when it differs from the editor, and route non-editor prompt submissions through `useSubmitMessage` instead of clearing and reinserting editor content.
- Preserve the composer keyboard contract: `Enter` submits, `Shift+Enter` inserts a line break, and IME composition must not submit. The editor grows to 4 lines on mobile and 6 lines on larger screens, then scrolls internally while keeping the active caret visible.
- Keep message overflow contained at the component that owns it. Long text and URLs must wrap, while tables and fenced code blocks may scroll horizontally within their own boundaries.
- Preserve the distinction between inline code and fenced code. `CodeBlock` owns syntax highlighting, filename metadata, copy, and download behavior. Download controls must remain keyboard accessible and visible on touch devices.
- Keep thread scrolling scoped to the Radix scroll viewport associated with the active thread. Do not query a global scroll viewport when multiple Radix scroll areas may be mounted.
- Use the semantic color tokens in `app.css` for the main chat surface. Preserve readable contrast across light, dark, and system themes instead of adding isolated hard-coded colors.

## Shared model typing

- `packages/utils/src/types.ts` derives provider-compatible model IDs from the AI SDK provider types.
- `packages/utils/src/models.ts` validates the supported model catalog with `satisfies` while preserving literal model names. Do not replace this with a broad `SupportedModel[]` annotation; that widens the client model union to `string`.
- When adding a model, update the catalog and provider/model routing together. Confirm the name is accepted by the corresponding AI SDK provider type.
- Keep AI SDK core and provider package major versions aligned across `apps/serverless` and `packages/utils`.

## Serverless API rules

- `apps/serverless/src/index.ts` owns the Hono app and route registration.
- Authentication is applied by `authMiddleware` before `/chat` and `/image`. Preserve bearer-token verification and issuer/algorithm checks.
- Controllers should return appropriate HTTP status codes and avoid leaking provider credentials or sensitive internals.
- Provider clients are created in `src/models/index.ts`; model selection and caching belong in `src/models/factory.ts`.
- AI SDK v7 uses current APIs such as `LanguageModel`, `generateImage`, `imageModel`, and `maxOutputTokens`. Keep provider-specific settings under `providerOptions`.
- Serverless aliases (`@controllers/*`, `@middlewares/*`, `@models/*`, `@/index`, and `@types`) are intentionally retained. Their TypeScript 7-compatible `paths` entries point into `./src/*`; do not replace them with broad relative-import rewrites.
- Serverless uses `moduleResolution: "Bundler"` for TypeScript 7 compatibility. Local `ts-node` development uses `TS_NODE_BASEURL=.` with `tsconfig-paths/register` to resolve the same aliases.
- Environment variables are declared in `apps/serverless/env.d.ts` and wired through the SAM template. Add new secrets to the template example and declarations without committing real values.

## Style and implementation expectations

- Use strict TypeScript. Prefer type-only imports where appropriate and preserve existing alias conventions.
- Keep changes focused. Avoid broad dependency upgrades or formatting unrelated files.
- Prefer existing UI primitives and utilities over introducing duplicate components.
- Handle loading, empty, error, mobile, and invalid-route states when changing navigation or data loading.
- Do not silently change model behavior, persistence semantics, authentication, or deployment configuration as part of a UI fix.
- Preserve visible keyboard focus, reduced-motion behavior, and touch-friendly controls when changing interactive chat UI.

## Handoff checklist

Before handing off a change:

1. Run the smallest relevant typechecks and builds.
2. Run `git diff --check`.
3. Review `git status --short` for generated or accidental files.
4. For chat UI changes, check a narrow mobile viewport, long unbroken content, composer scrolling, and code copy/download behavior.
5. Summarize changed files, validation results, and any remaining known issue.

### Don't

- do not use `div`s if we have a component already
- do not add new heavy dependencies without approval
