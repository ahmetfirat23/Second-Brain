# Deploy to Vercel

Uses your **existing Convex dev deployment** — no separate production Convex.

## Prerequisites

- GitHub (or GitLab/Bitbucket) account
- [Vercel](https://vercel.com) account
- Convex dev deployment (from `npx convex dev`)
- [Clerk](https://clerk.com) account

## 1. Sync Convex functions

Before pushing, ensure your dev deployment has the latest code:

```bash
npx convex dev --once
```

## 2. Push your code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mergen.git
git push -u origin main
```

## 3. Convex environment variables

**Convex Dashboard** → your project → **Settings** → **Environment Variables** (Dev):

| Variable | Value |
|----------|-------|
| `CLERK_JWT_ISSUER_DOMAIN` | From Clerk JWT template (see [SECURITY.md](./SECURITY.md)) |
| `GROK_API_KEY` | Your Grok API key |
| `TMDB_API_KEY` | Your TMDB API key (optional) |

## 4. Configure Clerk

1. [Clerk Dashboard](https://dashboard.clerk.com) → your application
2. Add your Vercel URL to **Allowed redirect URLs** (e.g. `https://your-app.vercel.app`)

## 5. Create Vercel project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Use default Next.js settings (Build Command: `npm run build`)

## 6. Add Vercel environment variables

In Vercel → your project → **Settings** → **Environment Variables**, add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Your Convex deployment URL (from `.env.local` or Convex Dashboard) | Production |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Production |
| `CLERK_SECRET_KEY` | Clerk secret key | Production |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | Production |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | Production |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/brain-dump` | Production |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/brain-dump` | Production |

## 7. Deploy

Click **Deploy**. After each push, run `npx convex dev --once` locally to sync Convex changes, then Vercel will auto-redeploy the frontend.

## 8. Post-deploy

1. Open your Vercel URL (e.g. `https://your-app.vercel.app`)
2. Add this URL in Clerk → Allowed redirect URLs
3. Test sign-in and core flows

## Custom domain (optional)

1. Vercel → your project → **Settings** → **Domains** → add your domain
2. Clerk → add the custom domain to allowed URLs

## Troubleshooting

- **"CLERK_JWT_ISSUER_DOMAIN not set"** — Add it in Convex Dashboard → Environment Variables (Dev)
- **Clerk redirect errors** — Ensure your Vercel URL is in Clerk's allowed redirect URLs
- **Convex functions fail** — Check `GROK_API_KEY` and `TMDB_API_KEY` are set in Convex dev env
