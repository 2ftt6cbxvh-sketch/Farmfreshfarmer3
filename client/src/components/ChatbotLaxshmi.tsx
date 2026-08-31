import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Mic, MicOff, Volume2, VolumeX, X, Send, Users, ChevronDown, Leaf, ShoppingCart, ExternalLink, MapPin, LogIn, Lock, Sparkles, Ticket, Crown, Star, CheckCircle2, ShieldAlert, XCircle, Trash2, Camera, ImagePlus, Eye, Activity, HeartPulse } from "lucide-react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { useCart, useAuth } from "@/lib/store";
import { getStarTheme } from "@/lib/starTheme";
import { Button } from "@/components/ui/button";
import { LakshmiAiMessageRenderer } from "./LakshmiAiMessageRenderer";

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
  imageUrl?: string;
  visionResult?: any;
  products?: Array<{
    id: number;
    name: string;
    price: string;
    originalPrice?: string;
    discountPercent?: string | number;
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
    poweredBy: "Powered by Lakshmi AI & Netra AI · by FarmFreshFarmer",
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
    poweredBy: "Lakshmi AI & Netra AI द्वारा संचालित · by FarmFreshFarmer",
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
    poweredBy: "Lakshmi AI & Netra AI ద్వారా · by FarmFreshFarmer",
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
  const [location, navigate] = useLocation();
  const { add, items, subtotal } = useCart();
  const { user, setUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>(() => getSessionToken(user?.id));
  const [mounted, setMounted] = useState(false);

  // Synchronize live user changes instantly across the assistant
  useEffect(() => {
    const handleUserUpdate = (e: any) => {
      if (e?.detail) {
        setUser(e.detail);
        setSessionToken(getSessionToken(e.detail.id));
      }
    };
    window.addEventListener("fff_user_updated", handleUserUpdate);
    return () => window.removeEventListener("fff_user_updated", handleUserUpdate);
  }, []);

  useEffect(() => {
    setSessionToken(getSessionToken(user?.id));
  }, [user?.id]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Do not show customer chatbot on internal admin pages or partner portal
  if (location.startsWith("/admin") || location.startsWith("/partner-portal")) {
    return null;
  }

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
    return [
      {
        id: "welcome",
        role: "model",
        content: WELCOME_MESSAGES.en,
        timestamp: new Date(),
      },
    ];
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

  /* Vision Image Upload State */
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<"auto" | "skin_doctor" | "plant_doctor" | "nutrition" | "return_spoilage">("auto");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleImageFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert("Please select an image smaller than 20MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1280;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setSelectedImage(compressedDataUrl);
          setImagePreviewUrl(compressedDataUrl);
        } else {
          setSelectedImage(rawDataUrl);
          setImagePreviewUrl(rawDataUrl);
        }
      };
      img.onerror = () => {
        setSelectedImage(rawDataUrl);
        setImagePreviewUrl(rawDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleClearSelectedImage = () => {
    setSelectedImage(null);
    setImagePreviewUrl(null);
  };

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastAssistantMessageRef = useRef<HTMLDivElement>(null);
  const lastUserQuestionRef = useRef<HTMLDivElement>(null);
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
                (String(m.id).startsWith("u_") || String(m.id).startsWith("opt_") || String(m.id).startsWith("m_"))
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

          // Check if this live message matches an optimistic/local AI bot message
          if (lm.sender === "bot" || lm.sender === "ai") {
            const botIdx = updated.findIndex(
              (m) =>
                m.role === "model" &&
                (m.content.trim() === lm.message.trim() ||
                 m.content.replace(/\s+/g, " ").trim() === lm.message.replace(/\s+/g, " ").trim())
            );
            if (botIdx !== -1) {
              // Upgrade the bot message ID and metadata without creating a duplicate!
              updated[botIdx] = {
                ...updated[botIdx],
                id: stringId,
                timestamp: new Date(lm.createdAt),
                senderName: lm.senderName || updated[botIdx].senderName,
                senderMeta: lm.senderMeta || updated[botIdx].senderMeta,
              };
              hasChanged = true;
              continue;
            }
          }

          // Check if identical content already exists for this role to prevent duplicate bubble
          const isDuplicateContent = updated.some(
            (m) =>
              m.role === (lm.sender === "customer" ? "user" : "model") &&
              m.content.trim() === lm.message.trim()
          );
          if (isDuplicateContent) continue;

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
      
      // Real-time synchronization: Record health/produce inquiries to live recommendation store
      if (payload.message) {
        import("@/lib/recommendation-store").then((m) => m.recordHealthInquiry("", payload.message));
      }

      let activeCategory = "";
      try {
        const trail = sessionStorage.getItem("fff_session_trail");
        if (trail) activeCategory = JSON.parse(trail).activeCategory || "";
      } catch {}

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
          browsingContext: {
            activeCategory,
          },
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
        visionResult: data.visionResult,
      };
      setMessages((prev) => [...prev, reply]);
      
      if (data.cartAdded || data.cartUpdated || data.cartCleared || data.cartModified) {
        queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
        queryClient.invalidateQueries({ queryKey: ['/api/cart/count'] });
        window.dispatchEvent(new CustomEvent('fff_cart_updated', { detail: { items: data.cartItems } }));
        window.dispatchEvent(new CustomEvent('cart-updated', { detail: { items: data.cartItems } }));
      }
      if (data.profileUpdated) {
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] });
        window.dispatchEvent(new CustomEvent('user-updated'));
      }
      if (data.orderUpdated) {
        queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
        queryClient.invalidateQueries({ queryKey: ['/api/orders/my'] });
        window.dispatchEvent(new CustomEvent('orders-updated'));
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

  useEffect(() => {
    if (!messagesContainerRef.current || messages.length === 0) return;

    // Smoothly scroll to the top of the conversation turn (user question + start of bot answer)
    const timer = setTimeout(() => {
      if (!messagesContainerRef.current) return;
      const container = messagesContainerRef.current;
      const targetEl = lastUserQuestionRef.current || lastAssistantMessageRef.current;

      if (targetEl) {
        const targetTop = targetEl.offsetTop - 12;
        container.scrollTo({
          top: Math.max(0, targetTop),
          behavior: "smooth",
        });
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    if (isOpen && window.innerWidth >= 640) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  /* TTS - Female Voice across website */
  const speakText = useCallback((text: string, id: string, lang: Language) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeakingId(id);

    const cleanText = text
      .replace(/•/g, "")
      .replace(/[*_#`~]/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\n+/g, " ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang === "te" ? "te-IN" : lang === "hi" ? "hi-IN" : "en-IN";
    utterance.rate = 0.82; // Slower, comfortable, clear speech rate
    utterance.pitch = 1.05; // Slightly higher pitch for natural female tone

    const voices = window.speechSynthesis.getVoices();
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
    // 1. Generate a brand-new unique session token so backend treats subsequent chats as 100% fresh
    const newToken = `sess_${user?.id ? `u${user.id}` : "g"}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setSessionToken(newToken);

    // 2. Clear browser storage
    const historyKey = getStorageHistoryKey(user?.id);
    try {
      localStorage.removeItem(historyKey);
      sessionStorage.removeItem(historyKey);

      if (user?.id) {
        const key = `lakshmi_user_session_${user.id}`;
        localStorage.setItem(key, newToken);
      } else {
        const guestKey = "lakshmi_guest_session";
        sessionStorage.setItem(guestKey, newToken);
        localStorage.setItem(guestKey, newToken);
      }
    } catch {}

    // 3. Reset messages state in UI strictly to fresh welcome greeting
    const nameGreeting = user?.name ? `🙏 Namaste ${user.name}! ` : "🙏 Namaste! ";
    const personalizedWelcome: Record<Language, string> = {
      en: `${nameGreeting}I'm Lakshmi, your FarmFreshFarmer assistant. How can I help you today?\n\nI can help with:\n• Product prices & availability\n• Delivery timings & ETA\n• Order tracking\n• Return & refund policy\n• Adding items to your cart`,
      hi: `${user?.name ? `🙏 नमस्ते ${user.name}! ` : "🙏 नमस्ते! "}मैं लक्ष्मी हूँ, आपकी FarmFreshFarmer सहायक। आज मैं आपकी कैसे सहायता कर सकती हूँ?\n\nमैं इन चीज़ों में मदद कर सकती हूँ:\n• उत्पाद की कीमतें और उपलब्धता\n• डिलीवरी समय\n• ऑर्डर ट्रैकिंग\n• रिटर्न और रिफंड नीति`,
      te: `${user?.name ? `🙏 నమస్తే ${user.name}! ` : "🙏 నమస్తే! "}నేను లక్ష్మి, మీ FarmFreshFarmer సహాయకురాలిని. నేను మీకు ఎలా సహాయం చేయగలను?\n\nనేను ఇవి చేయగలను:\n• ఉత్పత్తి ధరలు & అందుబాటు\n• డెలివరీ సమయాలు\n• ఆర్డర్ ట్రాకింగ్\n• రిటర్న్ & రీఫండ్ పాలసీ`,
    };
    setMessages([{ id: "welcome", role: "model", content: personalizedWelcome[language] || WELCOME_MESSAGES.en, timestamp: new Date() }]);

    // 4. Invalidate old session queries
    queryClient.removeQueries({ queryKey: ["/api/chatbot/live-session"] });
    queryClient.invalidateQueries({ queryKey: ["/api/chatbot/my-sessions"] });

    // 5. Close any active speech
    stopSpeaking();
  }, [user?.id, user?.name, language, stopSpeaking, queryClient]);

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
    const currentImg = selectedImage;
    const currentImgPreview = imagePreviewUrl;

    if ((!msg && !currentImg) || sendMutation.isPending) return;
    setInput("");
    setSelectedImage(null);
    setImagePreviewUrl(null);

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: msg || (currentImg ? "📷 Photo uploaded for Netra Vision AI analysis" : ""),
      timestamp: new Date(),
      imageUrl: currentImgPreview || undefined,
    };
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
    sendMutation.mutate({
      message: msg || "Analyze this photo accurately for skin condition, plant health, nutrition macros, or damage",
      image: currentImg || undefined,
      mode: imageMode,
      history,
    } as any);
  }, [input, selectedImage, imagePreviewUrl, imageMode, messages, sendMutation, ticketStep, ticketData, user]);

  /* Connect to human — requires phone-verified account */
  const handleConnectHuman = useCallback(async () => {
    // Gate: must be logged in
    if (!user) {
      setMessages((prev) => [
        ...prev,
        {
          id: `live_auth_${Date.now()}`,
          role: "model",
          content: "🔒 Please **sign in** first before connecting to a live agent.",
          timestamp: new Date(),
          showSignInBox: true,
        },
      ]);
      return;
    }

    // Gate: must have a verified phone number (SMS OTP verified)
    const hasVerifiedPhone = Boolean(user.phone && user.isVerified);
    if (!hasVerifiedPhone) {
      setMessages((prev) => [
        ...prev,
        {
          id: `live_phone_gate_${Date.now()}`,
          role: "model",
          content: `📵 **Phone verification required to access Live Agent Support.**\n\nFor security, live chat with our support agents is only available to users with a verified phone number.\n\n👉 Go to **My Account → Profile** and add & verify your mobile number via SMS OTP — then come back to connect with a live agent.`,
          timestamp: new Date(),
        },
      ]);
      return;
    }

    const lastMsg = [...messages].reverse().find((m) => m.role === "user");
    await humanMutation.mutateAsync(lastMsg?.content || "Customer requested live support assistance");
  }, [messages, humanMutation, user]);

  /* Action handler */
  const handleAction = useCallback((action: string, actionData: any) => {
    if (action === "GO_TO_CHECKOUT") window.location.href = "/cart";
    else if (action === "ADD_TO_CART" && actionData?.productId) window.location.href = `/products/${actionData.productId}`;
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* ── Floating button + bubble (when closed) ── */}
      {!isOpen && (
        <div
          className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-[9998] flex flex-col items-end gap-2 pointer-events-auto"
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
          className="fixed z-[99999] flex flex-col bg-background text-foreground rounded-3xl border border-emerald-500/30 dark:border-emerald-500/25 overflow-hidden
            bottom-4 right-3 left-3 h-[520px] max-h-[82vh]
            sm:left-auto sm:bottom-6 sm:right-6 sm:w-[380px] sm:max-w-[calc(100vw-24px)] sm:h-[580px] sm:max-h-[calc(100vh-80px)] transition-all duration-300"
          style={{ 
            boxShadow: '0 30px 70px -10px rgba(0, 0, 0, 0.7), 0 15px 35px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(16, 185, 129, 0.25), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
          }}>
          {/* Header with embossed depth */}
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 relative overflow-hidden"
            style={{ 
              background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #854d0e 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25), inset 0 -1px 0 rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.25)',
            }}>
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
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/20 active:scale-90 transition ml-1 shrink-0 cursor-pointer" aria-label="Close chatbot">
              <X size={20} />
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
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-3">
            {messages.map((msg, index) => {
              const isLatestUser = msg.role === 'user' && (index === messages.length - 1 || index === messages.length - 2);
              const isLatestModel = msg.role === 'model' && index === messages.length - 1;
              const msgRef = isLatestUser ? lastUserQuestionRef : isLatestModel ? lastAssistantMessageRef : null;

              return (
                <div key={msg.id} ref={msgRef} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
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
                        const rawStars = Number(msg.senderMeta?.starRating);
                        const starNum = isPrimary ? 6 : Math.max(0, Math.min(6, Number.isFinite(rawStars) ? rawStars : 5));
                        const theme = getStarTheme(starNum, true);
                        return (
                          <div className="flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                            {Array.from({ length: Math.max(0, Math.min(6, starNum)) }).map((_, i) => (
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
                        const isSuperAdmin = Boolean(user.isPrimaryAdmin || user.email?.toLowerCase() === "admin@farmfreshfarmer.com");
                        const isStaff = isSuperAdmin || user.role !== "customer";
                        const rawStaffRating = Number(user.starRating);
                        const rawCustomerRating = Number(user.customerStars);
                        const starsCount = isSuperAdmin
                          ? 6
                          : isStaff
                          ? Math.max(0, Math.min(6, Number.isFinite(rawStaffRating) ? rawStaffRating : 5))
                          : Math.max(0, Math.min(5, Number.isFinite(rawCustomerRating) ? rawCustomerRating : 0));
                        const theme = getStarTheme(starsCount, true);

                        return (
                          <>
                            <div className="flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                              {Array.from({ length: Math.max(0, Math.min(6, starsCount)) }).map((_, i) => (
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
                  {msg.imageUrl && (
                    <div className="mb-2 overflow-hidden rounded-xl border border-emerald-500/30 max-w-[240px] shadow-sm">
                      <img src={msg.imageUrl} alt="Uploaded image" className="w-full h-auto object-cover max-h-48 rounded-xl" />
                    </div>
                  )}
                  <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "text-white rounded-tr-sm"
                      : "bg-card/90 dark:bg-zinc-850 text-gray-800 dark:text-gray-200 rounded-tl-sm border border-card-border/80 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)]"
                  }`}
                  style={msg.role === "user" ? { 
                    background: 'linear-gradient(135deg, #065f46 0%, #047857 50%, #ca8a04 100%)',
                    boxShadow: '0 4px 12px -2px rgba(6, 95, 70, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -1px 0 rgba(0, 0, 0, 0.25)',
                  } : {}}
                  >
                    <LakshmiAiMessageRenderer content={msg.content} isUser={msg.role === "user"} />
                  </div>

                  {/* Netra Multimodal Vision AI Result Card */}
                  {msg.visionResult && (
                    <div className="mt-2.5 p-3 rounded-2xl bg-card border border-emerald-500/30 shadow-md space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                          <Sparkles size={14} className="text-amber-500 animate-pulse" />
                          <span>{msg.visionResult.title || "Netra AI Visual Analysis"}</span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <span>Netra AI</span>
                          <span className="text-[8px] text-muted-foreground font-normal">by FarmFreshFarmer</span>
                        </span>
                      </div>

                      {msg.visionResult.dataPills && msg.visionResult.dataPills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {msg.visionResult.dataPills.map((pill: any, idx: number) => (
                            <span key={idx} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-foreground border border-card-border">
                              {pill.label}: <span className="text-emerald-600 dark:text-emerald-400 font-black">{pill.value}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {msg.visionResult.refundRecommendation && msg.visionResult.refundRecommendation.isDamaged && (
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                          <span>Automated Damage Verified ({msg.visionResult.refundRecommendation.confidence}% confidence). Instant Refund Approved!</span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Enhanced Interactive Product Suggestion Cards */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="mt-3 space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <div className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                          <Sparkles size={13} className="text-emerald-500 animate-pulse" />
                          <span>Recommended For You</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium">100% Farm Fresh</span>
                      </div>

                      <div className="space-y-2">
                        {msg.products.map((p: any) => {
                          const inCartQty = (items || []).find((i: any) => (i?.product?.id ?? i?.productId ?? i?.id) === p.id)?.qty || 0;
                          const baseP = Number(p.originalPrice || p.price || 0);
                          const disc = Number(p.discountPercent || 0);
                          const currentPrice = disc > 0 && p.originalPrice ? Number(p.price) : disc > 0 ? (baseP * (1 - disc / 100)) : baseP;
                          const savings = disc > 0 ? Math.round(baseP - currentPrice) : 0;
                          const isOutOfStock = p.stock !== undefined && p.stock <= 0;
                          const reasonText = language === "te" && p.suggestionReasonTe ? p.suggestionReasonTe : (p.suggestionReason || p.suggestionReasonTe || "");

                          return (
                            <div
                              key={p.id}
                              className="group relative flex flex-col p-3 bg-card/90 dark:bg-card hover:bg-card rounded-2xl border border-emerald-500/20 hover:border-emerald-500/50 shadow-sm hover:shadow-md transition-all duration-200"
                            >
                              {/* Top Product Row */}
                              <div className="flex items-start gap-3">
                                {/* Thumbnail */}
                                <a
                                  href={`/product/${p.id}`}
                                  className="relative w-14 h-14 rounded-xl overflow-hidden bg-muted/60 flex items-center justify-center flex-shrink-0 cursor-pointer group-hover:scale-105 transition-transform duration-200 border border-border/40"
                                >
                                  {p.image ? (
                                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-2xl">🌿</span>
                                  )}
                                  {disc > 0 && (
                                    <span className="absolute top-0.5 left-0.5 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-sm">
                                      {Math.round(disc)}% OFF
                                    </span>
                                  )}
                                </a>

                                {/* Name & Price */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-1.5">
                                    <a
                                      href={`/product/${p.id}`}
                                      className="text-xs font-bold text-foreground hover:text-emerald-600 transition truncate block cursor-pointer leading-snug"
                                    >
                                      {p.name}
                                    </a>
                                  </div>

                                  {p.nameTe && (
                                    <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                                      {p.nameTe}
                                    </p>
                                  )}

                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                      ₹{Math.round(currentPrice)}
                                    </span>
                                    {disc > 0 && (
                                      <>
                                        <span className="text-[10px] text-muted-foreground line-through font-medium">
                                          ₹{Math.round(baseP)}
                                        </span>
                                        {savings > 0 && (
                                          <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                                            Save ₹{savings}
                                          </span>
                                        )}
                                      </>
                                    )}
                                    <span className="text-[10px] text-muted-foreground font-medium">/ {p.unit}</span>
                                  </div>
                                </div>

                                {/* Add to Cart Button */}
                                <Button
                                  size="sm"
                                  disabled={isOutOfStock}
                                  onClick={() => handleAddToCart({ ...p, price: currentPrice, discountPercent: disc })}
                                  className={`h-8 px-3 text-[11px] font-bold gap-1.5 transition-all duration-200 shadow-sm flex-shrink-0 rounded-xl active:scale-95 ${
                                    inCartQty > 0
                                      ? "bg-emerald-700 text-white hover:bg-emerald-800"
                                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                  }`}
                                >
                                  <ShoppingCart size={13} />
                                  {inCartQty > 0 ? `In Cart (${inCartQty})` : "+ Add"}
                                </Button>
                              </div>

                              {/* Why Suggested & Usefulness Pill */}
                              {reasonText && (
                                <div className="mt-2.5 pt-2 border-t border-border/40 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
                                  <Sparkles size={12} className="text-amber-500 shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <span className="font-bold text-foreground">Why suggested: </span>
                                    <span>{reasonText}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
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
            );
          })}
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
              <div className="space-y-1.5">
                {/* Floating Image Preview Thumbnail */}
                {imagePreviewUrl && (
                  <div className="p-2 bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={imagePreviewUrl} alt="Preview" className="w-9 h-9 rounded-lg object-cover border border-emerald-500/40 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 truncate">📷 Photo ready for Netra AI</p>
                        <p className="text-[9px] text-muted-foreground truncate">Diagnoses skin, plant health, macros, or damage</p>
                      </div>
                    </div>
                    <button onClick={handleClearSelectedImage} className="p-1 rounded-full text-muted-foreground hover:text-red-500 transition flex-shrink-0" aria-label="Remove image">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Hidden File Inputs */}
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageFilePicked} />
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFilePicked} />

                <div className="flex items-center gap-2 bg-zinc-900/95 dark:bg-black/80 rounded-2xl px-3 py-2 border border-emerald-500/35 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition">
                  {/* Camera Snap Button */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
                    title="Take a photo (Skin Doctor / Plant Doctor / Nutrition / Return Damage)"
                    aria-label="Take Photo"
                  >
                    <Camera size={16} />
                  </button>

                  {/* Gallery Upload Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
                    title="Upload image from gallery"
                    aria-label="Upload Image"
                  >
                    <ImagePlus size={16} />
                  </button>

                  <input ref={inputRef} id="chatbot-input" type="text" value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder={selectedImage ? "Add query or tap send to analyze..." : strings.placeholder}
                    className="flex-1 bg-transparent text-sm font-medium outline-none text-white placeholder:text-zinc-400 min-w-0"
                  />

                  {/* Mic button */}
                  <button id="chatbot-mic-btn" onClick={isListening ? stopListening : startListening}
                    className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer ${isListening ? "bg-red-500 text-white animate-pulse" : "text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10"}`}
                    aria-label={isListening ? "Stop recording" : "Start voice input"}>
                    {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                  </button>

                  {/* Send button */}
                  <button id="chatbot-send-btn" onClick={handleSend} disabled={(!input.trim() && !selectedImage) || sendMutation.isPending}
                    className="flex-shrink-0 w-7 h-7 rounded-full text-white flex items-center justify-center hover:opacity-90 transition disabled:opacity-30 shadow-xs cursor-pointer"
                    style={{ background: 'linear-gradient(135deg, #065f46, #ca8a04)' }}
                    aria-label="Send message">
                    <Send size={13} />
                  </button>
                </div>
              </div>
            )}
            <p className="text-center text-[9px] text-gray-400 mt-1">Powered by Lakshmi AI &amp; Netra Vision 3.6 · FarmFreshFarmer</p>
          </div>
        </div>
      )}


    </>,
    document.body
  );
}

export const ChatbotLaxshmi = ChatbotLakshmi;
