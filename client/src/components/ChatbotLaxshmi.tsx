import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Mic, MicOff, Volume2, VolumeX, X, Send, Users, ChevronDown, Leaf, ShoppingCart, ExternalLink, MapPin, LogIn, Lock, Sparkles, Ticket } from "lucide-react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { useCart, useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";

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
  showSignInBox?: boolean;
  products?: Array<{
    id: number;
    name: string;
    price: string;
    unit: string;
    image: string;
    allowInternationalShipping: boolean;
  }>;
}

const LANG_LABELS: Record<Language, string> = { en: "English", hi: "हिंदी", te: "తెలుగు" };

const UI_STRINGS = {
  en: {
    bubbleGreeting: "🙏 Namaste! How can I help?",
    headerSubtitle: "FarmFreshFarmer AI Assistant",
    connectHuman: "Connect to Human Support",
    connecting: "Connecting…",
    listen: "Listen",
    stop: "Stop",
    placeholder: "Type your message...",
    poweredBy: "Powered by Gemini AI · FarmFreshFarmer",
    viewProduct: "View Product",
    goToCart: "Go to Cart & Checkout",
    thinking: "thinking",
  },
  hi: {
    bubbleGreeting: "🙏 नमस्ते! मैं कैसे मदद कर सकती हूँ?",
    headerSubtitle: "FarmFreshFarmer AI सहायक",
    connectHuman: "मानव सहायता से जुड़ें",
    connecting: "जोड़ रहे हैं…",
    listen: "सुनें",
    stop: "रोकें",
    placeholder: "यहाँ टाइप करें...",
    poweredBy: "Gemini AI द्वारा संचालित · FarmFreshFarmer",
    viewProduct: "उत्पाद देखें",
    goToCart: "कार्ट पर जाएं",
    thinking: "सोच रही हूँ",
  },
  te: {
    bubbleGreeting: "🙏 నమస్తే! నేను ఎలా సహాయం చేయగలను?",
    headerSubtitle: "FarmFreshFarmer AI సహాయకురాలు",
    connectHuman: "మానవ సహాయానికి కనెక్ట్ చేయండి",
    connecting: "కనెక్ట్ అవుతోంది…",
    listen: "వినండి",
    stop: "ఆపండి",
    placeholder: "ఇక్కడ టైప్ చేయండి...",
    poweredBy: "Gemini AI ద్వారా · FarmFreshFarmer",
    viewProduct: "ఉత్పత్తి చూడండి",
    goToCart: "కార్ట్కు వెళ్ళండి",
    thinking: "ఆలోచిస్తోంది",
  },
};

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

