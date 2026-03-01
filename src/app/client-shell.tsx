"use client";

import { CmdKSearch } from "@/components/layout/cmd-k-search";
import { MovieChat } from "@/components/chat/movie-chat";
import { Sidebar } from "@/components/layout/sidebar";
import { AppProgressBar } from "next-nprogress-bar";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const [cmdKOpen, setCmdKOpen] = useState(false);
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdKOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const toaster = (
    <Toaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: "hsl(0 0% 9%)",
          border: "1px solid hsl(0 0% 14%)",
          color: "hsl(0 0% 90%)",
        },
      }}
    />
  );

  if (isAuthPage) {
    return (
      <>
        {children}
        {toaster}
      </>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppProgressBar height="2px" color="hsl(263,90%,65%)" options={{ showSpinner: false }} shallowRouting />
      <Sidebar onCmdK={() => setCmdKOpen(true)} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <CmdKSearch open={cmdKOpen} onClose={() => setCmdKOpen(false)} />
      <MovieChat />
      {toaster}
    </div>
  );
}
