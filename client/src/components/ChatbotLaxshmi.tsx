import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Mic, MicOff, Volume2, VolumeX, X, Send, Users, ChevronDown, Leaf, ShoppingCart, ExternalLink, MapPin, LogIn, Lock, Sparkles, Ticket, Crown, Star, CheckCircle2, ShieldAlert, XCircle, Trash2 } from "lucide-react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { useCart, useAuth } from "@/lib/store";
import { getStarTheme } from "@/lib/starTheme";
import { Button } from "@/components/ui/button";

/* ─── Types ───────────────────────────────────────────────────── */
type Language = "en" | "hi" | "te";
type MessageRole = "user" | "model";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  senderName?: string;
  senderMeta?: {
    isPrimaryAdmin?: boolean;
    isVerified?: boolean;
    starRating?: number;
    experienceRank?: string;
    role?: string;
    customTitle?: string;
  } | null;
  action?: string;
  actionData?: any;
  needsHuman?: boolean;
  requiresLocation?: boolean;
  showSignInBox?: boolean;
  messageType?: string;
  metadata?: any;
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
  en: "🙏 Namaste! I'm Lakshmi, your FarmFreshFarmer assistant. How can I help you today?\n\nI can help with:\n• Product prices & availability\n• Delivery timings & ETA\n• Order tracking\n• Return & refund policy\n• Adding items to your cart",
  hi: "🙏 नमस्ते! मैं लक्ष्मी हूँ, आपकी FarmFreshFarmer सहायक। आज मैं आपकी कैसे सहायता कर सकती हूँ?\n\nमैं इन चीज़ों में मदद कर सकती हूँ:\n• उत्पाद की कीमतें और उपलब्धता\n• डिलीवरी समय\n• ऑर्डर ट्रैकिंग\n• रिटर्न और रिफंड नीति",
  te: "🙏 నమస్తే! నేను లక్ష్మి, మీ FarmFreshFarmer సహాయకురాలిని. నేను మీకు ఎలా సహాయం చేయగలను?\n\nనేను ఇవి చేయగలను:\n• ఉత్పత్తి ధరలు & అందుబాటు\n• డెలివరీ సమయాలు\n• ఆర్డర్ ట్రాకింగ్\n• రిటర్న్ & రీఫండ్ పాలసీ",
};

const HUMAN_CONNECT_MESSAGES: Record<Language, string> = {
  en: "✅ Our customer support team has been notified! A representative will contact you shortly.",
  hi: "✅ हमारी ग्राहक सेवा टीम को सूचित कर दिया गया है! एक प्रतिनिधि जल्द ही आपसे संपर्क करेगा।",
  te: "✅ మా కస్టమర్ సపోర్ట్ టీమ్‌కు నోటిఫై చేయబడింది! ఒక ప్రతినిధి త్వరలో మీతో సంప్రదిస్తారు.",
};

