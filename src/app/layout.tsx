import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import { ClientShell } from "./client-shell";
import { ConvexAuthGuard } from "@/components/auth/convex-auth-guard";
import { ConvexClientProvider } from "@/providers/convex-provider";

export const metadata: Metadata = {
  title: "Mergen, the Second Brain",
  description: "Your personal knowledge base",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Mergen" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "hsl(263, 90%, 65%)",
          colorBackground: "hsl(0, 0%, 7%)",
          colorInputBackground: "hsl(0, 0%, 10%)",
          colorInputText: "white",
          borderRadius: "0.75rem",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        },
        elements: {
          card: "shadow-2xl border border-[hsl(0,0%,14%)]",
          headerTitle: "text-white",
          headerSubtitle: "text-[hsl(0,0%,65%)]",
          formButtonPrimary: "bg-[hsl(263,90%,60%)] hover:bg-[hsl(263,90%,65%)]",
          footerActionLink: "text-[hsl(263,70%,70%)]",
        },
      }}
    >
      <html lang="en" className="dark">
        <body className="bg-[hsl(0_0%_4%)] text-[hsl(0_0%_95%)] antialiased">
          <ConvexClientProvider>
            <ConvexAuthGuard>
              <ClientShell>{children}</ClientShell>
            </ConvexAuthGuard>
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
