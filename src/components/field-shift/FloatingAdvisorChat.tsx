"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import { X, Send, RotateCcw, Loader2, BrainCircuit, MessageSquare, Sprout, Droplets, Repeat, AlertTriangle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAppStore, type FullAnalysis } from "@/lib/store";
import { useTranslation } from "@/lib/locale";

interface FloatingAdvisorChatProps {
  analysis?: FullAnalysis | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/**
 * Avatar icon component matching the minimalist sketched companion face.
 */
export function AdvisorAvatarIcon({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden bg-slate-200 flex items-center justify-center shrink-0 select-none shadow-md border border-white/20",
        className
      )}
    >
      <img
        src="/advisor-avatar.png"
        alt="Chash Advisor"
        className="w-full h-full object-cover scale-[1.28]"
        onError={(e) => {
          // Graceful fallback to inline SVG if image file fails to load
          (e.target as HTMLElement).style.display = "none";
        }}
      />
      {/* Inline vector fallback visible if image is hidden */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full pointer-events-none p-1.5"
        fill="none"
        stroke="#18181b"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="50" cy="50" r="46" fill="#e4e4e7" stroke="none" />
        {/* Left Eyebrow */}
        <path d="M 30 38 Q 38 28 46 37" />
        {/* Right Eyebrow */}
        <path d="M 54 37 Q 62 28 70 38" />
        {/* Eyes */}
        <circle cx="38" cy="46" r="3.5" fill="#18181b" stroke="none" />
        <circle cx="62" cy="46" r="3.5" fill="#18181b" stroke="none" />
        {/* Distinct line nose */}
        <path d="M 52 35 C 47 48, 41 62, 35 73 L 49 75" strokeWidth="4.5" />
      </svg>
    </div>
  );
}