function getSessionToken(userId?: number | null): string {
  if (userId) {
    const key = `lakshmi_user_session_${userId}`;
    let token = localStorage.getItem(key);
    if (!token) {
      token = `sess_u${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem(key, token);
    }
    return token;
  }
  const guestKey = "lakshmi_guest_session";
  let token = sessionStorage.getItem(guestKey) || localStorage.getItem(guestKey);
  if (!token) {
    token = `sess_g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem(guestKey, token);
    localStorage.setItem(guestKey, token);
  }
  return token;
}

function getStorageHistoryKey(userId?: number | null): string {
  return userId ? `fff_chat_history_user_${userId}` : "fff_chat_history_guest";
}

export function ChatbotLakshmi({ customGreeting }: { customGreeting?: string } = {}) {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { add, items, subtotal } = useCart();
  const { user, setUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const sessionToken = useMemo(() => getSessionToken(user?.id), [user?.id]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      let uId: number | null = null;
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u && u.id) uId = u.id;
      }
      const historyKey = getStorageHistoryKey(uId);
      const saved = localStorage.getItem(historyKey) || sessionStorage.getItem(historyKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp || Date.now()),
          }));
        }
      }
    } catch {}
    return [];
  });

  const [input, setInput] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [showFloatingBubble, setShowFloatingBubble] = useState(true);
  const [isFadingBubble, setIsFadingBubble] = useState(false);

  // Auto-disappear speech bubble preview after 5 seconds smoothly on website
  useEffect(() => {
    if (showFloatingBubble && !isFadingBubble) {
      const timer = setTimeout(() => {
        setIsFadingBubble(true);
        setTimeout(() => setShowFloatingBubble(false), 700);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showFloatingBubble, isFadingBubble]);

  /* Ticket Creation State */
  const [ticketStep, setTicketStep] = useState<"name" | "phone" | "email" | "concern" | null>(null);
  const [ticketData, setTicketData] = useState({ name: "", phone: "", email: "", concern: "" });

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastAssistantMessageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
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
  const { data: liveSessionData, refetch: refetchLiveSession } = useQuery<{
    status: "bot" | "waiting_for_agent" | "agent_connected" | "closed";
    assignedAgentName?: string | null;
    customerPermissionGranted?: boolean;
    permissionScope?: string;
    messages: Array<{
      id: string;
      sender: string;
      senderName?: string;
      message: string;
      messageType?: string;
      metadata?: any;
      createdAt: string;
      senderMeta?: {
        isPrimaryAdmin?: boolean;
        isVerified?: boolean;
        starRating?: number;
        experienceRank?: string;
        role?: string;
        customTitle?: string;
      } | null;
    }>;
  }>({
    queryKey: ["/api/chatbot/live-session", sessionToken],
    queryFn: async () => {
      const r = await fetch(`/api/chatbot/live-session/${sessionToken}`);
      return r.json();
    },
    enabled: isOpen,
    refetchInterval: 2000,
  });

  // Customer grants/declines permission mutation
  const respondPermissionMutation = useMutation({
    mutationFn: async (granted: boolean) => {
      const res = await fetch("/api/chatbot/respond-permission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken, granted }),
      });
      return res.json();
    },
    onSuccess: () => {
      refetchLiveSession();
    },
  });

  // Sync live messages from support agent into chat stream without duplication
  useEffect(() => {
    if (liveSessionData?.messages && liveSessionData.messages.length > 0) {
      setMessages((prev) => {
        let updated = [...prev];
        let hasChanged = false;

        for (const lm of liveSessionData.messages) {
          const stringId = String(lm.id);
          const existsById = updated.some((m) => String(m.id) === stringId);
          if (existsById) continue;

          // Check if this live message matches an optimistic user message
          if (lm.sender === "customer") {
            const optIdx = updated.findIndex(
              (m) =>
                m.role === "user" &&
                m.content.trim() === lm.message.trim() &&
                (String(m.id).startsWith("u_") || String(m.id).startsWith("opt_"))
            );
            if (optIdx !== -1) {
              // Upgrade the optimistic ID to the DB ID
              updated[optIdx] = {
                ...updated[optIdx],
                id: stringId,
                timestamp: new Date(lm.createdAt),
              };
              hasChanged = true;
              continue;
            }
          }

          // Otherwise append new message (support rep reply or system announcement)
          updated.push({
            id: stringId,
            role: lm.sender === "customer" ? "user" : "model",
            content: lm.message,
            messageType: lm.messageType || "text",
            metadata: lm.metadata || null,
            senderName: lm.senderName,
            senderMeta: lm.senderMeta || null,
            timestamp: new Date(lm.createdAt),
          });
          hasChanged = true;
        }

        return hasChanged ? updated : prev;
      });
    }
  }, [liveSessionData]);

  const sendMutation = useMutation({
    mutationFn: async (payload: { message: string; history: Array<{ role: string; content: string }> }) => {
      // Client-side cart view detection — bypass chatbot route entirely
      const cartViewPatterns = [
        'what is in my cart', "what's in my cart", 'whats in my cart',
        'show my cart', 'view my cart', 'my cart items', 'cart items',
        'what do i have in cart', 'show cart', 'cart detail', 'cart summary',
      ];
      const lower = payload.message.toLowerCase().trim();
      const isCartView = cartViewPatterns.some(p => lower.includes(p)) ||
        /what.*in.*my.*cart|show.*my.*cart|cart.*detail/i.test(lower);
      
      if (isCartView) {
        // 1. If user has active items in cart context, format and return immediately!
        if (items && items.length > 0) {
          const lines = items.map((it, idx) => `${idx + 1}. ${it.name} (${it.unit}) — ${it.qty} × ₹${Number(it.price).toFixed(0)} = ₹${(it.qty * Number(it.price)).toFixed(0)}`);
          const sub = subtotal || items.reduce((s, i) => s + i.qty * Number(i.price), 0);
          const del = sub >= 499 ? 0 : 30;
          return {
            reply: `🛒 Here is what is in your cart (${items.length} item${items.length > 1 ? 's' : ''}):\n\n` +
              lines.join('\n') +
              `\n\n💰 Subtotal: ₹${sub.toFixed(0)}\n` +
              `🚚 Delivery: ${del === 0 ? 'FREE' : '₹' + del}\n` +
              `✅ Grand Total: ₹${(sub + del).toFixed(0)}`,
            needsHuman: false,
          };
        }

        // 2. Otherwise query backend cart-view with user token & id
        const token = localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
        const queryParams = new URLSearchParams();
        if (user?.id) queryParams.set("userId", String(user.id));
        if (token) queryParams.set("token", token);

        try {
          const cartRes = await fetch(`/api/chatbot/cart-view?${queryParams.toString()}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: "include",
          });
          const data = await cartRes.json();
          if (data && data.reply && !data.requiresLogin) {
            return data;
          }
        } catch (e) {}

        return {
          reply: `Your cart is currently empty! 🛒 Browse our fresh organic products and add your favorites.`,
          needsHuman: false,
        };
      }

      const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
      const r = await fetch("/api/chatbot/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...payload,
          sessionToken,
          language,
          userId: user?.id,
          customerName: user?.name,
        }),
      });
      return r.json();
    },
    onSuccess: (data) => {
      // If live CR is connected, server returns status === 'agent_connected' and reply: null
      // DO NOT add an automated bot reply when CR has taken over the chat!
      if (data?.status === 'agent_connected' || !data?.reply) {
        refetchLiveSession();
        return;
      }

      const reply: ChatMessage = {
        id: `m_${Date.now()}`,
        role: "model",
        content: data.reply,
        timestamp: new Date(),
        action: data.action,
        actionData: data.actionData,
        needsHuman: data.needsHuman,
        requiresLocation: data.requiresLocation,
        products: data.products,
      };
      setMessages((prev) => [...prev, reply]);
      
      if (data.cartAdded) {
        queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
        queryClient.invalidateQueries({ queryKey: ['/api/cart/count'] });
      }
      if (data.speech) {
        speakText(data.reply, reply.id, language);
      }
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "model",
          content: "Sorry, I had trouble processing that. Please try again!",
          timestamp: new Date(),
        },
      ]);
    },
  });

  const humanMutation = useMutation({
    mutationFn: async (query: string) => {
      const history = messages
        .slice(-6)
        .map((m) => `${m.role === "user" ? "Customer" : "Lakshmi"}: ${m.content}`)
        .join("\n");
      const r = await fetch("/api/chatbot/missed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          sessionToken,
          language,
          triggerType: "human_request",
          chatHistory: history,
          userId: user?.id || null,
          customerName: user?.name || undefined,
          phone: user?.phone || undefined,
          email: user?.email || undefined,
        }),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chatbot/live-session/${sessionToken}`] });
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

  /* Customer End Session Mutation */
  const endSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/chatbot/end-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chatbot/live-session/${sessionToken}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/chatbot/my-sessions"] });
      setMessages((prev) => [
        ...prev,
        {
          id: `closed_${Date.now()}`,
          role: "model",
          content: "🏁 You have ended this support session. Thank you for contacting FarmFreshFarmer! To start a new conversation, tap the Clear Chat icon.",
          timestamp: new Date(),
        },
      ]);
    },
  });

  // Load saved chat history when user changes or logs in
  useEffect(() => {
    const historyKey = getStorageHistoryKey(user?.id);
    const saved = localStorage.getItem(historyKey) || sessionStorage.getItem(historyKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp || Date.now()),
          })));
          setHasOpened(true);
          return;
        }
      } catch {}
    }
  }, [user?.id]);

  // Persist messages whenever messages state updates
  useEffect(() => {
    if (messages.length > 0) {
      const historyKey = getStorageHistoryKey(user?.id);
      try {
        localStorage.setItem(historyKey, JSON.stringify(messages.slice(-100)));
        if (!user?.id) {
          sessionStorage.setItem(historyKey, JSON.stringify(messages.slice(-100)));
        }
      } catch {}
    }
  }, [messages, user?.id]);

  /* Initialize welcome message on first open if no history exists */
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setHasOpened(true);
      const nameGreeting = user?.name ? `🙏 Namaste ${user.name}! ` : "🙏 Namaste! ";
      const personalizedWelcome: Record<Language, string> = {
        en: `${nameGreeting}I'm Lakshmi, your FarmFreshFarmer assistant. How can I help you today?\n\nI can help with:\n• Product prices & availability\n• Delivery timings & ETA\n• Order tracking\n• Return & refund policy\n• Adding items to your cart`,
        hi: `${user?.name ? `🙏 नमस्ते ${user.name}! ` : "🙏 नमस्ते! "}मैं लक्ष्मी हूँ, आपकी FarmFreshFarmer सहायक। आज मैं आपकी कैसे सहायता कर सकती हूँ?\n\nमैं इन चीज़ों में मदद कर सकती हूँ:\n• उत्पाद की कीमतें और उपलब्धता\n• डिलीवरी समय\n• ऑर्डर ट्रैकिंग\n• रिटर्न और रिफंड नीति`,
        te: `${user?.name ? `🙏 నమస్తే ${user.name}! ` : "🙏 నమస్తే! "}నేను లక్ష్మి, మీ FarmFreshFarmer సహాయకురాలిని. నేను మీకు ఎలా సహాయం చేయగలను?\n\nనేను ఇవి చేయగలను:\n• ఉత్పత్తి ధరలు & అందుబాటు\n• డెలివరీ సమయాలు\n• ఆర్డర్ ట్రాకింగ్\n• రిటర్న్ & రీఫండ్ పాలసీ`,
      };
      setMessages([{ id: "welcome", role: "model", content: personalizedWelcome[language], timestamp: new Date() }]);
    }
  }, [isOpen, messages.length, language, user]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  /* TTS - Female Voice across website */
  const speakText = useCallback((text: string, id: string, lang: Language) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (speakingId === id) { setSpeakingId(null); return; }

    // Strip emojis and markdown formatting before speaking
    const cleanText = text
      .replace(/([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2B55}]|[\u{200D}]|[\u{FE0F}])/gu, "")
      .replace(/[*_`#•-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 500);

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const langCode = lang === "te" ? "te-IN" : lang === "hi" ? "hi-IN" : "en-IN";
    utterance.lang = langCode;
    utterance.rate = 0.82; // Slower, comfortable, clear speech rate
    utterance.pitch = 1.0; // Natural pitch

    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find((v) =>
      (v.name.includes("Female") || v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Veena") || v.name.includes("Zira") || v.name.includes("Siri") || v.name.includes("Kavya") || v.name.includes("Swara") || v.name.includes("Heera") || v.name.includes("हिन्दी") || v.name.includes("తెలుగు") || v.name.includes("India")) &&
      !v.name.toLowerCase().includes("male")
    ) || voices.find((v) => v.lang.includes("IN") || v.lang.includes(langCode.split("-")[0]));

    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

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

  /* Clear Chat History */
  const handleClearChat = useCallback(() => {
    // 1. Reset messages in UI to new session
    setMessages([]);
    
    // 2. Clear browser storage
    const historyKey = getStorageHistoryKey(user?.id);
    try {
      localStorage.removeItem(historyKey);
      sessionStorage.removeItem(historyKey);
      
      // Also generate a new session token so subsequent chats start as a new conversation session
      if (user?.id) {
        const key = `lakshmi_user_session_${user.id}`;
        localStorage.removeItem(key);
      } else {
        const guestKey = "lakshmi_guest_session";
        sessionStorage.removeItem(guestKey);
        localStorage.removeItem(guestKey);
      }
    } catch {}

    // 3. Refresh user's previous chats in profile tab query if mounted
    queryClient.invalidateQueries({ queryKey: ["/api/chatbot/my-sessions"] });

    // 4. Close any active speech
    stopSpeaking();
  }, [user?.id, stopSpeaking, queryClient]);

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

  const handleDetectLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model' as const,
        content: 'Sorry, your browser does not support location detection. Please enter your PIN code instead.',
        timestamp: new Date(),
      }]);
      return;
    }
    
    // Show loading message
    const loadingId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: loadingId,
      role: 'model' as const,
      content: '📍 Detecting your location...',
      timestamp: new Date(),
    }]);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // Reverse geocode to get pincode using BigDataCloud free API
          const geoRes = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const geoData = await geoRes.json();
          const pincode = geoData?.postcode || '';
          const locality = geoData?.locality || geoData?.city || 'your area';
          
          if (!pincode || !/^\d{6}$/.test(pincode)) {
            setMessages(prev => prev.map(m => m.id === loadingId ? {
              ...m,
              content: `I detected you are near ${locality}, but couldn't get a valid PIN code. Could you please share your 6-digit PIN code so I can check delivery availability?`,
            } : m));
            return;
          }
          
          // Call our ETA endpoint
          const etaRes = await fetch(`/api/chatbot/eta?pincode=${pincode}`);
          const etaData = await etaRes.json();
          
          let etaMessage = '';
          if (etaData.serviceable) {
            const area = etaData.locationArea ? ` (${etaData.locationArea})` : '';
            const rawFeeData = etaData.fee;
            const feeNumData = typeof rawFeeData === 'number' ? rawFeeData
              : typeof rawFeeData === 'string' ? parseFloat(rawFeeData) || 0
              : typeof rawFeeData === 'object' && rawFeeData !== null
                ? Number((rawFeeData as any).amount ?? (rawFeeData as any).value ?? 0)
                : 0;
            const feeStr = feeNumData === 0 ? 'FREE' : `Rs.${feeNumData}`;
            etaMessage = `Great news for PIN ${pincode}${area}! 🚀\n\n` +
              `📦 Estimated Delivery: ${etaData.etaMinutes} minutes\n` +
              `💰 Delivery Fee: ${feeStr}\n` +
              `(Free delivery on orders above Rs.499!)\n\n` +
              `We deliver fresh organic produce daily between 6:00 AM and 10:00 PM.`;
          } else {
            etaMessage = `Sorry! PIN code ${pincode} (${locality}) is currently outside our 30-90 minute instant delivery zone. However, we offer Pan-India shipping for non-perishable items like pickles, sweets, millets, and spices! Would you like to explore those options?`;
          }
          
          setMessages(prev => prev.map(m => m.id === loadingId ? {
            ...m,
            content: etaMessage,
            requiresLocation: false,
          } : m));
          
        } catch (err) {
          setMessages(prev => prev.map(m => m.id === loadingId ? {
            ...m,
            content: 'Could not determine your location. Please enter your 6-digit PIN code to check delivery availability.',
          } : m));
        }
      },
      (error) => {
        setMessages(prev => prev.map(m => m.id === loadingId ? {
          ...m,
          content: 'Location access was denied. Please enter your 6-digit PIN code to check delivery availability!',
        } : m));
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }, []);

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
                content: `✅ Your support ticket has been raised successfully!\n\n📋 Your Ticket ID: ${data?.ticket?.ticketId || 'TICK-NEW'}\n\n⚠️ Please save this Ticket ID — you will need it to track your complaint status.\n\n📍 You can view your ticket status anytime by visiting your Account page (click the account icon at the top right).\n\nOur support team has been notified and will respond within 48 hours. Thank you for reaching out! 🙏`,
                timestamp: new Date(),
              },
              {
                id: (Date.now() + 1).toString(),
                role: 'model' as const,
                content: 'Click below to view your ticket status:',
                timestamp: new Date(),
                action: 'view_tickets',
              }
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
    await humanMutation.mutateAsync(lastMsg?.content || "Customer requested live support assistance");
  }, [messages, humanMutation]);

  /* Action handler */
  const handleAction = useCallback((action: string, actionData: any) => {
    if (action === "GO_TO_CHECKOUT") window.location.href = "/cart";
    else if (action === "ADD_TO_CART" && actionData?.productId) window.location.href = `/products/${actionData.productId}`;
  }, []);

  return (
    <>
      {/* ── Floating button + bubble (when closed) ── */}
      {!isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-auto"
          style={{ animation: 'laxFloat 5s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite' }}
        >
          {/* Animated Speech bubble */}
          {showFloatingBubble && (
            <div
              className={`relative cursor-pointer transition-all duration-700 ${
                isFadingBubble ? 'opacity-0 translate-y-3 scale-90 pointer-events-none' : 'opacity-100 translate-y-0 scale-100'
              }`}
              onClick={() => setIsOpen(true)}
              style={{ animation: isFadingBubble ? 'none' : 'laxBounce 3.5s cubic-bezier(0.45,0.05,0.55,0.95) infinite' }}
            >
              <div
                className="bg-white/96 dark:bg-zinc-800/96 backdrop-blur-xl rounded-2xl rounded-br-none px-3.5 py-2.5 text-xs font-semibold text-gray-800 dark:text-gray-100 border border-black/8 dark:border-white/10 max-w-[210px] flex items-center justify-between gap-2"
                style={{
                  boxShadow: '0 12px 32px -6px rgba(5,150,105,0.18), 0 4px 12px -2px rgba(0,0,0,0.1)',
                }}
              >
                <span>{customGreeting || strings.bubbleGreeting}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFadingBubble(true);
                    setTimeout(() => setShowFloatingBubble(false), 700);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-0.5 shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
              <div
                className="absolute -bottom-2 right-5 w-0 h-0"
                style={{
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderTop: '8px solid rgba(255,255,255,0.96)',
                }}
              />
            </div>
          )}

          {/* Main pill button */}
          <div className="relative" style={{ contain: 'layout style', willChange: 'transform' }}>
            {/* The pill button - hardware accelerated & GPU optimized */}
            <button
              id="chatbot-open-btn"
              onClick={() => setIsOpen(true)}
              className="relative overflow-hidden px-3.5 py-2 flex items-center gap-1.5 rounded-full hover:scale-[1.05] active:scale-95 transition-all duration-300 cursor-pointer shadow-lg will-change-transform"
              style={{
                background: 'linear-gradient(135deg, #14532d 0%, #065f46 50%, #ca8a04 100%)',
                animation: 'laxGlow 6s ease-in-out infinite',
              }}
              aria-label="Open Lakshmi AI assistant"
            >
              {/* Shimmer sweep overlay */}
              <div
                className="absolute inset-0 pointer-events-none rounded-full"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
                  animation: 'laxShimmer 4s ease-in-out infinite 1.5s',
                }}
              />

              {/* Diya icon */}
              <span className="text-lg leading-none drop-shadow relative z-10">🪔</span>

              {/* Single line text */}
              <span className="text-[11px] font-black uppercase tracking-wider text-white font-sans whitespace-nowrap drop-shadow flex items-center gap-1 relative z-10">
                LAKSHMI AI
                <Sparkles
                  size={10}
                  className="text-yellow-300 shrink-0"
                  style={{ animation: 'laxSparklePin 3s ease-in-out infinite' }}
                />
              </span>

              {/* Online badge dot */}
              <span className="w-2 h-2 rounded-full bg-emerald-400 border border-white/60 shrink-0 relative z-10" />
            </button>
          </div>
        </div>
      )}

      {/* ── Chat window (when open) ── */}
      {isOpen && (
        <div id="chatbot-window"
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-black/10 dark:border-emerald-900/40"
          style={{ 
            width: '360px', maxWidth: 'calc(100vw - 24px)', height: '540px', maxHeight: 'calc(100vh - 80px)',
            animation: 'laxSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.18), 0 10px 25px -5px rgba(5, 150, 105, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)',
          }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #14532d 0%, #065f46 50%, #ca8a04 100%)' }}>
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <span style={{ fontSize: '20px' }}>🪔</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-none">Lakshmi AI</p>
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
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition ${language === l ? "text-emerald-600 font-semibold" : "text-gray-700 dark:text-gray-300"}`}>
                      {LANG_LABELS[l]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleClearChat}
              title="Clear Current Chat"
              aria-label="Clear chat"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={() => navigate('/account')}
              title="View Previous Chats & Tickets"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all"
            >
              <Ticket size={14} />
            </button>
            <button id="chatbot-close-btn" onClick={() => { setIsOpen(false); stopSpeaking(); }}
              className="text-white/80 hover:text-white transition ml-1" aria-label="Close chatbot">
              <X size={18} />
            </button>
          </div>

          {/* Live Support Status Banner */}
          {liveSessionData?.status === "waiting_for_agent" && (
            <div className="bg-amber-500 text-white text-[11px] font-bold px-3 py-1.5 flex items-center justify-between animate-pulse flex-shrink-0">
              <span>⏳ Waiting for Live Representative...</span>
              <button
                onClick={() => endSessionMutation.mutate()}
                disabled={endSessionMutation.isPending}
                className="text-[10px] bg-black/20 hover:bg-black/40 px-2 py-0.5 rounded transition text-white"
              >
                Cancel
              </button>
            </div>
          )}
          {liveSessionData?.status === "agent_connected" && (
            <div className="bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 flex items-center justify-between flex-shrink-0">
              <span className="truncate">🟢 Live: {liveSessionData.assignedAgentName || "Representative"}</span>
              <button
                onClick={() => endSessionMutation.mutate()}
                disabled={endSessionMutation.isPending}
                className="text-[10px] bg-red-700/80 hover:bg-red-700 px-2 py-0.5 rounded text-white transition shrink-0 ml-2"
              >
                End Chat
              </button>
            </div>
          )}
          {liveSessionData?.status === "closed" && (
            <div className="bg-slate-700 text-white text-[11px] font-semibold px-3 py-1.5 flex items-center justify-between flex-shrink-0">
              <span>🔒 Support session closed</span>
              <button
                onClick={handleClearChat}
                className="text-[10px] bg-emerald-600 hover:bg-emerald-700 px-2 py-0.5 rounded font-bold transition text-white"
              >
                New Chat 💬
              </button>
            </div>
          )}

          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((msg, index) => (
              <div key={msg.id} ref={index === messages.length - 1 && msg.role === 'model' ? lastAssistantMessageRef : null} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "model" && (
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mr-2 flex-shrink-0 mt-1"
                    style={{ background: 'linear-gradient(135deg, #14532d 0%, #065f46 50%, #ca8a04 100%)' }}>
                    <span style={{ fontSize: '12px' }}>{msg.senderName ? "👤" : "🪔"}</span>
                  </div>
                )}
                <div className="max-w-[85%]">
                  {/* Sender Name & Meta Header for Model / Live Support Messages */}
                  {msg.role === "model" && msg.senderName && (
                    <div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap mb-1 overflow-x-auto text-[11px] font-bold">
                      <span className="text-emerald-700 dark:text-emerald-300 font-extrabold">{msg.senderName}</span>
                      {msg.senderMeta?.isVerified !== false && (
                        <CheckCircle2 size={12} className="text-sky-500 fill-sky-500/20 shrink-0" title="Verified Staff" />
                      )}
                      {msg.senderMeta?.isPrimaryAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 border border-amber-400/40 text-amber-700 dark:text-amber-300 text-[9px] font-black shrink-0">
                          <Crown size={10} className="fill-amber-500 text-amber-500 shrink-0" />
                          <span>Super Admin</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[9px] font-extrabold shrink-0">
                          🏅 {msg.senderMeta?.experienceRank || msg.senderMeta?.customTitle || "Specialist"}
                        </span>
                      )}
                      {(() => {
                        const isPrimary = Boolean(msg.senderMeta?.isPrimaryAdmin);
                        const starNum = isPrimary ? 6 : Math.max(0, Math.min(6, Number(msg.senderMeta?.starRating) ?? 5));
                        const theme = getStarTheme(starNum, true);
                        return (
                          <div className="flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                            {[...Array(starNum)].map((_, i) => (
                              <Star key={i} size={9} fill="currentColor" className={`shrink-0 ${theme.starColor} ${theme.glowClass} ${isPrimary ? 'animate-pulse' : ''}`} />
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Sender Name & Meta Header for Customer / User Messages */}
                  {msg.role === "user" && user && (
                    <div className="flex items-center justify-end gap-1.5 flex-nowrap whitespace-nowrap mb-1 overflow-x-auto text-[11px] font-bold">
                      {(() => {
                        const isSuperAdmin = user.isPrimaryAdmin || user.email?.toLowerCase() === "admin@farmfreshfarmer.com";
                        const isStaff = isSuperAdmin || user.role !== "customer";
                        const starsCount = isSuperAdmin ? 6 : isStaff ? Math.max(0, Math.min(6, Number(user.starRating) ?? 5)) : Math.max(0, Math.min(5, Number(user.customerStars) || 0));
                        const theme = getStarTheme(starsCount, true);

                        return (
                          <>
                            <div className="flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                              {[...Array(starsCount)].map((_, i) => (
                                <Star key={i} size={9} fill="currentColor" className={`shrink-0 ${theme.starColor} ${theme.glowClass} ${starsCount === 6 ? 'animate-pulse' : ''}`} />
                              ))}
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black shrink-0 border ${theme.badgeClass}`}>
                              {isSuperAdmin ? <Crown size={10} className="shrink-0" /> : null}
                              <span>{isSuperAdmin ? "Super Admin" : isStaff ? "Staff" : `${starsCount}★ Tier`}</span>
                            </span>
                          </>
                        );
                      })()}
                      <span className="text-emerald-300 font-extrabold">{user.name}</span>
                    </div>
                  )}
                  <div className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words leading-relaxed ${
                    msg.role === "user"
                      ? "text-white rounded-tr-sm"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 rounded-tl-sm"
                  }`}
                  style={msg.role === "user" ? { background: 'linear-gradient(135deg, #065f46, #ca8a04)' } : {}}
                  >
                    {msg.content}
                  </div>
                  {/* Interactive Product Cards */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {msg.products.map((p) => {
                        const inCartQty = (items || []).find((i: any) => (i?.product?.id ?? i?.productId ?? i?.id) === p.id)?.quantity || 0;
                        return (
                          <div key={p.id} className="flex items-center gap-2.5 p-2 bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-md transition hover:border-emerald-300">
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
                                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
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
                      <div className="mt-2.5 p-3 bg-card border border-emerald-300 dark:border-emerald-800 rounded-2xl shadow-lg space-y-2.5 text-center">
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

                  {/* Customer Permission Request Card */}
                  {msg.messageType === "permission_request" && (
                    <div className="mt-2.5 p-3.5 bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/30 rounded-2xl shadow-md text-foreground space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                        <ShieldAlert size={15} /> Customer Authorization Request
                      </div>
                      <p className="text-[11px] text-foreground/90 leading-relaxed">
                        Representative <strong>{msg.metadata?.agentName || "Support Representative"}</strong> is requesting your permission to modify your <strong>{msg.metadata?.scopeName || "Account & Orders"}</strong> on your behalf.
                      </p>
                      {msg.metadata?.requestNote && (
                        <p className="text-[10px] text-muted-foreground italic bg-background/60 p-1.5 rounded-lg border border-border">
                          &ldquo;{msg.metadata.requestNote}&rdquo;
                        </p>
                      )}
                      
                      {liveSessionData?.customerPermissionGranted ? (
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl">
                          <CheckCircle2 size={13} /> You authorized modification access for this session.
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            disabled={respondPermissionMutation.isPending}
                            onClick={() => respondPermissionMutation.mutate(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 flex-1 gap-1 shadow-sm"
                          >
                            <CheckCircle2 size={13} /> Proceed &amp; Authorize
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={respondPermissionMutation.isPending}
                            onClick={() => respondPermissionMutation.mutate(false)}
                            className="text-xs h-8 flex-1 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 font-semibold gap-1"
                          >
                            <XCircle size={13} /> Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  {msg.action === "GO_TO_CHECKOUT" && (
                    <button onClick={() => handleAction(msg.action!, msg.actionData)}
                      className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold hover:underline">
                      <ShoppingCart size={12} /> {strings.goToCart}
                    </button>
                  )}
                  {msg.action === "ADD_TO_CART" && msg.actionData?.productId && (
                    <button onClick={() => handleAction(msg.action!, msg.actionData)}
                      className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold hover:underline">
                      <ExternalLink size={12} /> {strings.viewProduct}
                    </button>
                  )}
                  {msg.action === 'view_tickets' && (
                    <button
                      onClick={() => navigate('/account')}
                      className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 w-fit"
                      style={{ background: 'linear-gradient(135deg, #14532d 0%, #065f46 50%, #ca8a04 100%)' }}
                    >
                      <Ticket size={14} />
                      View My Tickets
                    </button>
                  )}
                  {msg.requiresLocation && (
                    <button
                      onClick={handleDetectLocation}
                      className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold shadow-lg hover:scale-105 active:scale-95 transition-all duration-200"
                      style={{ background: 'linear-gradient(135deg, #14532d 0%, #065f46 50%, #ca8a04 100%)' }}
                    >
                      <MapPin size={15} />
                      Detect My Location
                    </button>
                  )}
                  {/* Listen button */}
                  {msg.role === "model" && (
                    <button id={`chatbot-listen-${msg.id}`}
                      onClick={() => speakText(msg.content, msg.id, language)}
                      className={`mt-1 flex items-center gap-1 text-[10px] transition ${speakingId === msg.id ? "text-red-500 font-medium" : "text-gray-400 hover:text-emerald-600"}`}>
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
                  style={{ background: 'linear-gradient(135deg, #14532d 0%, #065f46 50%, #ca8a04 100%)' }}>
                  <span style={{ fontSize: '12px' }}>🪔</span>
                </div>
                <div className="bg-gray-100 dark:bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3.5 flex gap-1.5 items-center">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#ca8a04', animationDelay: `${d}ms` }} />
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
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition disabled:opacity-50">
              <Users size={12} />
              {humanMutation.isPending ? strings.connecting : strings.connectHuman}
            </button>
          </div>

          {/* Input bar */}
          <div className="px-3 pb-3 pt-0.5 flex-shrink-0">
            {liveSessionData?.status === "closed" ? (
              <div className="flex items-center justify-between gap-2 bg-muted/40 dark:bg-zinc-800/80 rounded-2xl px-3.5 py-2.5 border border-card-border">
                <span className="text-xs text-muted-foreground font-medium">Session closed.</span>
                <button
                  onClick={handleClearChat}
                  className="text-xs font-bold px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition"
                >
                  Start New Chat 💬
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 rounded-2xl px-3 py-2 border border-transparent focus-within:border-emerald-400 transition">
                <input ref={inputRef} id="chatbot-input" type="text" value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder={strings.placeholder}
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
                  className="flex-shrink-0 w-7 h-7 rounded-full text-white flex items-center justify-center hover:opacity-90 transition disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #065f46, #ca8a04)' }}
                  aria-label="Send message">
                  <Send size={13} />
                </button>
              </div>
            )}
            <p className="text-center text-[9px] text-gray-400 mt-1">{strings.poweredBy}</p>
          </div>
        </div>
      )}


    </>
  );
}

export const ChatbotLaxshmi = ChatbotLakshmi;
