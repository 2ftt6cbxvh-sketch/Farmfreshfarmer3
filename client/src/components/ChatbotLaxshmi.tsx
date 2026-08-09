/**
 * ChatbotLaxshmi — FarmFreshFarmer AI Assistant
 * ================================================
 * Floating bottom-right chat widget powered by Google Gemini Flash.
 * Features:
 *  - Small round icon with "Namaste!" speech bubble
 *  - Full chat window with language switcher (EN / HI / TE)
 *  - Voice input via Web Speech API (SpeechRecognition)
 *  - Text-to-Speech (Listen button) via Web Speech API (SpeechSynthesis)
 *  - "Connect to Human" button → Telegram alert
 *  - Add to cart / Go to checkout actions from AI responses
 *  - Missed queries stored in DB for Admin review
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Mic, MicOff, Volume2, VolumeX, X, Send, Users, ChevronDown, Leaf, ShoppingCart, ExternalLink } from "lucide-react";

/* ─── Types ───────────────────────────────────────────────────── */
type Language = "en" | "hi" | "te";
type MessageRole = "user" | "model";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  action?: string;
  actionData?: any;
  needsHuman?: boolean;
}

const LANG_LABELS: Record<Language, string> = { en: "English", hi: "हिंदी", te: "తెలుగు" };

const WELCOME_MESSAGES: Record<Language, string> = {
  en: "🙏 Namaste! I'm Laxshmi, your FarmFreshFarmer assistant. How can I help you today?\n\nI can help with:\n• Product prices & availability\n• Delivery timings & ETA\n• Order tracking\n• Return & refund policy\n• Adding items to your cart",
  hi: "🙏 नमस्ते! मैं लक्ष्मी हूँ, आपकी FarmFreshFarmer सहायक। आज मैं आपकी कैसे सहायता कर सकती हूँ?\n\nमैं इन चीज़ों में मदद कर सकती हूँ:\n• उत्पाद की कीमतें और उपलब्धता\n• डिलीवरी समय\n• ऑर्डर ट्रैकिंग\n• रिटर्न और रिफंड नीति",
  te: "🙏 నమస్తే! నేను లక్ష్మి, మీ FarmFreshFarmer సహాయకురాలిని. నేను మీకు ఎలా సహాయం చేయగలను?\n\nనేను ఇవి చేయగలను:\n• ఉత్పత్తి ధరలు & అందుబాటు\n• డెలివరీ సమయాలు\n• ఆర్డర్ ట్రాకింగ్\n• రిటర్న్ & రీఫండ్ పాలసీ",
};

const HUMAN_CONNECT_MESSAGES: Record<Language, string> = {
  en: "✅ Our customer support team has been notified! A representative will contact you shortly.",
  hi: "✅ हमारी ग्राहक सेवा टीम को सूचित कर दिया गया है! एक प्रतिनिधि जल्द ही आपसे संपर्क करेगा।",
  te: "✅ మా కస్టమర్ సపోర్ట్ టీమ్‌కు నోటిఫై చేయబడింది! ఒక ప్రతినిధి త్వరలో మీతో సంప్రదిస్తారు.",
};

function getSessionToken(): string {
  const key = "laxshmi_session";
  let token = sessionStorage.getItem(key);
  if (!token) {
    token = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, token);
  }
  return token;
}

function LaxshmiIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="url(#lg1)" />
      <text x="20" y="27" textAnchor="middle" fontSize="18" fill="white">🙏</text>
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#16a34a" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ChatbotLaxshmi() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const sessionToken = getSessionToken();

  const { data: publicSettings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings/public"],
    queryFn: async () => {
      const r = await fetch("/api/settings/public");
      return r.json();
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: { message: string; history: Array<{ role: string; content: string }> }) => {
      const r = await fetch("/api/chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, sessionToken, language }),
      });
      return r.json();
    },
    onSuccess: (data) => {
      const reply: ChatMessage = {
        id: `m_${Date.now()}`,
        role: "model",
        content: data.reply || "I'm here to help!",
        timestamp: new Date(),
        action: data.action,
        actionData: data.actionData,
        needsHuman: data.needsHuman,
      };
      setMessages((prev) => [...prev, reply]);
    },
  });

  const humanMutation = useMutation({
    mutationFn: async (query: string) => {
      const history = messages
        .slice(-6)
        .map((m) => `${m.role === "user" ? "Customer" : "Laxshmi"}: ${m.content}`)
        .join("\n");
      await fetch("/api/chatbot/missed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, sessionToken, language, triggerType: "human_request", chatHistory: history }),
      });
    },
  });

  /* Initialize welcome message on first open */
  useEffect(() => {
    if (isOpen && !hasOpened) {
      setHasOpened(true);
      setMessages([{ id: "welcome", role: "model", content: WELCOME_MESSAGES[language], timestamp: new Date() }]);
    }
  }, [isOpen, hasOpened, language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  /* TTS */
  const speakText = useCallback((text: string, id: string, lang: Language) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (speakingId === id) { setSpeakingId(null); return; }
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*_`#•]/g, "").substring(0, 500));
    utterance.lang = lang === "te" ? "te-IN" : lang === "hi" ? "hi-IN" : "en-IN";
    utterance.rate = 0.9;
    utterance.pitch = 1.05;
    setSpeakingId(id);
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
  }, [speakingId]);

  const stopSpeaking = useCallback(() => { window.speechSynthesis?.cancel(); setSpeakingId(null); }, []);

  /* Voice input */
  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice input is not supported in your browser. Please use Chrome."); return; }
    const recognition = new SR();
    recognition.lang = language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => { setInput(event.results[0][0].transcript); setIsListening(false); };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [language]);

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); setIsListening(false); }, []);

  /* Send message */
  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || sendMutation.isPending) return;
    setInput("");
    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: "user", content: msg, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    const history = messages.filter((m) => m.id !== "welcome").slice(-8).map((m) => ({ role: m.role, content: m.content }));
    sendMutation.mutate({ message: msg, history });
  }, [input, messages, sendMutation]);

  /* Connect to human */
  const handleConnectHuman = useCallback(async () => {
    const lastMsg = [...messages].reverse().find((m) => m.role === "user");
    await humanMutation.mutateAsync(lastMsg?.content || "Customer requested human support");
    const replyContent = HUMAN_CONNECT_MESSAGES[language]
      + (publicSettings?.contact_phone ? `\n📞 ${publicSettings.contact_phone}` : "")
      + (publicSettings?.contact_email ? `\n✉️ ${publicSettings.contact_email}` : "");
    setMessages((prev) => [...prev, { id: `h_${Date.now()}`, role: "model", content: replyContent, timestamp: new Date() }]);
  }, [messages, language, humanMutation, publicSettings]);

  /* Action handler */
  const handleAction = useCallback((action: string, actionData: any) => {
    if (action === "GO_TO_CHECKOUT") window.location.href = "/cart";
    else if (action === "ADD_TO_CART" && actionData?.productId) window.location.href = `/products/${actionData.productId}`;
  }, []);

  return (
    <>
      {/* ── Floating button + bubble (when closed) ── */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-end gap-2 pointer-events-auto">
          {/* Speech bubble */}
          <div
            className="relative bg-white dark:bg-zinc-800 rounded-2xl rounded-br-none px-3 py-2 shadow-2xl border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-gray-700 dark:text-gray-200 cursor-pointer max-w-[160px] select-none"
            onClick={() => setIsOpen(true)}
            style={{ animation: "laxBubble 4s ease-in-out infinite" }}
          >
            🙏 Namaste! How can I help?
            {/* Triangle tail */}
            <div className="absolute -right-2 bottom-3 w-0 h-0"
              style={{ borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: "8px solid white" }}
            />
          </div>
          {/* Round icon */}
          <button
            id="chatbot-open-btn"
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center flex-shrink-0 hover:scale-110 transition-transform active:scale-95"
            style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)" }}
            aria-label="Open Laxshmi AI assistant"
          >
            <LaxshmiIcon size={32} />
          </button>
        </div>
      )}

      {/* ── Chat window (when open) ── */}
      {isOpen && (
        <div
          id="chatbot-window"
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-emerald-200 dark:border-emerald-800"
          style={{ width: "360px", maxWidth: "calc(100vw - 24px)", height: "540px", maxHeight: "calc(100vh - 80px)", backgroundColor: "var(--background)" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)" }}>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <LaxshmiIcon size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-none">Laxshmi</p>
              <p className="text-green-100 text-[10px] mt-0.5">FarmFreshFarmer AI Assistant</p>
            </div>
            {/* Language selector */}
            <div className="relative">
              <button
                id="chatbot-lang-btn"
                onClick={() => setShowLangPicker(!showLangPicker)}
                className="text-white text-[11px] font-semibold flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-1 hover:bg-white/30 transition"
              >
                {language.toUpperCase()}<ChevronDown size={10} />
              </button>
              {showLangPicker && (
                <div className="absolute right-0 top-8 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-emerald-100 dark:border-emerald-800 overflow-hidden z-10 min-w-[120px]">
                  {(Object.keys(LANG_LABELS) as Language[]).map((l) => (
                    <button key={l} onClick={() => { setLanguage(l); setShowLangPicker(false); }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition ${language === l ? "text-emerald-600 font-semibold" : "text-gray-700 dark:text-gray-300"}`}>
                      {LANG_LABELS[l]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button id="chatbot-close-btn" onClick={() => { setIsOpen(false); stopSpeaking(); }}
              className="text-white/80 hover:text-white transition ml-1" aria-label="Close chatbot">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "model" && (
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                    <Leaf size={12} className="text-emerald-600" />
                  </div>
                )}
                <div className="max-w-[78%]">
                  <div className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words leading-relaxed ${
                    msg.role === "user"
                      ? "bg-emerald-600 text-white rounded-tr-sm"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 rounded-tl-sm"
                  }`}>
                    {msg.content}
                  </div>
                  {/* Action buttons */}
                  {msg.action === "GO_TO_CHECKOUT" && (
                    <button onClick={() => handleAction(msg.action!, msg.actionData)}
                      className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold hover:underline">
                      <ShoppingCart size={12} /> Go to Cart & Checkout
                    </button>
                  )}
                  {msg.action === "ADD_TO_CART" && msg.actionData?.productId && (
                    <button onClick={() => handleAction(msg.action!, msg.actionData)}
                      className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold hover:underline">
                      <ExternalLink size={12} /> View Product
                    </button>
                  )}
                  {/* Listen button */}
                  {msg.role === "model" && (
                    <button id={`chatbot-listen-${msg.id}`}
                      onClick={() => speakText(msg.content, msg.id, language)}
                      className={`mt-1 flex items-center gap-1 text-[10px] transition ${speakingId === msg.id ? "text-red-500 font-medium" : "text-gray-400 hover:text-emerald-600"}`}>
                      {speakingId === msg.id ? <><VolumeX size={11} /> Stop</> : <><Volume2 size={11} /> Listen</>}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {/* Loading dots */}
            {sendMutation.isPending && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mr-2 mt-1">
                  <Leaf size={12} className="text-emerald-600" />
                </div>
                <div className="bg-gray-100 dark:bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3.5 flex gap-1.5 items-center">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Connect to Human */}
          <div className="px-3 pb-1.5 flex-shrink-0">
            <button id="chatbot-human-btn" onClick={handleConnectHuman} disabled={humanMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition disabled:opacity-50">
              <Users size={13} />
              {humanMutation.isPending ? "Connecting…" : "Connect to Human Support"}
            </button>
          </div>

          {/* Input bar */}
          <div className="px-3 pb-3 pt-0.5 flex-shrink-0">
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 rounded-2xl px-3 py-2 border border-transparent focus-within:border-emerald-400 transition">
              <input ref={inputRef} id="chatbot-input" type="text" value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={language === "te" ? "ఇక్కడ టైప్ చేయండి..." : language === "hi" ? "यहाँ टाइप करें..." : "Type your message..."}
                className="flex-1 bg-transparent text-sm outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 min-w-0"
              />
              {/* Mic button */}
              <button id="chatbot-mic-btn" onClick={isListening ? stopListening : startListening}
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition ${isListening ? "bg-red-500 text-white animate-pulse" : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"}`}
                aria-label={isListening ? "Stop recording" : "Start voice input"}>
                {isListening ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
              {/* Send button */}
              <button id="chatbot-send-btn" onClick={handleSend} disabled={!input.trim() || sendMutation.isPending}
                className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition disabled:opacity-40"
                aria-label="Send message">
                <Send size={13} />
              </button>
            </div>
            <p className="text-center text-[9px] text-gray-400 mt-1">Powered by Gemini AI · FarmFreshFarmer</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes laxBubble {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(-4px); opacity: 0.9; }
        }
      `}</style>
    </>
  );
}
