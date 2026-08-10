import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, router } from 'expo-router';
import * as Speech from 'expo-speech';
import { LinearGradient } from 'expo-linear-gradient';
import { api, resolveImgUrl } from '../lib/api';
import { useCartStore } from '../lib/cart';
import { useAuth } from '../lib/store';

const { width, height } = Dimensions.get('window');

type Language = 'en' | 'hi' | 'te';
type MessageRole = 'user' | 'model';

interface ProductItem {
  id: number;
  name: string;
  price: string;
  unit: string;
  image?: string;
  allowInternationalShipping?: boolean;
}

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  action?: string;
  actionData?: any;
  needsHuman?: boolean;
  products?: ProductItem[];
}

const UI_STRINGS: Record<Language, {
  headerTitle: string;
  headerSubtitle: string;
  bubbleGreeting: string;
  connectHuman: string;
  raiseTicket: string;
  placeholder: string;
  thinking: string;
  wakeWordActive: string;
  wakeWordDisabled: string;
  addToCart: string;
}> = {
  en: {
    headerTitle: 'Laxshmi AI',
    headerSubtitle: 'Smart Assistant',
    bubbleGreeting: '🙏 Namaste! How can I help?',
    connectHuman: '📞 Connect to Human Support',
    raiseTicket: '🎫 Raise Support Ticket',
    placeholder: 'Type a message...',
    thinking: 'Laxshmi is thinking...',
    wakeWordActive: '🎤 Voice Wake Active',
    wakeWordDisabled: '🎤 Voice Wake Off',
    addToCart: '+ Add',
  },
  hi: {
    headerTitle: 'लक्ष्मी AI',
    headerSubtitle: 'स्मार्ट सहायक',
    bubbleGreeting: '🙏 नमस्ते! मैं कैसे मदद कर सकती हूँ?',
    connectHuman: '📞 मानव सहायता से जुड़ें',
    raiseTicket: '🎫 सहायता टिकट दर्ज करें',
    placeholder: 'संदेश लिखें...',
    thinking: 'लक्ष्मी सोच रही हैं...',
    wakeWordActive: '🎤 वॉयस वेक सक्रिय',
    wakeWordDisabled: '🎤 वॉयस वेक बंद',
    addToCart: '+ जोड़ें',
  },
  te: {
    headerTitle: 'లక్ష్మి AI',
    headerSubtitle: 'స్మార్ట్ సహాయకురాలు',
    bubbleGreeting: '🙏 నమస్తే! నేను ఎలా సహాయం చేయగలను?',
    connectHuman: '📞 మానవ సహాయానికి కనెక్ట్ చేయండి',
    raiseTicket: '🎫 సపోర్ట్ టికెట్ నమోదు చేయండి',
    placeholder: 'సందేశం టైప్ చేయండి...',
    thinking: 'లక్ష్మి ఆలోచిస్తోంది...',
    wakeWordActive: '🎤 వాయిస్ వేక్ యాక్టివ్',
    wakeWordDisabled: '🎤 వాయిస్ వేక్ ఆఫ్',
    addToCart: '+ కార్ట్',
  },
};

const WELCOME_MESSAGES: Record<Language, string> = {
  en: "🙏 Namaste! I'm Laxshmi, your FarmFreshFarmer assistant. How can I help you today?\n\nI can help with:\n• Fresh vegetables, fruits & pickles\n• Product prices & store availability\n• Delivery timings & ETA\n• Order tracking & subscriptions",
  hi: "🙏 नमस्ते! मैं लक्ष्मी हूँ, आपकी FarmFreshFarmer सहायक। आज मैं आपकी कैसे सहायता कर सकती हूँ?\n\nमैं इन चीज़ों में मदद कर सकती हूँ:\n• ताज़ी सब्जियाँ, फल और अचार\n• उत्पाद की कीमतें और उपलब्धता\n• डिलीवरी समय और ट्रैकिंग",
  te: "🙏 నమస్తే! నేను లక్ష్మి, మీ FarmFreshFarmer సహాయకురాలిని. నేను మీకు ఎలా సహాయం చేయగలను?\n\nనేను ఇవి చేయగలను:\n• తాజా కూరగాయలు, పండ్లు & ఊరగాయలు\n• ఉత్పత్తి ధరలు & లభ్యత\n• డెలివరీ సమయాలు & ఆర్డర్ ట్రాకింగ్",
};

