"use client";

import { useConvexAuth } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

/**
 * Waits for Convex auth to be ready before rendering children.
 * Prevents Convex queries from running before the Clerk token is passed.
 */
export function ConvexAuthGuard({ children }: { children: ReactNode }) {
  const { isLoaded, isAuthenticated } = useConvexAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  useEffect(() => {
    if (isLoaded && !isAuthenticated && !isAuthPage) {
      router.replace("/sign-in");
    }
  }, [isLoaded, isAuthenticated, isAuthPage, router]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-[hsl(0_0%_4%)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(263_90%_65%)] border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
