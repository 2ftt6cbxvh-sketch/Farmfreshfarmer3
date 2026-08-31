import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiGet } from "@/lib/queryClient";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, X, Send, Mic, MicOff, Volume2, VolumeX,
  Trash2, TrendingUp, Boxes, Truck, ShieldCheck,
  CheckCircle2, ArrowRight, Zap, RefreshCw, Key, Bot
} from "lucide-react";

interface CopilotMessage {
  id: string;
  role: "user" | "model" | "assistant";
  content: string;
  actionExecuted?: {
    type: string;
    description: string;
    details?: any;
  };
  suggestedFollowups?: string[];
  timestamp: Date;
}

export function AdminExecutiveCopilotModal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState<"en" | "te" | "hi">("en");
  const [isRecording, setIsRecording] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const isSuperAdmin = Boolean(
    user?.isPrimaryAdmin ||
    user?.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
    user?.id === 1
  );

  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: "welcome_init",
      role: "model",
      content: `Hello **${user?.name || "Admin"}**! I am **Vishnu AI**, powered by Google Gemini AI.\n\nI have real-time access to your live **sales, orders, inventory stock levels, delivery dispatches, customer searches, and security logs**.\n\nHow can I assist your operations right now?`,
      suggestedFollowups: isSuperAdmin
        ? [
            "Give me today's financial summary & GMV",
            "Which crops are running out of stock?",
            "Are there any delayed order dispatches?",
            "Create a 10% flash coupon FRESH10",
          ]
        : [
            "Which crops are running out of stock?",
            "How many orders are placed & packed right now?",
            "What produce is high in demand today?",
          ],
      timestamp: new Date(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Quick Executive Insights
  const { data: insights } = useQuery<{
    todayGmv: string;
    lowStockCount: number;
    outOfStockCount: number;
    activeDispatches: number;
  }>({
    queryKey: ["/api/admin/copilot/quick-insights"],
    queryFn: () => apiGet("/api/admin/copilot/quick-insights"),
    enabled: isOpen,
    staleTime: 30000,
  });

  // Global shortcut: Alt+L or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey && (e.key === "l" || e.key === "L")) || ((e.metaKey || e.ctrlKey) && e.key === "k")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Scroll smoothly to bottom of chat
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Mutation to send message
  const chatMutation = useMutation({
    mutationFn: async (userText: string) => {
      const payloadMessages = [...messages, { id: "temp", role: "user" as const, content: userText, timestamp: new Date() }]
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await apiRequest("POST", "/api/admin/copilot/chat", {
        messages: payloadMessages,
        language,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: "model",
          content: data.reply || "I have analyzed your request.",
          actionExecuted: data.actionExecuted,
          suggestedFollowups: data.suggestedFollowups,
          timestamp: new Date(),
        },
      ]);

      if (data.actionExecuted) {
        toast({
          title: "⚡ Admin Action Executed",
          description: data.actionExecuted.description,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      }
    },
    onError: (err: any) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "model",
          content: `⚠️ **Error executing request**: ${err?.message || "Could not reach Gemini AI."}`,
          timestamp: new Date(),
        },
      ]);
    },
  });

  const handleSend = (text?: string) => {
    const query = (text || input).trim();
    if (!query || chatMutation.isPending) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `user_${Date.now()}`,
        role: "user",
        content: query,
        timestamp: new Date(),
      },
    ]);
    setInput("");
    chatMutation.mutate(query);
  };

  /* Voice Recording */
  const toggleVoice = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Speech not supported in this browser", variant: "destructive" });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsRecording(false);
      handleSend(transcript);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  /* TTS Voice Output */
  const speakText = (text: string, id: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (speakingId === id) {
      setSpeakingId(null);
      return;
    }

    setSpeakingId(id);
    const clean = text
      .replace(/[*_#`~]/g, "")
      .replace(/<<<.*?>>>/g, "")
      .trim();

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-IN";
    utterance.rate = 0.85;
    utterance.pitch = 1.05;

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <>
      {/* ── FLOATING TRIGGER LAUNCHER ── */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="group relative flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-amber-600 via-emerald-600 to-teal-600 text-white font-black text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border border-amber-300/40 cursor-pointer"
          title="Open Vishnu AI (Alt + L / Cmd + K)"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-300" />
          </span>
          <span className="text-base">🪔</span>
          <span className="tracking-wide">Vishnu AI</span>
          <Badge variant="outline" className="bg-black/30 text-amber-200 border-amber-300/30 text-[9px] px-1.5 py-0">
            Alt+L
          </Badge>
        </button>
      </div>

      {/* ── COPILOT MODAL / SLIDE-OVER ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-end p-0 sm:p-6 bg-black/60 backdrop-blur-sm transition-all animate-in fade-in duration-200">
          <div className="w-full sm:w-[460px] h-[92vh] sm:h-[650px] bg-card border-t sm:border border-emerald-500/30 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-foreground">

            {/* ── MODAL HEADER ── */}
            <div className="p-4 bg-gradient-to-r from-emerald-950/90 via-slate-900 to-amber-950/80 border-b border-emerald-500/20 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center text-black font-black text-lg shadow-md shrink-0">
                  🪔
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-extrabold text-sm text-white">Vishnu AI</h3>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[9px] font-black px-1.5 py-0">
                      Gemini 2.5 AI
                    </Badge>
                  </div>
                  <p className="text-[10px] text-gray-300">Operations &amp; Sourcing Intelligence</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Language Picker */}
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  className="bg-black/40 text-[11px] font-bold text-gray-200 border border-white/20 rounded-lg px-2 py-1 outline-none cursor-pointer"
                >
                  <option value="en">English</option>
                  <option value="te">తెలుగు</option>
                  <option value="hi">हिंदी</option>
                </select>

                <button
                  onClick={() => setMessages([messages[0]])}
                  className="text-gray-400 hover:text-red-400 p-1.5 transition rounded-lg hover:bg-white/10"
                  title="Clear conversation"
                >
                  <Trash2 size={15} />
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-white p-1.5 transition rounded-lg hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* ── QUICK INSIGHTS BAR ── */}
            {insights && (
              <div className="px-3 py-2 bg-muted/40 border-b border-card-border flex items-center justify-between text-[11px] font-bold text-muted-foreground shrink-0 overflow-x-auto gap-2">
                {isSuperAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <TrendingUp size={12} className="text-emerald-400" />
                    <span>Today: <strong className="text-emerald-400">{insights.todayGmv}</strong></span>
                  </div>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  <Boxes size={12} className="text-amber-400" />
                  <span>Low Stock: <strong className="text-amber-400">{insights.lowStockCount} items</strong></span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Truck size={12} className="text-sky-400" />
                  <span>Active: <strong className="text-sky-400">{insights.activeDispatches} orders</strong></span>
                </div>
              </div>
            )}

            {/* ── MESSAGES CONTAINER ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "model" && (
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mr-2 shrink-0 text-xs mt-0.5">
                      🪔
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed space-y-2 ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-tr-sm shadow-md"
                        : "bg-muted/80 border border-card-border/80 text-foreground rounded-tl-sm shadow-sm"
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-medium">
                      {msg.content}
                    </div>

                    {/* Action Executed Badge */}
                    {msg.actionExecuted && (
                      <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 font-bold space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Zap size={13} />
                          <span>Action Executed: {msg.actionExecuted.description}</span>
                        </div>
                      </div>
                    )}

                    {/* Suggested Followups */}
                    {msg.suggestedFollowups && msg.suggestedFollowups.length > 0 && (
                      <div className="pt-2 space-y-1 border-t border-card-border/60">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Suggested Follow-ups:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.suggestedFollowups.map((chip, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSend(chip)}
                              className="text-[10px] font-bold py-1 px-2 rounded-lg bg-background border border-card-border hover:border-emerald-500 text-foreground hover:text-emerald-400 transition text-left cursor-pointer"
                            >
                              💡 {chip}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TTS Voice button */}
                    {msg.role === "model" && (
                      <button
                        onClick={() => speakText(msg.content, msg.id)}
                        className="text-[10px] text-muted-foreground hover:text-emerald-400 flex items-center gap-1 pt-1 transition"
                      >
                        {speakingId === msg.id ? <><VolumeX size={11} className="text-red-400" /> Stop</> : <><Volume2 size={11} /> Listen</>}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mr-2 shrink-0 text-xs mt-0.5">
                    🪔
                  </div>
                  <div className="bg-muted/80 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── INPUT BAR ── */}
            <div className="p-3 bg-card border-t border-card-border space-y-2 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`p-2.5 rounded-xl border transition ${
                    isRecording
                      ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse"
                      : "bg-muted border-card-border text-muted-foreground hover:text-foreground"
                  }`}
                  title={isRecording ? "Stop recording" : "Voice input"}
                >
                  {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                </button>

                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={language === "te" ? "విష్ణు AI ని ఏదైనా అడగండి..." : "Ask Vishnu AI anything..."}
                  className="flex-1 text-xs h-10 rounded-xl bg-background border-card-border"
                />

                <Button
                  type="submit"
                  disabled={!input.trim() || chatMutation.isPending}
                  className="h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shrink-0 shadow-md cursor-pointer"
                >
                  <Send size={15} />
                </Button>
              </form>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