export function FloatingAdvisorChat({ analysis }: FloatingAdvisorChatProps) {
  const { locale, t, number } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [unreadAlert, setUnreadAlert] = React.useState(false);

  const advisorChatHistory = useAppStore((s) => s.advisorChatHistory);
  const setAdvisorChatHistory = useAppStore((s) => s.setAdvisorChatHistory);

  const [messages, setMessages] = React.useState<ChatMessage[]>(() => {
    if (advisorChatHistory && advisorChatHistory.length > 0) {
      return advisorChatHistory.map((m: any) => ({
        id: m.id || String(Math.random()),
        role: m.role || "assistant",
        content:
          typeof m.content === "string"
            ? m.content
            : Array.isArray(m.parts)
            ? m.parts.map((p: any) => p.text || "").join("")
            : "",
      }));
    }
    return [];
  });

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Synchronize store
  React.useEffect(() => {
    setAdvisorChatHistory(messages);
  }, [messages, setAdvisorChatHistory]);

  // Flash unread indicator when new analysis completes and chat is closed
  React.useEffect(() => {
    if (analysis && !isOpen) {
      setUnreadAlert(true);
    }
  }, [analysis, isOpen]);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Focus input when opened
  React.useEffect(() => {
    if (isOpen) {
      setUnreadAlert(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Derived summaries from decision engine
  const topRec = analysis?.recommendations?.[0];
  const topCropName = topRec?.crop || "Paddy Rice";
  const topCropScore = topRec?.score !== undefined ? Number(topRec.score).toFixed(1) : "88.4";
  const rainfall = Math.round(analysis?.environment?.rainfall?.annualRainfall ?? 1100);
  const ndviVal = (analysis?.environment?.vegetation?.ndvi ?? 0.58).toFixed(2);
  const soilType = analysis?.field?.soilType || "loamy";
  const dominantRisk = React.useMemo(() => {
    if (!analysis?.risks) return "None";
    const { heatRisk, droughtRisk, floodRisk } = analysis.risks;
    const entries: [string, number][] = [
      ["Heat", heatRisk ?? 0],
      ["Drought", droughtRisk ?? 0],
      ["Flood", floodRisk ?? 0],
    ];
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0]?.[1] > 0 ? entries[0][0] : "None";
  }, [analysis?.risks]);
  const rotationYears = analysis?.rotationPlan?.years || [];
  const summaryText = analysis?.risks?.summary || topRec?.why || "";

  // Send message to Gemini Flash Lite endpoint
  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: "user-" + Date.now(),
      role: "user",
      content: text,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const assistantMsgId = "assistant-" + Date.now();
    let assistantText = "";

    try {
      const res = await fetch("/api/field/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          analysis,
          locale,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to receive response from advisor API");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No readable stream");

      // Add placeholder assistant message
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: "assistant", content: "" },
      ]);

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let newlineIdx: number;

        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          const rawLine = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          const line = rawLine.replace(/\r$/, "").trim();
          if (!line) continue;

          if (line.startsWith("0:")) {
            try {
              const textContent = JSON.parse(line.slice(2));
              if (typeof textContent === "string") {
                assistantText += textContent;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: assistantText } : m
                  )
                );
              }
            } catch {}
          } else if (line.startsWith("data:")) {
            const dataStr = line.replace(/^data:\s*/, "");
            if (dataStr === "[DONE]") continue;

            try {
              const json = JSON.parse(dataStr);
              const delta = json.delta ?? json.text ?? json.textDelta;
              if (json.type === "text-delta" && delta) {
                assistantText += delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: assistantText } : m
                  )
                );
              } else if (json.type === "error") {
                const errText =
                  json.errorText ||
                  json.error ||
                  (locale === "bn-BD"
                    ? "তথ্য প্রক্রিয়া করতে সমস্যা হয়েছে।"
                    : "An error occurred while generating the advice.");
                assistantText = errText;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: assistantText } : m
                  )
                );
              }
            } catch {}
          }
        }
      }

      // Check remaining buffer
      if (buffer.trim()) {
        const line = buffer.replace(/\r$/, "").trim();
        if (line.startsWith("data:")) {
          const dataStr = line.replace(/^data:\s*/, "");
          if (dataStr !== "[DONE]") {
            try {
              const json = JSON.parse(dataStr);
              const delta = json.delta ?? json.text ?? json.textDelta;
              if (json.type === "text-delta" && delta) {
                assistantText += delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: assistantText } : m
                  )
                );
              }
            } catch {}
          }
        }
      }

      // Ensure assistant message is not left empty
      if (!assistantText.trim()) {
        const fallbackText =
          locale === "bn-BD"
            ? "দুঃখিত, কোনো উত্তর পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।"
            : "No response received. Please try asking your question again.";
        assistantText = fallbackText;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: assistantText } : m
          )
        );
      }
    } catch (err: any) {
      console.error("[FloatingAdvisorChat] error:", err);
      const errorContent =
        locale === "bn-BD"
          ? "দুঃখিত, তথ্য প্রক্রিয়া করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
          : "Sorry, I encountered an error processing your query. Please ask again.";

      setMessages((prev) => {
        const hasPlaceholder = prev.some((m) => m.id === assistantMsgId);
        if (hasPlaceholder) {
          return prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: errorContent } : m
          );
        }
        return [
          ...prev,
          {
            id: "err-" + Date.now(),
            role: "assistant",
            content: errorContent,
          },
        ];
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetConversation = () => {
    setMessages([]);
    setAdvisorChatHistory([]);
  };

  // Quick suggestion prompts based on actual decision engine data
  const suggestionPills = analysis
    ? [
        {
          icon: Sprout,
          label: locale === "bn-BD" ? `${topCropName} কেন সেরা?` : `Why is ${topCropName} recommended?`,
          prompt: `Why is ${topCropName} recommended for my field with a ${topCropScore}% score?`,
        },
        {
          icon: Droplets,
          label: locale === "bn-BD" ? "পানি ও সেচ পরামর্শ" : "Irrigation & water advice",
          prompt: `How should I manage irrigation with ~${rainfall} mm annual rainfall and current NDVI ${ndviVal}?`,
        },
        {
          icon: Repeat,
          label: locale === "bn-BD" ? "৪ বছরের পরিক্রমা ব্যাখ্যা" : "Explain 4-year rotation",
          prompt: "Explain how the 4-year crop rotation schedule protects my soil nutrients.",
        },
        {
          icon: AlertTriangle,
          label: locale === "bn-BD" ? "ঝুঁকি প্রশমন" : "Mitigate dominant risk",
          prompt: `What actionable steps should I take to mitigate ${dominantRisk} risk?`,
        },
      ]
    : [
        {
          icon: Sprout,
          label: locale === "bn-BD" ? "অনুকূল ফসল নির্বাচন" : "How to choose best crop?",
          prompt: "How does Chash Orbit evaluate climate and soil data to recommend the best crop?",
        },
        {
          icon: Droplets,
          label: locale === "bn-BD" ? "মাটির আর্দ্রতা পরীক্ষা" : "Soil moisture tips",
          prompt: "What are the best methods to conserve soil moisture in sandy and loamy soils?",
        },
        {
          icon: Repeat,
          label: locale === "bn-BD" ? "ফসল পরিক্রমার নিয়ম" : "Crop rotation rules",
          prompt: "Why should legumes always follow cereals in agricultural crop rotation?",
        },
      ];

  return (
    <>
      {/* ── 1. FLOATING CHAT TRIGGER BUTTON (ALWAYS VISIBLE BOTTOM-RIGHT) ── */}
      <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-50 flex items-center gap-3 sm:bottom-6 sm:right-6">
        {/* Tooltip greeting badge on desktop */}
        {!isOpen && (
          <div
            onClick={() => setIsOpen(true)}
            className="hidden md:flex cursor-pointer items-center gap-2 rounded-full border border-amber-400/30 bg-black/90 px-3.5 py-1.5 text-xs text-amber-200 shadow-2xl backdrop-blur-md transition-all hover:border-amber-400/60 hover:bg-black"
          >
            <Sprout className="size-3.5 text-amber-400" />
            <span className="font-medium">
              {analysis ? t("Ask Chash Advisor") : t("Explore with AI Advisor")}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            "group relative flex size-14 items-center justify-center rounded-full border-2 transition-all duration-300 shadow-[0_10px_35px_rgba(0,0,0,0.7)] active:scale-95",
            isOpen
              ? "border-amber-400 bg-amber-400 text-black rotate-90"
              : "border-white/25 bg-slate-900 hover:border-amber-400 hover:scale-105"
          )}
          aria-label={t("Toggle AI Advisor Chatbot")}
        >
          {isOpen ? (
            <X className="size-6 text-black" />
          ) : (
            <>
              <AdvisorAvatarIcon className="size-full" />
              {/* Online Green Pulsing Indicator */}
              <span className="absolute bottom-0.5 right-0.5 flex size-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-3.5 border-2 border-slate-950 bg-emerald-400"></span>
              </span>
              {/* Unread alert */}
              {unreadAlert && (
                <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-black border-2 border-slate-950 animate-bounce">
                  !
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* ── 2. FLOATING CHAT WINDOW (COMPANY-STYLE POPUP DRAWER) ── */}
      {isOpen && (
        <div
          className="fixed bottom-[calc(9.5rem+env(safe-area-inset-bottom))] right-2 z-50 flex h-[min(520px,calc(100dvh-11rem-env(safe-area-inset-bottom)))] w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-950/95 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-6 duration-300 sm:bottom-24 sm:right-6 sm:h-[520px] sm:max-h-[calc(100vh-7rem)] sm:w-[400px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-black/60 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <AdvisorAvatarIcon className="size-9" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-foreground">
                    {t("Chash Advisor")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-block size-1.5 rounded-full bg-emerald-400"></span>
                  <span className="truncate max-w-[200px]">
                    {analysis ? t("Grounded in NASA Decisions") : t("Crop and field questions")}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetConversation}
                title={t("Restart conversation & view summary")}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title={t("Minimize")}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
              >
                <ChevronDown className="size-4" />
              </button>
            </div>
          </div>

          {/* Messages & Summary Scroll Area */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {/* Top Decision Summary Card */}
            {analysis ? (
              <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-950/30 via-slate-900/60 to-black/80 p-3.5 shadow-lg backdrop-blur-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-amber-300 font-semibold flex items-center gap-1.5">
                    <BrainCircuit className="size-3.5 text-amber-400" />
                    {t("Field Decision Summary")}
                  </span>
                  <Badge variant="outline" className="border-emerald-400/40 bg-emerald-400/10 text-emerald-300 font-mono text-xs">
                    {topCropScore}% match
                  </Badge>
                </div>

                <div className="text-xs text-foreground font-medium">
                  {t("Recommended Crop")}: <span className="text-amber-300 font-bold">{topCropName}</span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {summaryText ||
                    `Optimal for ${soilType} soil with ~${rainfall} mm annual precipitation. Current MODIS vegetation density is ${ndviVal}.`}
                </p>

                {rotationYears.length > 0 && (
                  <div className="pt-1 border-t border-white/10">
                    <div className="text-xs font-mono text-muted-foreground mb-1.5">{t("4-Year Rotation")}:</div>
                    <div className="flex flex-wrap items-center gap-1">
                      {rotationYears.map((yr: any, idx: number) => (
                        <span
                          key={idx}
                          className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-mono text-muted-foreground"
                        >
                          Y{yr.year}: {yr.crop}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-center space-y-1.5">
                <AdvisorAvatarIcon className="size-10 mx-auto" />
                <h4 className="font-semibold text-xs text-foreground">
                  {t("Ask about your field")}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("Pick a location or draw your field, then ask about crops, water or soil.")}
                </p>
              </div>
            )}

            {/* Quick Suggestion Pills */}
            <div className="space-y-1.5">
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground/80 px-1">
                {t("Suggested Questions:")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestionPills.map((pill, idx) => {
                  const Icon = pill.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={loading}
                      onClick={() => handleSend(pill.prompt)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-200 transition-all text-left disabled:opacity-50"
                    >
                      <Icon className="size-3 text-amber-400 shrink-0" />
                      <span className="truncate max-w-[260px]">{pill.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chat Messages */}
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={cn("flex gap-2 items-start", isUser ? "justify-end" : "justify-start")}
                >
                  {!isUser && <AdvisorAvatarIcon className="size-7 mt-0.5" />}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed",
                      isUser
                        ? "bg-gradient-to-r from-amber-400 to-amber-500 text-black font-medium rounded-tr-sm shadow-md"
                        : "border border-white/10 bg-slate-900/90 text-foreground rounded-tl-sm shadow-sm"
                    )}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    ) : m.content ? (
                      <div className="prose prose-invert prose-xs max-w-none space-y-2">
                        <ReactMarkdown
                          components={{
                            h1: ({ node, ...props }) => <h1 className="text-sm font-bold text-amber-200 mt-2 mb-1" {...props} />,
                            h2: ({ node, ...props }) => <h2 className="text-xs font-bold text-amber-200 mt-2 mb-1" {...props} />,
                            h3: ({ node, ...props }) => <h3 className="text-xs font-bold text-foreground mt-1 mb-0.5" {...props} />,
                            p: ({ node, ...props }) => <p className="mb-1 leading-relaxed text-slate-200" {...props} />,
                            ul: ({ node, ...props }) => <ul className="list-disc ml-4 space-y-1 mb-1 text-slate-200" {...props} />,
                            ol: ({ node, ...props }) => <ol className="list-decimal ml-4 space-y-1 mb-1 text-slate-200" {...props} />,
                            li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                            strong: ({ node, ...props }) => <strong className="font-semibold text-amber-300" {...props} />,
                            em: ({ node, ...props }) => <em className="italic text-slate-300" {...props} />,
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 py-0.5 text-muted-foreground">
                        <Loader2 className="size-3 animate-spin text-amber-400" />
                        <span className="text-xs">{t("Advisor is thinking...")}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Thinking / Streaming Indicator */}
            {loading && !messages.some((m) => m.role === "assistant" && !m.content) && (
              <div className="flex gap-2 items-center text-xs text-muted-foreground">
                <AdvisorAvatarIcon className="size-7" />
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-white/10 bg-slate-900/90 px-3 py-2 text-xs">
                  <Loader2 className="size-3 animate-spin text-amber-400" />
                  <span>{t("Reading your field data...")}</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Input Bar */}
          <div className="border-t border-white/10 bg-black/60 p-3 backdrop-blur-md">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("Ask anything about your crops, soil, water...")}
                disabled={loading}
                className="flex-1 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/20 disabled:opacity-50"
              />
              <Button
                type="submit"
                disabled={loading || !input.trim()}
                size="sm"
                className="h-8 bg-gradient-to-r from-amber-400 to-amber-500 font-semibold text-black hover:from-amber-300 hover:to-amber-400 shadow-md px-3 shrink-0"
              >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              </Button>
            </form>

            <div className="mt-1.5 flex items-center justify-between text-xs font-mono text-muted-foreground/60 px-1">
              <span>{t("AI answers use only your field data")}</span>
              <span>{t("NASA POWER · MODIS 250m")}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default FloatingAdvisorChat;
