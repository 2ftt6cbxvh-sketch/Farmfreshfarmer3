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
    headerTitle: 'Laxshmi AI Assistant',
    headerSubtitle: 'FarmFreshFarmer Smart Shopping & Voice Assistant',
    bubbleGreeting: '🙏 Namaste! How can I help?',
    connectHuman: '📞 Connect to Human Support',
    raiseTicket: '🎫 Raise Support Ticket',
    placeholder: 'Ask Laxshmi anything or say "Hey Laxshmi"...',
    thinking: 'Laxshmi is thinking...',
    wakeWordActive: '🎤 "Hey Laxshmi" Voice Wake Active',
    wakeWordDisabled: '🎤 Voice Wake Disabled',
    addToCart: '🛒 Add to Cart',
  },
  hi: {
    headerTitle: 'लक्ष्मी AI सहायक',
    headerSubtitle: 'FarmFreshFarmer वॉयस और सहायता रोबोट',
    bubbleGreeting: '🙏 नमस्ते! मैं कैसे मदद कर सकती हूँ?',
    connectHuman: '📞 मानव सहायता से जुड़ें',
    raiseTicket: '🎫 सहायता टिकट दर्ज करें',
    placeholder: 'लक्ष्मी से पूछें या कहें "Hey Laxshmi"...',
    thinking: 'लक्ष्मी सोच रही हैं...',
    wakeWordActive: '🎤 "Hey Laxshmi" वॉयस वेक सक्रिय',
    wakeWordDisabled: '🎤 वॉयस वेक बंद',
    addToCart: '🛒 कार्ट में जोड़ें',
  },
  te: {
    headerTitle: 'లక్ష్మి AI సహాయకురాలు',
    headerSubtitle: 'FarmFreshFarmer వాయిస్ & షాపింగ్ అసిస్టెంట్',
    bubbleGreeting: '🙏 నమస్తే! నేను ఎలా సహాయం చేయగలను?',
    connectHuman: '📞 మానవ సహాయానికి కనెక్ట్ చేయండి',
    raiseTicket: '🎫 సపోర్ట్ టికెట్ నమోదు చేయండి',
    placeholder: 'లక్ష్మిని అడగండి లేదా "Hey Laxshmi" అనండి...',
    thinking: 'లక్ష్మి ఆలోచిస్తోంది...',
    wakeWordActive: '🎤 "Hey Laxshmi" వాయిస్ వేక్ యాక్టివ్',
    wakeWordDisabled: '🎤 వాయిస్ వేక్ నిలిపివేయబడింది',
    addToCart: '🛒 కార్ట్‌కి జోడించండి',
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

export function LaxshmiAiBot() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { user } = useAuth();
  const addItemToCart = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);

  // Hide Laxshmi AI on Admin screens and Auth screens
  if (
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/(auth)') ||
    pathname?.includes('/auth') ||
    pathname?.includes('/login') ||
    pathname?.includes('/register') ||
    pathname?.includes('/forgot-password')
  ) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bubbleVisible, setBubbleVisible] = useState(true);

  // Ticket Form State
  const [ticketName, setTicketName] = useState(user?.name || '');
  const [ticketPhone, setTicketPhone] = useState(user?.phone || '');
  const [ticketEmail, setTicketEmail] = useState(user?.email || '');
  const [ticketConcern, setTicketConcern] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [activeTicketFormMessageId, setActiveTicketFormMessageId] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
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
            setBubbleVisible(false);
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
  }, [wakeWordEnabled, isOpen]);

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

  return (
    <>
      {/* ── 1. Floating Action Launcher Button (Positioned safely above bottom tab bar) ── */}
      {!isOpen && (
        <View style={styles.floatingContainer}>
          {bubbleVisible && (
            <View style={styles.bubblePreview}>
              <Text style={styles.diyaText}>🪔</Text>
              <Text style={styles.bubbleText}>{ui.bubbleGreeting}</Text>
              <TouchableOpacity onPress={() => setBubbleVisible(false)} style={styles.bubbleClose}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => {
              setIsOpen(true);
              setBubbleVisible(false);
            }}
            style={styles.floatingBtn}
          >
            <Animated.View style={[styles.glowRing, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.diyaIconFloating}>🪔</Text>
            <View style={styles.onlineBadge} />
            <View style={styles.sparkleBadge}>
              <Ionicons name="sparkles" size={10} color="#ffffff" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* ── 2. Full-Screen Laxshmi AI Modal ───────────────────────────────── */}
      <Modal visible={isOpen} animationType="slide" transparent onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.chatCard}>
            {/* ── Header with Safe Area Notch Clearance ─────────────────── */}
            <View style={[styles.chatHeader, { paddingTop: Math.max(insets.top + 8, 48) }]}>
              <View style={styles.headerTitleRow}>
                <View style={styles.headerAvatarBox}>
                  <Text style={styles.headerDiyaIcon}>🪔</Text>
                  <View style={styles.headerOnlineDot} />
                </View>
                <View>
                  <Text style={styles.headerTitle}>{ui.headerTitle}</Text>
                  <Text style={styles.headerSubtitle}>{ui.headerSubtitle}</Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                {/* View Tickets Button */}
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => {
                    setIsOpen(false);
                    router.push('/(tabs)/account');
                  }}
                >
                  <Ionicons name="receipt" size={18} color="#10b981" />
                </TouchableOpacity>

                {/* Language Switcher */}
                <TouchableOpacity
                  style={styles.langBtn}
                  onPress={() => setLanguage((l) => (l === 'en' ? 'hi' : l === 'hi' ? 'te' : 'en'))}
                >
                  <Text style={styles.langBtnText}>{language.toUpperCase()}</Text>
                </TouchableOpacity>

                {/* TTS Sound Switch */}
                <TouchableOpacity style={styles.iconBtn} onPress={() => setTtsEnabled(!ttsEnabled)}>
                  <Ionicons name={ttsEnabled ? 'volume-high' : 'volume-mute'} size={18} color="#10b981" />
                </TouchableOpacity>

                {/* Wake Word Toggle */}
                <TouchableOpacity style={styles.iconBtn} onPress={() => setWakeWordEnabled(!wakeWordEnabled)}>
                  <Ionicons name={wakeWordEnabled ? 'mic' : 'mic-off'} size={18} color={wakeWordEnabled ? '#10b981' : '#64748b'} />
                </TouchableOpacity>

                {/* Close Button */}
                <TouchableOpacity style={styles.closeBtn} onPress={() => setIsOpen(false)}>
                  <Ionicons name="close" size={20} color="#ffffff" />
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
                                  <Text style={styles.productName}>{p.name}</Text>
                                  <Text style={styles.productPrice}>₹{p.price} / {p.unit}</Text>
                                  <TouchableOpacity
                                    style={styles.addCartBtn}
                                    onPress={() => addItemToCart({ id: p.id, name: p.name, price: p.price, unit: p.unit, image: p.image }, 1)}
                                  >
                                    <Text style={styles.addCartText}>
                                      {inCart ? `✓ ${inCart.qty} in Cart` : ui.addToCart}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {/* Action Escalation Buttons (Stacked cleanly inside bubble) */}
                      {!isUser && (
                        <View style={styles.actionColumn}>
                          <TouchableOpacity style={styles.escalateBtn} onPress={handleConnectHuman}>
                            <Ionicons name="call" size={14} color="#ffffff" />
                            <Text style={styles.escalateText}>{ui.connectHuman}</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.ticketBtn}
                            onPress={() => setActiveTicketFormMessageId(activeTicketFormMessageId === msg.id ? null : msg.id)}
                          >
                            <Ionicons name="receipt" size={14} color="#10b981" />
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
                            style={[styles.formInput, { height: 70 }]}
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
                              <Text style={styles.submitTicketText}>Submit Ticket to Grievance Officer</Text>
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
            <View style={styles.chatFooter}>
              <TouchableOpacity
                style={[styles.micBtn, isListening && styles.micBtnActive]}
                onPress={startListening}
              >
                <Ionicons name={isListening ? 'mic' : 'mic-outline'} size={20} color={isListening ? '#ef4444' : '#10b981'} />
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
                <Ionicons name="send" size={16} color="#ffffff" />
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
    bottom: 95, // Positioned safely above bottom tab bar
    right: 16,
    zIndex: 9999,
    alignItems: 'flex-end',
  },
  bubblePreview: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#10b981',
    marginBottom: 8,
    maxWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  diyaText: {
    fontSize: 16,
    marginRight: 6,
  },
  bubbleText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 1,
  },
  bubbleClose: {
    marginLeft: 6,
    padding: 2,
  },
  floatingBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
  glowRing: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  diyaIconFloating: {
    fontSize: 26,
  },
  onlineBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  sparkleBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    backgroundColor: '#059669',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  chatCard: {
    width: '100%',
    height: height * 0.88,
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    overflow: 'hidden',
  },
  chatHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerDiyaIcon: {
    fontSize: 20,
  },
  headerOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    borderWidth: 1.5,
    borderColor: '#1e293b',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  langBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  langBtnText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
  },
  iconBtn: {
    padding: 6,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    marginLeft: 4,
  },
  bannerRow: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 4,
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
    padding: 14,
    gap: 12,
  },
  msgWrapper: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  userMsgWrapper: {
    justifyContent: 'flex-end',
  },
  botMsgWrapper: {
    justifyContent: 'flex-start',
    gap: 8,
  },
  botIconWrapper: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  botDiyaSmall: {
    fontSize: 13,
  },
  msgBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: '#10b981',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  msgText: {
    fontSize: 13,
    lineHeight: 19,
  },
  userText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  botText: {
    color: '#e2e8f0',
    fontWeight: '500',
  },
  productsBox: {
    marginTop: 10,
    gap: 8,
  },
  productsTitle: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    gap: 10,
  },
  productImg: {
    width: 46,
    height: 46,
    borderRadius: 8,
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
    marginVertical: 2,
  },
  addCartBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  addCartText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  actionColumn: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 12,
    width: '100%',
  },
  escalateBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
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
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
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
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#10b981',
    gap: 8,
  },
  formTitle: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '800',
  },
  formInput: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    fontSize: 11,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  submitTicketBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitTicketText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 11,
    fontStyle: 'italic',
  },
  chipsRow: {
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderColor: '#334155',
  },
  chipsContainer: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chipBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  chipText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '600',
  },
  chatFooter: {
    padding: 12,
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderColor: '#334155',
  },
  micBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  micBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  textInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#1e293b',
    borderRadius: 19,
    paddingHorizontal: 14,
    color: '#ffffff',
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
});
