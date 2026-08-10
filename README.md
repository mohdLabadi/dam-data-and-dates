# Be My Cupid (DAM)

An AI dating matchmaker built with Next.js and the Vercel AI SDK. DAM walks you through a short preference intake, then generates partner profiles you can swipe through and save.

Originally a college project; maintained as a portfolio showcase.

## Features

- Conversational intake form + chat refinement
- AI-generated partner profiles (close / stretch / exploratory matches)
- Optional AI headshots
- In-chat swipe UI to save or pass matches
- Hybrid persistence: works with guest + `localStorage`, or Postgres when configured
- Google Gemini via the AI SDK

## Stack

- Next.js (App Router) + React 19
- AI SDK + `@ai-sdk/google`
- Auth.js (credentials + guest)
- Drizzle ORM + Postgres (optional)
- Tailwind CSS / shadcn-style UI

## Environment

Copy [`.env.example`](.env.example) to `.env.local` and fill in values:

| Variable | Required | Purpose |
|----------|----------|---------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Gemini text + image |
| `AUTH_SECRET` | Yes | Auth.js session cookies |
| `POSTGRES_URL` | No | Chat history, users, saved matches |
| `BLOB_READ_WRITE_TOKEN` | No | File / photo uploads via Vercel Blob |
| `REDIS_URL` | No | Resumable chat streams |
| `NANO_BANANA_IMAGE_MODEL` | No | Override image model id |

Without `POSTGRES_URL`, the app still runs: guests are created locally and saved matches fall back to `localStorage`.

Generate an auth secret if needed:

```bash
openssl rand -base64 32
```

## Running locally

```bash
pnpm install
pnpm db:migrate   # only needed when POSTGRES_URL is set
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated visitors are signed in as guests automatically.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server (Turbopack) |
| `pnpm build` | Migrate (if DB configured) + production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Lint with Ultracite |
| `pnpm test` | Playwright e2e |
| `pnpm db:studio` | Drizzle Studio |

## Notes

- Matchmaking prompts live primarily in `lib/ai/prompts.ts` — treat them as intentional product work.
- Some unused Vercel chatbot template modules remain in the tree; they are not part of the dating flow.
