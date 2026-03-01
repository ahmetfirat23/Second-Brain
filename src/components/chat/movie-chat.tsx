"use client";

import { sendMovieChatMessage, type ChatMessage } from "@/actions/movie-chat";
import { api } from "../../../convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Maximize2, Minimize2, MessageCircle, Minus, Send, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

const WELCOME = "Ne izleyelim? Listene bakıp önerebilirim, ya da listede uygun bir şey yoksa başka bir şey önerebilirim. Nasıl hissediyorsun?";

const CHAT_SIZES = { normal: { w: 340, h: 420 }, large: { w: 500, h: 680 } } as const;
const STORAGE_KEY = "movie-chat-history";

export function MovieChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [watchFilterCategory, setWatchFilterCategory] = useState<string>("all");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showSettings, setShowSettings] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chatCtx = useQuery(api.chatContext.getSettings);
  const setAutoIncludeEnabled = useMutation(api.chatContext.setAutoIncludeEnabled);
  const setIncludeRatings = useMutation(api.chatContext.setIncludeRatings);
  const setUseLimitMode = useMutation(api.chatContext.setUseLimitMode);
  const setAiPreferences = useMutation(api.chatContext.setAiPreferences);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [messages]);

  useEffect(() => {
    function onFilter(e: CustomEvent<{ category: string }>) {
      setWatchFilterCategory(e.detail.category ?? "all");
    }
    window.addEventListener("watch-list-filter", onFilter as EventListener);
    return () => window.removeEventListener("watch-list-filter", onFilter as EventListener);
  }, []);

  useEffect(() => {
    function onInsert(e: CustomEvent<{ text: string }>) {
      const text = e.detail?.text;
      if (text) {
        setOpen(true);
        setInput((prev) => (prev ? `${prev}\n\n${text}\n` : `${text}\n`));
        setTimeout(() => {
          const el = inputRef.current;
          if (!el) return;
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }, 150);
      }
    }
    window.addEventListener("movie-chat-insert", onInsert as EventListener);
    return () => window.removeEventListener("movie-chat-insert", onInsert as EventListener);
  }, []);

  function handleClear() {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  function scrollToBottom() {
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isPending) return;

    setInput("");
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    scrollToBottom();

    startTransition(async () => {
      const history = [...messages];  // server action appends the current message itself
      const { content, error } = await sendMovieChatMessage(text, history, watchFilterCategory !== "all" ? watchFilterCategory : undefined);
      if (error) {
        setMessages((m) => [...m, { role: "assistant", content: `Hata: ${error}` }]);
      } else if (content) {
        setMessages((m) => [...m, { role: "assistant", content }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: "Bir yanıt alınamadı. Tekrar deneyin." }]);
      }
      scrollToBottom();
    });
  }

  return (
    <>
      {/* Floating button — right on mobile, hidden when chat open */}
      <button
        onClick={() => { setOpen((o) => !o); if (!open) setTimeout(() => inputRef.current?.focus(), 200); }}
        className={`fixed bottom-[72px] right-4 z-40 w-10 h-10 rounded-full bg-[hsl(263_90%_60%)] hover:bg-[hsl(263_90%_65%)] shadow-lg shadow-[hsl(263_90%_60%/0.3)] flex items-center justify-center text-white transition-all hover:scale-105 lg:bottom-5 lg:w-12 lg:h-12 ${open ? "hidden lg:flex" : ""}`}
        title="Movie chat"
      >
        <MessageCircle className="w-4 h-4 lg:w-5 lg:h-5" />
      </button>

      {/* Mobile backdrop — closes chat when tapping outside */}
      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-black/70"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-[76px] right-4 z-50 flex flex-col rounded-xl border border-[hsl(0_0%_28%)] bg-[hsl(0_0%_10%)] shadow-2xl overflow-hidden transition-all duration-200 lg:bottom-20 lg:right-5 lg:z-40"
          style={{
            width: enlarged ? CHAT_SIZES.large.w : CHAT_SIZES.normal.w,
            height: enlarged ? CHAT_SIZES.large.h : CHAT_SIZES.normal.h,
            maxWidth: "calc(100vw - 2rem)",
            maxHeight: "calc(100vh - 96px)",
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(0_0%_22%)] bg-[hsl(0_0%_13%)]">
            <span className="text-sm font-medium text-white flex items-center gap-2 min-w-0">
              <MessageCircle className="w-4 h-4 text-[hsl(263_70%_70%)] shrink-0" />
              <span className="truncate">Ne izleyelim?</span>
              {watchFilterCategory !== "all" && (
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-violet-900/40 text-violet-300 border border-violet-700/40">
                  {watchFilterCategory}
                </span>
              )}
            </span>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={handleClear}
                  className="p-1.5 rounded hover:bg-[hsl(0_0%_20%)] text-[hsl(0_0%_68%)] hover:text-red-400"
                  title="Sohbeti temizle"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setEnlarged((e) => !e)}
                className="p-1.5 rounded hover:bg-[hsl(0_0%_20%)] text-[hsl(0_0%_68%)] hover:text-white"
                title={enlarged ? "Küçült" : "Büyüt"}
              >
                {enlarged ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowSettings((s) => !s)}
                  className="p-1.5 rounded hover:bg-[hsl(0_0%_20%)] text-[hsl(0_0%_68%)] hover:text-white"
                  title="Chat context"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
                {showSettings && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-[hsl(0_0%_28%)] bg-[hsl(0_0%_13%)] p-2 shadow-xl">
                      <p className="text-[10px] text-[hsl(0_0%_72%)] mb-2">AI provider</p>
                      <div className="flex gap-2 mb-2">
                        {(["grok", "gpt"] as const).map((p) => (
                          <button
                            key={p}
                            onClick={() => setAiPreferences({ aiProvider: p })}
                            className={`flex-1 px-2 py-1 rounded text-xs font-medium capitalize ${(chatCtx?.aiProvider ?? "gpt") === p ? "bg-[hsl(263_90%_60%)] text-white" : "bg-[hsl(0_0%_12%)] text-[hsl(0_0%_72%)]"}`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      {(chatCtx?.aiProvider ?? "gpt") === "gpt" && (
                        <div className="flex gap-2 mb-2">
                          {(["gpt-5-nano", "gpt-5-mini"] as const).map((m) => (
                            <button
                              key={m}
                              onClick={() => setAiPreferences({ aiProvider: "gpt", aiGptModel: m })}
                              className={`flex-1 px-2 py-1 rounded text-xs font-medium ${(chatCtx?.aiGptModel ?? "gpt-5-nano") === m ? "bg-[hsl(263_90%_60%)] text-white" : "bg-[hsl(0_0%_12%)] text-[hsl(0_0%_72%)]"}`}
                            >
                              {m.includes("nano") ? "Nano" : "Mini"}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-[hsl(0_0%_72%)] mb-2 mt-2">Prompt&apos;a ekle (opsiyonel)</p>
                      <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                        <input
                          type="checkbox"
                          checked={chatCtx?.autoIncludeEnabled ?? false}
                          onChange={(e) => setAutoIncludeEnabled({ enabled: e.target.checked })}
                          className="rounded border-[hsl(0_0%_34%)]"
                        />
                        <span className="text-xs text-[hsl(0_0%_75%)]">İzlediklerim</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                        <input
                          type="checkbox"
                          checked={chatCtx?.includeRatings ?? true}
                          onChange={(e) => setIncludeRatings({ enabled: e.target.checked })}
                          disabled={!chatCtx?.autoIncludeEnabled}
                          className="rounded border-[hsl(0_0%_34%)] disabled:opacity-50"
                        />
                        <span className="text-xs text-[hsl(0_0%_75%)]">Skorlar</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={chatCtx?.useLimitMode ?? false}
                          onChange={(e) => setUseLimitMode({ enabled: e.target.checked })}
                          className="rounded border-[hsl(0_0%_34%)]"
                        />
                        <span className="text-xs text-[hsl(0_0%_75%)]">Limit modu (yorumlu son 15)</span>
                      </label>
                      <p className="text-[9px] text-[hsl(0_0%_68%)]">Watchlist + taste her zaman dahil.</p>
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[hsl(0_0%_20%)] text-[hsl(0_0%_68%)] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-[hsl(263_90%_60%/0.15)] border border-[hsl(263_90%_60%/0.25)] px-4 py-2.5">
                    <p className="text-sm text-[hsl(0_0%_85%)] leading-relaxed">{WELCOME}</p>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
                      m.role === "user"
                        ? "bg-[hsl(263_90%_60%/0.2)] border border-[hsl(263_90%_60%/0.3)] rounded-tr-sm"
                        : "bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_24%)] rounded-tl-sm"
                    }`}
                  >
                    <p className="text-sm text-[hsl(0_0%_90%)] leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
                  </div>
                </div>
              ))
            )}
            {isPending && (
              <div className="flex justify-start">
                <div className="rounded-xl rounded-tl-sm bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_24%)] px-4 py-2.5">
                  <span className="text-sm text-[hsl(0_0%_72%)]">Düşünüyorum…</span>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="p-3 border-t border-[hsl(0_0%_22%)]">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ne izleyelim? Hangi tür?"
                disabled={isPending}
                rows={1}
                className="flex-1 bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[hsl(0_0%_64%)] outline-none focus:border-[hsl(263_90%_60%/0.5)] disabled:opacity-50 resize-none max-h-28 overflow-y-auto"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || isPending}
                className="p-2 rounded-lg bg-[hsl(263_90%_60%)] hover:bg-[hsl(263_90%_65%)] disabled:opacity-40 text-white transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
