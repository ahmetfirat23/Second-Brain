# Deploy to Vercel

## Prerequisites

- GitHub (or GitLab/Bitbucket) account
- [Vercel](https://vercel.com) account
- [Convex](https://convex.dev) account (same as dev)
- [Clerk](https://clerk.com) account (same as dev)

## 1. Push your code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/second-brain.git
git push -u origin main
```

## 2. Create Convex production deployment

In your project directory:

```bash
npx convex deploy
```

This creates a production Convex deployment and prints the production URL. You’ll use this for `NEXT_PUBLIC_CONVEX_URL` in Vercel (or let the deploy key set it automatically).

**Convex Dashboard → Settings → Environment Variables** — add for **Production**:

| Variable | Value |
|----------|-------|
| `CLERK_JWT_ISSUER_DOMAIN` | From Clerk JWT template (see [SECURITY.md](./SECURITY.md)) |
| `GROK_API_KEY` | Your Grok API key |
| `TMDB_API_KEY` | Your TMDB API key (optional) |

## 3. Generate Convex deploy key

1. [Convex Dashboard](https://dashboard.convex.dev) → your project → **Settings** → **Deploy Keys**
2. Click **Generate Production Deploy Key**
3. Copy the key (you’ll add it to Vercel)

## 4. Configure Clerk for production

1. [Clerk Dashboard](https://dashboard.clerk.com) → your application
2. Add your Vercel URL to **Allowed redirect URLs** (e.g. `https://your-app.vercel.app`)
3. For production, use **Production** API keys (or keep test keys if you’re fine with that for now)

## 5. Create Vercel project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Next.js |
| **Root Directory** | (leave default) |
| **Build Command** | `npx convex deploy --cmd 'npm run build'` |
| **Output Directory** | (leave default) |

## 6. Add Vercel environment variables

In Vercel → your project → **Settings** → **Environment Variables**, add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `CONVEX_DEPLOY_KEY` | (paste from step 3) | Production |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Production |
| `CLERK_SECRET_KEY` | Clerk secret key | Production |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | Production |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | Production |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/brain-dump` | Production |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/brain-dump` | Production |

`NEXT_PUBLIC_CONVEX_URL` is set automatically by `npx convex deploy` during the build.

## 7. Deploy

Click **Deploy**. Vercel will:

1. Run `npx convex deploy --cmd 'npm run build'`
2. Deploy Convex functions to production
3. Build and deploy the Next.js app

## 8. Post-deploy

1. Open your Vercel URL (e.g. `https://your-app.vercel.app`)
2. Add this URL in Clerk → **Paths** → Allowed redirect URLs
3. Test sign-in and core flows

## Custom domain (optional)

1. Vercel → your project → **Settings** → **Domains** → add your domain
2. Clerk → add the custom domain to allowed URLs
3. Convex and Clerk will work with the new domain

## Troubleshooting

- **"CLERK_JWT_ISSUER_DOMAIN not set"** — Add it in Convex Dashboard → Environment Variables (Production)
- **Clerk redirect errors** — Ensure your Vercel URL is in Clerk’s allowed redirect URLs
- **Convex functions fail** — Check `GROK_API_KEY` and `TMDB_API_KEY` are set in Convex production env