let sessionTokenCache = '';
function getSessionToken(): string {
  if (!sessionTokenCache) {
    sessionTokenCache = `mob_sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
  return sessionTokenCache;
}

export function LaxshmiAiBot({ customGreeting }: { customGreeting?: string } = {}) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { user } = useAuth();
  const addItemToCart = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);



  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Smooth Animated Disappearing Speech Bubble State
  const bubbleAnimOpacity = useRef(new Animated.Value(1)).current;
  const bubbleAnimScale = useRef(new Animated.Value(1)).current;
  const bubbleAnimTranslateY = useRef(new Animated.Value(0)).current;
  const [bubbleRendered, setBubbleRendered] = useState(true);

  const dismissBubbleSmoothly = useCallback(() => {
    Animated.parallel([
      Animated.timing(bubbleAnimOpacity, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(bubbleAnimScale, {
        toValue: 0.85,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(bubbleAnimTranslateY, {
        toValue: 8,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setBubbleRendered(false);
    });
  }, [bubbleAnimOpacity, bubbleAnimScale, bubbleAnimTranslateY]);

  // Auto-disappear speech bubble preview after 5 seconds smoothly
  useEffect(() => {
    if (bubbleRendered) {
      const timer = setTimeout(() => {
        dismissBubbleSmoothly();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [bubbleRendered, dismissBubbleSmoothly]);

  // Ticket Form State
  const [ticketName, setTicketName] = useState(user?.name || '');
  const [ticketPhone, setTicketPhone] = useState(user?.phone || '');
  const [ticketEmail, setTicketEmail] = useState(user?.email || '');
  const [ticketConcern, setTicketConcern] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [activeTicketFormMessageId, setActiveTicketFormMessageId] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  const glow1Anim = useRef(new Animated.Value(0)).current;
  const outerRingAnim = useRef(new Animated.Value(1)).current;
  const recognitionRef = useRef<any>(null);

  // Initialize Welcome Message
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'model',
        content: WELCOME_MESSAGES[language],
        timestamp: new Date(),
      },
    ]);
  }, [language]);

  // Pulse animation for AI floating button
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Float animation — organic up-down movement
  useEffect(() => {
    const floatSequence = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: -5, duration: 1500, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: -11, duration: 1800, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    );
    floatSequence.start();
    return () => floatSequence.stop();
  }, []);

  // Shimmer sweep animation
  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(1500),
        Animated.timing(shimmerAnim, { toValue: 2, duration: 1200, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: -1, duration: 0, useNativeDriver: true }),
        Animated.delay(3000),
      ])
    );
    shimmerLoop.start();
    return () => shimmerLoop.stop();
  }, []);

  // Glow breathing for pill border
  useEffect(() => {
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow1Anim, { toValue: 1, duration: 1800, useNativeDriver: false }),
        Animated.timing(glow1Anim, { toValue: 0, duration: 1800, useNativeDriver: false }),
      ])
    );
    glowLoop.start();
    return () => glowLoop.stop();
  }, []);

  // Outer ring — slower pulse (useNativeDriver: true for scale)
  useEffect(() => {
    const outerLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(1100),
        Animated.parallel([
          Animated.timing(outerRingAnim, { toValue: 3.2, duration: 2000, useNativeDriver: true }),
        ]),
        Animated.timing(outerRingAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
      ])
    );
    outerLoop.start();
    return () => outerLoop.stop();
  }, []);

  // Female Voice Text-To-Speech (TTS) via Expo Speech
  const speakResponse = useCallback(async (text: string, lang: Language) => {
    if (!ttsEnabled) return;
    try {
      Speech.stop();
      const cleanText = text.replace(/[*_#`•]/g, '').trim();
      if (!cleanText) return;
      const langCode = lang === 'te' ? 'te-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';

      // Find available female voice in Expo Speech
      const availableVoices = await Speech.getAvailableVoicesAsync().catch(() => []);
      const femaleVoice = availableVoices.find((v) =>
        (v.name.includes('Female') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Veena') || v.name.includes('Zira') || v.name.includes('Siri') || v.name.includes('Kavya') || v.name.includes('Swara') || v.name.includes('Heera')) &&
        !v.name.toLowerCase().includes('male') &&
        (v.language.includes('IN') || v.language.includes(langCode.split('-')[0]))
      ) || availableVoices.find((v) => v.language.includes('IN'));

      Speech.speak(cleanText, {
        language: langCode,
        pitch: 1.25, // Natural female voice pitch
        rate: 0.95,
        voice: femaleVoice?.identifier,
      });
    } catch (err) {
      console.warn('[laxshmi tts error]', err);
    }
  }, [ttsEnabled]);

  // Handle Send Message
  const handleSendMessage = async (textOverride?: string) => {
    const query = (textOverride || inputMessage).trim();
    if (!query || loading) return;

    const userMsgId = `usr_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      // Call endpoint (handles both /api/chatbot/message and /api/chatbot)
      const res = await api.post('/api/chatbot/message', {
        message: query,
        language,
        sessionToken: getSessionToken(),
      });

      const botReply = res.data?.reply || '🙏 I am happy to assist you! Please ask about products, prices, or orders.';
      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        role: 'model',
        content: botReply,
        timestamp: new Date(),
        action: res.data?.action,
        actionData: res.data?.actionData,
        needsHuman: res.data?.needsHuman,
        products: res.data?.products || [],
      };

      setMessages((prev) => [...prev, botMsg]);
      speakResponse(botReply, language);
    } catch (err) {
      const fallbackMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'model',
        content: '🙏 I experienced a brief connection delay reaching Gemini AI. Please try again or tap "Connect to Human Support".',
        timestamp: new Date(),
        needsHuman: true,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // Web Speech API / Voice Listener
  const startListening = () => {
    try {
      const globalObj = typeof window !== 'undefined' ? (window as any) : null;
      const SpeechRec = globalObj?.SpeechRecognition || globalObj?.webkitSpeechRecognition;

      if (!SpeechRec) {
        Alert.alert('Voice Input', 'Voice recognition requires Web Speech API supported browser or device.');
        return;
      }

      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }

      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === 'te' ? 'te-IN' : language === 'hi' ? 'hi-IN' : 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setInputMessage(transcript);
          handleSendMessage(transcript);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
      Alert.alert('Voice Input Error', 'Microphone voice recognition could not be started.');
    }
  };

  // Automated "Hey Laxshmi" Continuous Wake-Word Detection
  useEffect(() => {
    if (!wakeWordEnabled || typeof window === 'undefined') return;
    const globalObj = window as any;
    const SpeechRec = globalObj?.SpeechRecognition || globalObj?.webkitSpeechRecognition;
    if (!SpeechRec) return;

    let wakeListener: any = null;

    try {
      wakeListener = new SpeechRec();
      wakeListener.continuous = true;
      wakeListener.interimResults = true;
      wakeListener.lang = 'en-US';

      wakeListener.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const text = (event.results[i][0]?.transcript || '').toLowerCase();
          if (
            text.includes('hey laxshmi') ||
            text.includes('laxshmi') ||
            text.includes('hey lakshmi') ||
            text.includes('lakshmi') ||
            text.includes('लक्ष्मी') ||
            text.includes('లక్ష్మి')
          ) {
            Speech.speak('Namaste! Laxshmi is listening...', { language: 'en-IN', pitch: 1.25 });
            setIsOpen(true);
            dismissBubbleSmoothly();
            try { wakeListener.stop(); } catch {}
            setTimeout(() => startListening(), 800);
            break;
          }
        }
      };

      wakeListener.onend = () => {
        if (wakeWordEnabled && !isOpen) {
          try { wakeListener.start(); } catch {}
        }
      };

      wakeListener.start();
    } catch {}

    return () => {
      if (wakeListener) {
        try { wakeListener.stop(); } catch {}
      }
    };
  }, [wakeWordEnabled, isOpen, dismissBubbleSmoothly]);

  // Connect to Human Support
  const handleConnectHuman = async () => {
    try {
      await api.post('/api/chatbot/missed', {
        token: getSessionToken(),
        query: 'Customer requested live human support takeover from Mobile App',
        language,
      });

      const humanMsg: ChatMessage = {
        id: `hum_${Date.now()}`,
        role: 'model',
        content: '✅ Our Customer Support & Grievance team has been alerted via Telegram! A live representative will contact you shortly.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, humanMsg]);
    } catch (err) {
      Alert.alert('Escalation Alert', 'Our support team has been notified. We will reach out to you shortly.');
    }
  };

  // Submit Support Ticket
  const handleSubmitTicket = async () => {
    if (!ticketConcern.trim()) {
      Alert.alert('Support Ticket', 'Please describe your concern before submitting.');
      return;
    }
    setSubmittingTicket(true);
    try {
      const res = await api.post('/api/support-tickets', {
        customerName: ticketName || user?.name || 'Customer',
        customerPhone: ticketPhone || user?.phone || '',
        customerEmail: ticketEmail || user?.email || '',
        concern: ticketConcern.trim(),
      });

      const confirmedMsg: ChatMessage = {
        id: `tck_${Date.now()}`,
        role: 'model',
        content: `🎫 ${res.data?.message || 'Support Ticket created successfully!'} Our Grievance Officer will address your concern shortly.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, confirmedMsg]);
      setActiveTicketFormMessageId(null);
      setTicketConcern('');
    } catch (err: any) {
      Alert.alert('Ticket Error', err.response?.data?.message || 'Failed to submit support ticket.');
    } finally {
      setSubmittingTicket(false);
    }
  };

  const ui = UI_STRINGS[language];

  // Hide Laxshmi AI on Admin screens and Auth screens (Checked after all hooks to comply with React Rules of Hooks)
  const shouldHide =
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/(auth)') ||
    pathname?.includes('/auth') ||
    pathname?.includes('/login') ||
    pathname?.includes('/register') ||
    pathname?.includes('/forgot-password');

  if (shouldHide) return null;

  return (
    <>
      {/* ── 1. Floating Action Launcher Button ── */}
      {!isOpen && (
        <Animated.View
          style={[
            styles.floatingContainer,
            { transform: [{ translateY: floatAnim }] },
          ]}
        >
          {/* Speech bubble preview */}
          {bubbleRendered && (
            <Animated.View
              style={[
                styles.bubblePreview,
                {
                  opacity: bubbleAnimOpacity,
                  transform: [
                    { scale: bubbleAnimScale },
                    { translateY: bubbleAnimTranslateY },
                  ],
                },
              ]}
            >
              <Text style={styles.diyaText}>🪔</Text>
              <Text style={styles.bubbleText}>{customGreeting || ui.bubbleGreeting}</Text>
              <TouchableOpacity onPress={dismissBubbleSmoothly} style={styles.bubbleClose}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Double pulse rings - aligned in pillBox */}
          <View style={styles.pillBox}>
            <Animated.View
              style={[
                styles.outerPulseRing,
                { transform: [{ scale: outerRingAnim }], opacity: outerRingAnim.interpolate({ inputRange: [1, 3.2], outputRange: [0.5, 0] }) },
              ]}
            />
            <Animated.View
              style={[
                styles.innerPulseRing,
                { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 2.4], outputRange: [0.7, 0] }) },
              ]}
            />

            {/* The pill button - single line compact layout */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => {
                setIsOpen(true);
                dismissBubbleSmoothly();
              }}
              style={styles.pillWrapper}
            >
              <LinearGradient
                colors={['#FF6B35', '#D4145A', '#7B2FF7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.floatingPill}
              >
                {/* Shimmer sweep */}
                <Animated.View
                  style={[
                    styles.shimmerOverlay,
                    {
                      transform: [{
                        translateX: shimmerAnim.interpolate({
                          inputRange: [-1, 2],
                          outputRange: [-100, 200],
                        }),
                      }],
                    },
                  ]}
                />

                {/* Single line content: Diya + LAXSHMI AI + Sparkles + Online Badge */}
                <Text style={styles.diyaIconFloating}>🪔</Text>
                <Text style={styles.pillTitleText} numberOfLines={1}>LAXSHMI AI</Text>
                <Ionicons name="sparkles" size={10} color="#FDE68A" />
                <View style={styles.onlineBadge} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* ── 2. Full-Screen Laxshmi AI Modal ───────────────────────────────── */}
      <Modal visible={isOpen} animationType="slide" transparent onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.chatCard}>
            {/* ── Header with Safe Area Notch & Screen Width Auto-Alignment ─ */}
            <View style={[styles.chatHeader, { paddingTop: Math.max(insets.top + 6, 42) }]}>
              <View style={styles.headerTitleRow}>
                <View style={styles.headerAvatarBox}>
                  <Text style={styles.headerDiyaIcon}>🪔</Text>
                  <View style={styles.headerOnlineDot} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.headerTitle} numberOfLines={1}>{ui.headerTitle}</Text>
                  <Text style={styles.headerSubtitle} numberOfLines={1}>{ui.headerSubtitle}</Text>
                </View>
              </View>

              {/* Compact & Auto-Aligned Header Control Buttons */}
              <View style={styles.headerActions}>
                {/* View Support Tickets */}
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => {
                    setIsOpen(false);
                    router.push('/tickets');
                  }}
                >
                  <Ionicons name="receipt-outline" size={16} color="#10b981" />
                </TouchableOpacity>

                {/* Language Switcher Badge */}
                <TouchableOpacity
                  style={styles.langBtn}
                  onPress={() => setLanguage((l) => (l === 'en' ? 'hi' : l === 'hi' ? 'te' : 'en'))}
                >
                  <Text style={styles.langBtnText}>{language.toUpperCase()}</Text>
                </TouchableOpacity>

                {/* Voice Sound TTS */}
                <TouchableOpacity style={styles.iconBtn} onPress={() => setTtsEnabled(!ttsEnabled)}>
                  <Ionicons name={ttsEnabled ? 'volume-high-outline' : 'volume-mute-outline'} size={16} color="#10b981" />
                </TouchableOpacity>

                {/* Wake Word Mic */}
                <TouchableOpacity style={styles.iconBtn} onPress={() => setWakeWordEnabled(!wakeWordEnabled)}>
                  <Ionicons name={wakeWordEnabled ? 'mic' : 'mic-off'} size={16} color={wakeWordEnabled ? '#10b981' : '#64748b'} />
                </TouchableOpacity>

                {/* Always-Visible Close Button */}
                <TouchableOpacity style={styles.closeBtn} onPress={() => setIsOpen(false)}>
                  <Ionicons name="close" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Wake Word Status Banner */}
            <View style={styles.bannerRow}>
              <Text style={styles.bannerText}>
                {wakeWordEnabled ? ui.wakeWordActive : ui.wakeWordDisabled}
              </Text>
            </View>

            {/* ── Messages List ──────────────────────────────────────────── */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <View key={msg.id} style={[styles.msgWrapper, isUser ? styles.userMsgWrapper : styles.botMsgWrapper]}>
                    {!isUser && (
                      <View style={styles.botIconWrapper}>
                        <Text style={styles.botDiyaSmall}>🪔</Text>
                      </View>
                    )}
                    <View style={[styles.msgBubble, isUser ? styles.userBubble : styles.botBubble]}>
                      <Text style={[styles.msgText, isUser ? styles.userText : styles.botText]}>
                        {msg.content}
                      </Text>

                      {/* Products Cards Inside Response */}
                      {msg.products && msg.products.length > 0 && (
                        <View style={styles.productsBox}>
                          <Text style={styles.productsTitle}>🛒 Recommended Fresh Produce:</Text>
                          {msg.products.map((p) => {
                            const inCart = cartItems.find((ci) => ci.id === p.id);
                            return (
                              <View key={p.id} style={styles.productCard}>
                                <Image
                                  source={{ uri: resolveImgUrl(p.image) || 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=200' }}
                                  style={styles.productImg}
                                />
                                <View style={styles.productInfo}>
                                  <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                                  <Text style={styles.productPrice}>₹{p.price} / {p.unit}</Text>
                                </View>
                                <TouchableOpacity
                                  style={styles.addCartBtn}
                                  onPress={() => addItemToCart({ id: p.id, name: p.name, price: p.price, unit: p.unit, image: p.image }, 1)}
                                >
                                  <Text style={styles.addCartText}>
                                    {inCart ? `✓ ${inCart.qty}` : ui.addToCart}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {/* Action Escalation Buttons */}
                      {!isUser && (
                        <View style={styles.actionColumn}>
                          <TouchableOpacity style={styles.escalateBtn} onPress={handleConnectHuman}>
                            <Ionicons name="call" size={13} color="#ffffff" />
                            <Text style={styles.escalateText}>{ui.connectHuman}</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.ticketBtn}
                            onPress={() => {
                              setIsOpen(false);
                              router.push('/tickets');
                            }}
                          >
                            <Ionicons name="receipt" size={13} color="#10b981" />
                            <Text style={styles.ticketText}>{ui.raiseTicket}</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Support Ticket Form Overlay inside Message */}
                      {activeTicketFormMessageId === msg.id && (
                        <View style={styles.ticketFormCard}>
                          <Text style={styles.formTitle}>🎫 Create Support Ticket</Text>
                          <TextInput
                            style={styles.formInput}
                            placeholder="Your Full Name"
                            placeholderTextColor="#64748b"
                            value={ticketName}
                            onChangeText={setTicketName}
                          />
                          <TextInput
                            style={styles.formInput}
                            placeholder="Phone Number"
                            placeholderTextColor="#64748b"
                            keyboardType="phone-pad"
                            value={ticketPhone}
                            onChangeText={setTicketPhone}
                          />
                          <TextInput
                            style={styles.formInput}
                            placeholder="Email Address"
                            placeholderTextColor="#64748b"
                            keyboardType="email-address"
                            value={ticketEmail}
                            onChangeText={setTicketEmail}
                          />
                          <TextInput
                            style={[styles.formInput, { height: 60 }]}
                            placeholder="Describe your issue or concern..."
                            placeholderTextColor="#64748b"
                            multiline
                            value={ticketConcern}
                            onChangeText={setTicketConcern}
                          />
                          <TouchableOpacity style={styles.submitTicketBtn} onPress={handleSubmitTicket} disabled={submittingTicket}>
                            {submittingTicket ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <Text style={styles.submitTicketText}>Submit Support Ticket</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}

              {loading && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#10b981" />
                  <Text style={styles.loadingText}>{ui.thinking}</Text>
                </View>
              )}
            </ScrollView>

            {/* Quick Suggestion Chips */}
            <View style={styles.chipsRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
                {['🚚 Delivery ETA?', '🥭 Mango Pickle Price', '🌾 Weekly Produce Box', '📦 Track Order'].map((chip, idx) => (
                  <TouchableOpacity key={idx} style={styles.chipBtn} onPress={() => handleSendMessage(chip)}>
                    <Text style={styles.chipText}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* ── Input Box & Controls ───────────────────────────────────── */}
            <View style={[styles.chatFooter, { paddingBottom: Math.max(insets.bottom + 8, 12) }]}>
              <TouchableOpacity
                style={[styles.micBtn, isListening && styles.micBtnActive]}
                onPress={startListening}
              >
                <Ionicons name={isListening ? 'mic' : 'mic-outline'} size={18} color={isListening ? '#ef4444' : '#10b981'} />
              </TouchableOpacity>

              <TextInput
                style={styles.textInput}
                placeholder={ui.placeholder}
                placeholderTextColor="#64748b"
                value={inputMessage}
                onChangeText={setInputMessage}
                onSubmitEditing={() => handleSendMessage()}
              />

              <TouchableOpacity
                style={[styles.sendBtn, !inputMessage.trim() && styles.sendBtnDisabled]}
                onPress={() => handleSendMessage()}
                disabled={!inputMessage.trim() || loading}
              >
                <Ionicons name="send" size={15} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 95,
    right: 16,
    zIndex: 9999,
    alignItems: 'flex-end',
  },
  bubblePreview: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(212, 20, 90, 0.45)',
    marginBottom: 10,
    maxWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#D4145A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  diyaText: {
    fontSize: 15,
  },
  bubbleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
    opacity: 0.92,
  },
  bubbleClose: {
    marginLeft: 4,
    padding: 2,
  },
  pillBox: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerPulseRing: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(123, 47, 247, 0.5)',
    backgroundColor: 'transparent',
  },
  innerPulseRing: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(212, 20, 90, 0.6)',
    backgroundColor: 'transparent',
  },
  pillWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#D4145A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 12,
  },
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 5,
    overflow: 'hidden',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 45,
    backgroundColor: 'rgba(255,255,255,0.28)',
    transform: [{ skewX: '-18deg' }],
  },
  diyaIconFloating: {
    fontSize: 16,
    lineHeight: 18,
  },
  pillTitleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  onlineBadge: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#4ade80',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    marginLeft: 1,
  },
  // Keep sparkleBadge for backward compatibility (no longer used in pill)
  sparkleBadge: {
    width: 0,
    height: 0,
  },
  // floatingBtn kept for backward compat
  floatingBtn: {
    width: 0,
    height: 0,
  },
  glowRing: {
    width: 0,
    height: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  chatCard: {
    width: '100%',
    height: '100%',
    backgroundColor: '#090d16',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  chatHeader: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderColor: '#1f2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 6,
  },
  headerAvatarBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerDiyaIcon: {
    fontSize: 18,
  },
  headerOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    borderWidth: 1,
    borderColor: '#111827',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  langBtn: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 6,
  },
  langBtnText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
  },
  iconBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 6,
  },
  closeBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 6,
    marginLeft: 2,
  },
  bannerRow: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 3,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  bannerText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '700',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
    gap: 10,
  },
  msgWrapper: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  userMsgWrapper: {
    justifyContent: 'flex-end',
  },
  botMsgWrapper: {
    justifyContent: 'flex-start',
    gap: 6,
  },
  botIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  botDiyaSmall: {
    fontSize: 12,
  },
  msgBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 14,
  },
  userBubble: {
    backgroundColor: '#10b981',
    borderBottomRightRadius: 2,
  },
  botBubble: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderBottomLeftRadius: 2,
  },
  msgText: {
    fontSize: 13,
    lineHeight: 18,
  },
  userText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  botText: {
    color: '#e5e7eb',
    fontWeight: '400',
  },
  productsBox: {
    marginTop: 8,
    gap: 6,
  },
  productsTitle: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#090d16',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
    gap: 8,
  },
  productImg: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  productPrice: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 1,
  },
  addCartBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addCartText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  actionColumn: {
    flexDirection: 'column',
    gap: 6,
    marginTop: 10,
    width: '100%',
  },
  escalateBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
  },
  escalateText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  ticketBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10b981',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
  },
  ticketText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
  },
  ticketFormCard: {
    backgroundColor: '#090d16',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#10b981',
    gap: 6,
  },
  formTitle: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
  },
  formInput: {
    backgroundColor: '#111827',
    color: '#ffffff',
    fontSize: 11,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  submitTicketBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  submitTicketText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 11,
    fontStyle: 'italic',
  },
  chipsRow: {
    paddingVertical: 6,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderColor: '#1f2937',
  },
  chipsContainer: {
    paddingHorizontal: 10,
    gap: 6,
  },
  chipBtn: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  chipText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '600',
  },
  chatFooter: {
    padding: 10,
    backgroundColor: '#090d16',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderColor: '#1f2937',
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  micBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  textInput: {
    flex: 1,
    height: 36,
    backgroundColor: '#111827',
    borderRadius: 18,
    paddingHorizontal: 12,
    color: '#ffffff',
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#1f2937',
    opacity: 0.5,
  },
});
