import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      // Set CLERK_JWT_ISSUER_DOMAIN in Convex Dashboard (Settings → Environment Variables)
      // Get it from Clerk Dashboard → JWT Templates → "convex" template → Issuer URL
      // Dev: https://xxx.clerk.accounts.dev | Prod: https://clerk.yourdomain.com
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
