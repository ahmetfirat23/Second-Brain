# Second Brain

A personal knowledge management app with AI-powered organization. Sign in to access your brain dumps, watch list, deadlines, vault, flashcards, and goals.

## Setup

```bash
npm install
```

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Where to get |
|----------|--------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) → API Keys |
| `CLERK_SECRET_KEY` | Same |
| `NEXT_PUBLIC_CONVEX_URL` | After `npx convex dev` (or Convex Dashboard) |
| `GROK_API_KEY` | [x.ai Console](https://console.x.ai) |
| `TMDB_API_KEY` | [TMDB Settings](https://www.themoviedb.org/settings/api) (optional, for movie metadata) |

Then:

```bash
npx convex dev
```

In a separate terminal:

```bash
npm run dev
```

Open http://localhost:3000. Sign in with Clerk (or create an account if sign-ups are enabled).

## Modules

| Tab | Description |
|-----|-------------|
| **Brain Dump** | Paste messy thoughts → AI organizes into other tabs |
| **Watch List** | Drag-and-drop grid of shows/movies/anime (TMDB posters) |
| **Tracker** | Deadline table — rows turn red when ≤7 days away |
| **The Vault** | URL list with bulk-paste, urgency bands |
| **Knowledge Base** | SM-2 flashcards with KaTeX LaTeX support |
| **Goals** | Track objectives with status and size |
| **Daily Todos** | Date-based to-do list (resets daily) |
| **API Usage** | Monitor Grok API costs |

## Keyboard Shortcuts

- `Cmd+K` / `Ctrl+K` — Global search across all modules
- `Space` / `F` — Flip flashcard
- `1` / `2` / `3` / `4` — Rate flashcard (Forgot/Hard/Good/Easy)

## LaTeX in Knowledge Base

Use standard LaTeX syntax in flashcard fields:
- Inline: `$O(n \log n)$`
- Block: `$$\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$$`

## Deploy to Vercel

See [DEPLOY.md](./DEPLOY.md) for step-by-step instructions.
