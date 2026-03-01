"use client";

import { CmdKSearch } from "@/components/layout/cmd-k-search";
import { MovieChat } from "@/components/chat/movie-chat";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileHeader } from "@/components/layout/mobile-header";
import { AppProgressBar } from "next-nprogress-bar";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { ArrowUp } from "lucide-react";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const [cmdKOpen, setCmdKOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
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

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    function onScroll() { setShowScrollTop(el!.scrollTop > 300); }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
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
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader onCmdK={() => setCmdKOpen(true)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          {children}
        </main>
      </div>
      <BottomNav />
      <CmdKSearch open={cmdKOpen} onClose={() => setCmdKOpen(false)} />
      <MovieChat />
      <button
        onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Scroll to top"
        className={`fixed bottom-[72px] right-[56px] z-40 w-8 h-8 rounded-full bg-[hsl(0_0%_16%)] hover:bg-[hsl(0_0%_22%)] border border-[hsl(0_0%_28%)] shadow-lg flex items-center justify-center text-[hsl(0_0%_68%)] hover:text-white transition-all duration-200 lg:bottom-5 lg:left-auto lg:right-[72px] lg:w-9 lg:h-9 ${
          showScrollTop ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        <ArrowUp className="w-4 h-4" />
      </button>
      {toaster}
    </div>
  );
}