export function ChatbotLaxshmi() {
  const { add, items } = useCart();
  const { user, setUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  /* Ticket Creation State */
  const [ticketStep, setTicketStep] = useState<"name" | "phone" | "email" | "concern" | null>(null);
  const [ticketData, setTicketData] = useState({ name: "", phone: "", email: "", concern: "" });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const sessionToken = getSessionToken();
  const strings = UI_STRINGS[language];

  const { data: authMethods } = useQuery<{ emailEnabled: boolean; googleEnabled: boolean }>({
    queryKey: ["/api/auth/methods"],
    queryFn: async () => {
      const r = await fetch("/api/auth/methods");
      return r.json();
    },
  });

  const handleAddToCart = useCallback((product: any) => {
    if (!user) {
      setMessages((prev) => [
        ...prev,
        {
          id: `auth_warn_${Date.now()}`,
          role: "model",
          content: "🔒 Sign in required! Please sign in below to add items to your cart and complete your order.",
          showSignInBox: true,
          timestamp: new Date(),
        },
      ]);
      return;
    }
    add(product, 1);
  }, [user, add]);

  const { data: publicSettings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings/public"],
    queryFn: async () => {
      const r = await fetch("/api/settings/public");
      return r.json();
    },
  });

  // Poll live chat session status and messages every 2 seconds when chat is open
  const { data: liveSessionData } = useQuery<{
    status: "bot" | "waiting_for_agent" | "agent_connected" | "closed";
    assignedAgentName?: string | null;
    messages: Array<{ id: string; sender: string; senderName?: string; message: string; createdAt: string }>;
  }>({
    queryKey: ["/api/chatbot/live-session", sessionToken],
    queryFn: async () => {
      const r = await fetch(`/api/chatbot/live-session/${sessionToken}`);
      return r.json();
    },
    enabled: isOpen,
    refetchInterval: 2000,
  });

  // Sync live messages from support agent into chat stream
  useEffect(() => {
    if (liveSessionData?.messages && liveSessionData.messages.length > 0) {
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newLive = liveSessionData.messages
          .filter((lm) => !existingIds.has(lm.id))
          .map((lm) => ({
            id: lm.id,
            role: lm.sender === "customer" ? ("user" as const) : ("model" as const),
            content: lm.sender === "system" ? lm.message : `${lm.senderName ? `[${lm.senderName}] ` : ""}${lm.message}`,
            timestamp: new Date(lm.createdAt),
          }));
        if (newLive.length === 0) return prev;
        return [...prev, ...newLive];
      });
    }
  }, [liveSessionData]);

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
        products: data.products,
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
      const r = await fetch("/api/chatbot/missed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, sessionToken, language, triggerType: "human_request", chatHistory: history }),
      });
      return r.json();
    },
    onSuccess: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: `sys_${Date.now()}`,
          role: "model",
          content: "⏳ Live Support Requested! Our Super Admin & Customer Representatives have been alerted via Telegram. Please stay on this window — a team member will respond shortly.",
          timestamp: new Date(),
        },
      ]);
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

  /* Start Ticket Flow */
  const startTicketFlow = useCallback(() => {
    setTicketData({
      name: user?.name || "",
      phone: user?.phone || "",
      email: user?.email || "",
      concern: "",
    });

    if (user?.name) {
      setTicketStep("phone");
      setMessages((prev) => [
        ...prev,
        {
          id: `t_start_${Date.now()}`,
          role: "model",
          content: `🎫 Let's raise a support ticket! Your name is saved as "${user.name}". Please enter your 10-digit Mobile Number:`,
          timestamp: new Date(),
        },
      ]);
    } else {
      setTicketStep("name");
      setMessages((prev) => [
        ...prev,
        {
          id: `t_start_${Date.now()}`,
          role: "model",
          content: `🎫 Let's raise a support ticket! Please enter your Full Name:`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [user]);

  /* Send message */
  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || sendMutation.isPending) return;
    setInput("");

    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: "user", content: msg, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);

    // Handle ticket flow steps
    if (ticketStep) {
      if (ticketStep === "name") {
        setTicketData((prev) => ({ ...prev, name: msg }));
        setTicketStep("phone");
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { id: `t_s_${Date.now()}`, role: "model", content: `Thanks ${msg}! Now please enter your 10-digit Mobile Number:`, timestamp: new Date() },
          ]);
        }, 300);
        return;
      }
      if (ticketStep === "phone") {
        setTicketData((prev) => ({ ...prev, phone: msg }));
        setTicketStep("email");
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { id: `t_s_${Date.now()}`, role: "model", content: `Got it! Please enter your Email Address:`, timestamp: new Date() },
          ]);
        }, 300);
        return;
      }
      if (ticketStep === "email") {
        setTicketData((prev) => ({ ...prev, email: msg }));
        setTicketStep("concern");
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { id: `t_s_${Date.now()}`, role: "model", content: `Almost done! Please describe your issue or concern in detail:`, timestamp: new Date() },
          ]);
        }, 300);
        return;
      }
      if (ticketStep === "concern") {
        const finalConcern = msg;
        const currentTicketData = { ...ticketData, concern: finalConcern };
        setTicketStep(null);
        try {
          const res = await fetch("/api/support-tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerName: currentTicketData.name,
              customerPhone: currentTicketData.phone,
              customerEmail: currentTicketData.email,
              concern: currentTicketData.concern,
              userId: user?.id,
            }),
          });
          const data = await res.json();
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              {
                id: `t_done_${Date.now()}`,
                role: "model",
                content: `✅ Support Ticket registered successfully!\n\nTicket ID: ${data?.ticket?.ticketId || 'TICK-NEW'}\nStatus: Open\n\nOur team and grievance officers have been notified via Telegram. You can view your live ticket status in your Account profile anytime!`,
                timestamp: new Date(),
              },
            ]);
          }, 300);
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            { id: `t_err_${Date.now()}`, role: "model", content: "Could not submit ticket. Please try again or contact support at +91 79897 93669.", timestamp: new Date() },
          ]);
        }
        return;
      }
    }

    const history = messages.filter((m) => m.id !== "welcome").slice(-8).map((m) => ({ role: m.role, content: m.content }));
    sendMutation.mutate({ message: msg, history });
  }, [input, messages, sendMutation, ticketStep, ticketData, user]);

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
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-auto"
          style={{ animation: 'laxFloatIcon 3.2s ease-in-out infinite' }}>
          {/* Speech bubble */}
          <div className="relative cursor-pointer" onClick={() => setIsOpen(true)}
            style={{ animation: 'laxBounce 3s ease-in-out infinite' }}>
            <div className="bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md rounded-2xl rounded-br-none px-3.5 py-2 text-xs font-semibold text-gray-800 dark:text-gray-100 border border-black/5 dark:border-white/10 max-w-[185px]"
              style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 4px 10px -2px rgba(0, 0, 0, 0.06)' }}>
              {strings.bubbleGreeting}
            </div>
            {/* tail */}
            <div className="absolute -bottom-2 right-4 w-0 h-0"
              style={{ borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid rgba(255,255,255,0.95)' }} />
          </div>
          
          {/* Main button with pulse ring */}
          <div className="relative">
            {/* Animated pulse ring */}
            <div className="absolute inset-0 rounded-2xl"
              style={{ animation: 'laxPulseRing 2.2s ease-out infinite', background: 'linear-gradient(135deg, #FF6B35, #D4145A, #7B2FF7)', borderRadius: '20px' }} />
            
            <button id="chatbot-open-btn" onClick={() => setIsOpen(true)}
              className="relative px-4 py-3 flex items-center gap-2.5 rounded-2xl hover:scale-[1.03] active:scale-95 transition-all duration-300 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #FF6B35 0%, #D4145A 50%, #7B2FF7 100%)',
                animation: 'laxGlow 3s ease-in-out infinite',
                boxShadow: '0 10px 30px -4px rgba(212, 20, 90, 0.35), 0 6px 16px -2px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.3)',
                borderRadius: '20px',
              }}
              aria-label="Open Laxshmi AI assistant">
              <span className="text-2xl leading-none drop-shadow-md animate-pulse">🪔</span>
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white font-sans drop-shadow flex items-center gap-1">
                  Laxshmi <Sparkles size={10} className="text-yellow-300 animate-spin" style={{ animationDuration: '4s' }} />
                </span>
                <span className="text-[9px] font-bold text-white/80 tracking-wider font-sans">AI Assistant</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── Chat window (when open) ── */}
      {isOpen && (
        <div id="chatbot-window"
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-black/10 dark:border-purple-900/40"
          style={{ 
            width: '360px', maxWidth: 'calc(100vw - 24px)', height: '540px', maxHeight: 'calc(100vh - 80px)',
            animation: 'laxSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.18), 0 10px 25px -5px rgba(212, 20, 90, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)',
          }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #D4145A 50%, #7B2FF7 100%)' }}>
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <span style={{ fontSize: '20px' }}>🪔</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-none">Laxshmi</p>
              <p className="text-white/80 text-[10px] mt-0.5">{strings.headerSubtitle}</p>
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
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition ${language === l ? "text-purple-600 font-semibold" : "text-gray-700 dark:text-gray-300"}`}>
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

          {/* Live Support Status Banner */}
          {liveSessionData?.status === "waiting_for_agent" && (
            <div className="bg-amber-500 text-white text-[11px] font-bold px-3 py-1.5 flex items-center justify-between animate-pulse flex-shrink-0">
              <span>⏳ Waiting for Live Representative...</span>
              <span className="text-[9px] opacity-90 font-mono">Telegram Alert Sent</span>
            </div>
          )}
          {liveSessionData?.status === "agent_connected" && (
            <div className="bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 flex items-center justify-between flex-shrink-0">
              <span>🟢 Live Chat: {liveSessionData.assignedAgentName || "Support Representative"}</span>
              <span className="text-[9px] opacity-90 font-mono font-normal">Active</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "model" && (
                  <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mr-2 flex-shrink-0 mt-1"
                    style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #D4145A 50%, #7B2FF7 100%)' }}>
                    <span style={{ fontSize: '12px' }}>🪔</span>
                  </div>
                )}
                <div className="max-w-[78%]">
                  <div className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words leading-relaxed ${
                    msg.role === "user"
                      ? "text-white rounded-tr-sm"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 rounded-tl-sm"
                  }`}
                  style={msg.role === "user" ? { background: 'linear-gradient(135deg, #D4145A, #7B2FF7)' } : {}}
                  >
                    {msg.content}
                  </div>
                  {/* Interactive Product Cards */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {msg.products.map((p) => {
                        const inCartQty = (items || []).find((i: any) => (i?.product?.id ?? i?.productId ?? i?.id) === p.id)?.quantity || 0;
                        return (
                          <div key={p.id} className="flex items-center gap-2.5 p-2 bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-md transition hover:border-purple-300">
                            {p.image ? (
                              <img src={p.image} alt={p.name} className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 font-bold text-xs flex-shrink-0">
                                🌿
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">₹{p.price}</span>
                                <span className="text-[10px] text-gray-400">/ {p.unit}</span>
                              </div>
                              <div className="mt-0.5">
                                {!p.allowInternationalShipping ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[9px] font-bold rounded-md">
                                    📍 Local Only
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[9px] font-bold rounded-md">
                                    ⚡ Express Delivery
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleAddToCart(p)}
                              className={`h-7 px-2 text-[11px] font-bold gap-1 transition ${
                                inCartQty > 0
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                  : "bg-purple-600 hover:bg-purple-700 text-white"
                              }`}
                            >
                              <ShoppingCart size={11} />
                              {inCartQty > 0 ? `✓ ${inCartQty}` : "+ Add"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Inline Sign-In Box */}
                  {msg.showSignInBox && (
                    <GoogleOAuthProvider clientId="983416661519-hd22kfa2kc02hnh5plea83bckfej3o95.apps.googleusercontent.com">
                      <div className="mt-2.5 p-3 bg-card border border-purple-300 dark:border-purple-800 rounded-2xl shadow-lg space-y-2.5 text-center">
                        <div className="flex items-center justify-center gap-1 text-xs font-bold text-foreground">
                          <Lock size={13} className="text-emerald-500" /> Sign In Required
                        </div>
                        <div className="flex flex-col items-center justify-center gap-2">
                          <GoogleLogin
                            onSuccess={async (credentialResponse) => {
                              if (!credentialResponse.credential) return;
                              try {
                                const res = await fetch("/api/auth/google", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ idToken: credentialResponse.credential, platform: "web" }),
                                });
                                const data = await res.json();
                                if (data.accessToken) localStorage.setItem("accessToken", data.accessToken);
                                setUser(data.user || data);
                                setMessages((prev) => [
                                  ...prev,
                                  { id: `auth_ok_${Date.now()}`, role: "model", content: "✨ Signed in successfully! You can now add items to your cart.", timestamp: new Date() },
                                ]);
                              } catch (e) {
                                window.location.href = "/login";
                              }
                            }}
                            onError={() => { window.location.href = "/login"; }}
                          />
                          {authMethods?.emailEnabled !== false && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { window.location.href = "/login"; }}
                              className="w-full text-xs font-bold gap-1 h-8"
                            >
                              ✉️ Sign In with Email / OTP
                            </Button>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight pt-2 border-t border-card-border/80">
                          By signing in you agree to all our{" "}
                          <a href="/terms" target="_blank" className="text-emerald-500 font-bold underline hover:text-emerald-400">
                            Legal Terms &amp; Conditions, and all other policies. To read click here.
                          </a>
                        </p>
                      </div>
                    </GoogleOAuthProvider>
                  )}
                  {/* Action buttons */}
                  {msg.action === "GO_TO_CHECKOUT" && (
                    <button onClick={() => handleAction(msg.action!, msg.actionData)}
                      className="mt-1.5 flex items-center gap-1.5 text-xs text-purple-600 font-semibold hover:underline">
                      <ShoppingCart size={12} /> {strings.goToCart}
                    </button>
                  )}
                  {msg.action === "ADD_TO_CART" && msg.actionData?.productId && (
                    <button onClick={() => handleAction(msg.action!, msg.actionData)}
                      className="mt-1.5 flex items-center gap-1.5 text-xs text-purple-600 font-semibold hover:underline">
                      <ExternalLink size={12} /> {strings.viewProduct}
                    </button>
                  )}
                  {/* Listen button */}
                  {msg.role === "model" && (
                    <button id={`chatbot-listen-${msg.id}`}
                      onClick={() => speakText(msg.content, msg.id, language)}
                      className={`mt-1 flex items-center gap-1 text-[10px] transition ${speakingId === msg.id ? "text-red-500 font-medium" : "text-gray-400 hover:text-purple-600"}`}>
                      {speakingId === msg.id ? <><VolumeX size={11} /> {strings.stop}</> : <><Volume2 size={11} /> {strings.listen}</>}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {/* Loading dots */}
            {sendMutation.isPending && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full flex items-center justify-center mr-2 mt-1"
                  style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #D4145A 50%, #7B2FF7 100%)' }}>
                  <span style={{ fontSize: '12px' }}>🪔</span>
                </div>
                <div className="bg-gray-100 dark:bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3.5 flex gap-1.5 items-center">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#7B2FF7', animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Action Buttons Bar (Ticket + Human Support) */}
          <div className="px-3 pb-1.5 flex gap-2 flex-shrink-0">
            <button id="chatbot-ticket-btn" onClick={startTicketFlow}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition">
              <Ticket size={12} />
              Raise a Ticket
            </button>

            <button id="chatbot-human-btn" onClick={handleConnectHuman} disabled={humanMutation.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl border border-purple-200 dark:border-purple-800 text-[11px] font-bold text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition disabled:opacity-50">
              <Users size={12} />
              {humanMutation.isPending ? strings.connecting : strings.connectHuman}
            </button>
          </div>

          {/* Input bar */}
          <div className="px-3 pb-3 pt-0.5 flex-shrink-0">
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 rounded-2xl px-3 py-2 border border-transparent focus-within:border-purple-400 transition">
              <input ref={inputRef} id="chatbot-input" type="text" value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={strings.placeholder}
                className="flex-1 bg-transparent text-sm outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 min-w-0"
              />
              {/* Mic button */}
              <button id="chatbot-mic-btn" onClick={isListening ? stopListening : startListening}
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition ${isListening ? "bg-red-500 text-white animate-pulse" : "text-gray-400 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30"}`}
                aria-label={isListening ? "Stop recording" : "Start voice input"}>
                {isListening ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
              {/* Send button */}
              <button id="chatbot-send-btn" onClick={handleSend} disabled={!input.trim() || sendMutation.isPending}
                className="flex-shrink-0 w-7 h-7 rounded-full text-white flex items-center justify-center hover:opacity-90 transition disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #D4145A, #7B2FF7)' }}
                aria-label="Send message">
                <Send size={13} />
              </button>
            </div>
            <p className="text-center text-[9px] text-gray-400 mt-1">{strings.poweredBy}</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes laxGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(212,20,90,0.4), 0 0 40px rgba(123,47,247,0.2); }
          50% { box-shadow: 0 0 30px rgba(255,107,53,0.6), 0 0 60px rgba(212,20,90,0.4); }
        }
        @keyframes laxPulseRing {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes laxSlideUp {
          from { transform: translateY(20px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes laxBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes laxFloatIcon {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(2deg); }
        }
      `}</style>
    </>
  );
}
