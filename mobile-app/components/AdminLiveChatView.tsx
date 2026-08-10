import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface LiveSession {
  id: number;
  sessionToken: string;
  userId?: number | null;
  language: string;
  status: 'bot' | 'waiting_for_agent' | 'agent_connected' | 'closed';
  assignedAgentId?: number | null;
  assignedAgentName?: string | null;
  lastActivityAt: string;
  createdAt: string;
  lastMessage?: string;
  lastMessageSender?: string;
}

interface ChatMessage {
  id: string;
  sender: 'customer' | 'support' | 'bot' | 'system';
  senderName?: string | null;
  message: string;
  createdAt: string;
}

interface MissedQuery {
  id: number;
  sessionToken: string;
  query: string;
  language: string;
  resolved: boolean;
  createdAt: string;
}

const QUICK_REPLIES = [
  'Hello! I am here to help you. What can I assist you with today?',
  'Your order is currently being packed and will be delivered shortly.',
  'I have verified your request and initiated a refund for your item.',
  'Thank you for reaching out to FarmFreshFarmer! Have a wonderful day.',
];

interface AdminLiveChatViewProps {
  cardBg: string;
  textColor: string;
  mutedColor: string;
  borderCol: string;
  isDark: boolean;
}

export function AdminLiveChatView({
  cardBg,
  textColor,
  mutedColor,
  borderCol,
  isDark,
}: AdminLiveChatViewProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'waiting' | 'active' | 'missed'>('waiting');
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  // Poll live sessions every 3 seconds
  const { data: sessionsData, isLoading: loadingSessions, refetch: refetchSessions } = useQuery<{
    sessions: LiveSession[];
  }>({
    queryKey: ['admin-live-sessions'],
    queryFn: async () => {
      const res = await api.get('/api/admin/chatbot/live-sessions');
      return res.data;
    },
    refetchInterval: 3000,
  });

  const sessions = sessionsData?.sessions || [];
  const waitingSessions = sessions.filter((s) => s.status === 'waiting_for_agent');
  const activeSessions = sessions.filter((s) => s.status === 'agent_connected');

  // Poll messages for selected session every 2 seconds
  const { data: messagesData, refetch: refetchMessages } = useQuery<{
    session: LiveSession;
    messages: ChatMessage[];
  }>({
    queryKey: ['admin-live-messages', selectedToken],
    queryFn: async () => {
      if (!selectedToken) return { session: null as any, messages: [] };
      const res = await api.get(`/api/admin/chatbot/messages/${selectedToken}`);
      return res.data;
    },
    enabled: !!selectedToken,
    refetchInterval: 2000,
  });

  // Fetch missed queries
  const { data: missedData, refetch: refetchMissed } = useQuery<{ queries: MissedQuery[] }>({
    queryKey: ['admin-live-missed'],
    queryFn: async () => {
      const res = await api.get('/api/admin/chatbot/missed');
      return res.data;
    },
  });

  const messages = messagesData?.messages || [];
  const currentSession =
    messagesData?.session || sessions.find((s) => s.sessionToken === selectedToken);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // Claim chat session mutation
  const claimMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await api.post('/api/admin/chatbot/claim-session', { sessionToken: token });
      return res.data;
    },
    onSuccess: (_, token) => {
      setSelectedToken(token);
      queryClient.invalidateQueries({ queryKey: ['admin-live-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-live-messages', token] });
      refetchSessions();
      refetchMessages();
    },
    onError: (err: any) => {
      Alert.alert('Claim Error', err?.response?.data?.message || 'Failed to take over chat session.');
    },
  });

  // Send reply mutation
  const sendMutation = useMutation({
    mutationFn: async ({ token, text }: { token: string; text: string }) => {
      const res = await api.post('/api/admin/chatbot/send-message', {
        sessionToken: token,
        message: text,
      });
      return res.data;
    },
    onSuccess: () => {
      setReplyInput('');
      refetchMessages();
      refetchSessions();
    },
    onError: (err: any) => {
      Alert.alert('Send Error', err?.response?.data?.message || 'Failed to send reply.');
    },
  });

  // Close session mutation
  const closeMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await api.post('/api/admin/chatbot/close-session', { sessionToken: token });
      return res.data;
    },
    onSuccess: () => {
      Alert.alert('Session Closed', 'Live support session closed successfully.');
      setSelectedToken(null);
      refetchSessions();
    },
  });

  const handleSend = () => {
    if (!selectedToken || !replyInput.trim()) return;
    sendMutation.mutate({ token: selectedToken, text: replyInput.trim() });
  };

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={[styles.headerRow, { borderColor: borderCol }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: textColor }]}>💬 Live Support Console</Text>
          <Text style={{ fontSize: 11, color: mutedColor }}>
            Take over customer chats live from your mobile app.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => {
            refetchSessions();
            refetchMissed();
          }}
        >
          <Ionicons name="refresh" size={14} color="#10b981" />
        </TouchableOpacity>
      </View>

      {/* Segmented Tab Selector */}
      <View style={[styles.tabBar, { backgroundColor: cardBg, borderColor: borderCol }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'waiting' && styles.tabBtnActive]}
          onPress={() => setActiveTab('waiting')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'waiting' && styles.tabBtnTextActive]}>
            Waiting ({waitingSessions.length})
          </Text>
          {waitingSessions.length > 0 && <View style={styles.badgeDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'active' && styles.tabBtnTextActive]}>
            Active ({activeSessions.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'missed' && styles.tabBtnActive]}
          onPress={() => setActiveTab('missed')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'missed' && styles.tabBtnTextActive]}>
            Missed ({missedData?.queries?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      {loadingSessions ? (
        <ActivityIndicator size="large" color="#10b981" style={{ marginVertical: 30 }} />
      ) : activeTab === 'waiting' ? (
        waitingSessions.length === 0 ? (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol, alignItems: 'center' }]}>
            <Ionicons name="checkmark-circle-outline" size={36} color="#10b981" />
            <Text style={[styles.cardTitle, { color: textColor, marginTop: 6 }]}>All Chats Resolved!</Text>
            <Text style={{ fontSize: 12, color: mutedColor, textAlign: 'center' }}>
              No customers currently waiting in the live support queue.
            </Text>
          </View>
        ) : (
          waitingSessions.map((s) => (
            <TouchableOpacity
              key={s.sessionToken}
              style={[styles.sessionCard, { backgroundColor: cardBg, borderColor: borderCol }]}
              onPress={() => setSelectedToken(s.sessionToken)}
            >
              <View style={styles.sessionHeader}>
                <Text style={[styles.sessionTokenText, { color: textColor }]}>
                  {s.sessionToken.substring(0, 16)}...
                </Text>
                <View style={styles.tagWaiting}>
                  <Text style={styles.tagWaitingText}>WAITING</Text>
                </View>
              </View>

              <Text style={[styles.messageSnippet, { color: mutedColor }]} numberOfLines={2}>
                "{s.lastMessage || 'Customer requested live human agent'}"
              </Text>

              <View style={styles.sessionFooter}>
                <Text style={{ fontSize: 10, color: mutedColor }}>
                  Lang: {s.language.toUpperCase()} • {new Date(s.lastActivityAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <TouchableOpacity
                  style={styles.claimBtn}
                  onPress={() => claimMutation.mutate(s.sessionToken)}
                >
                  <Ionicons name="person-add" size={12} color="#ffffff" />
                  <Text style={styles.claimBtnText}>Take Over Chat 🟢</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )
      ) : activeTab === 'active' ? (
        activeSessions.length === 0 ? (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol, alignItems: 'center' }]}>
            <Text style={{ fontSize: 24, marginBottom: 4 }}>💬</Text>
            <Text style={[styles.cardTitle, { color: textColor }]}>No Active Chats</Text>
            <Text style={{ fontSize: 12, color: mutedColor, textAlign: 'center' }}>
              You have no ongoing claimed live sessions right now.
            </Text>
          </View>
        ) : (
          activeSessions.map((s) => (
            <TouchableOpacity
              key={s.sessionToken}
              style={[styles.sessionCard, { backgroundColor: cardBg, borderColor: borderCol }]}
              onPress={() => setSelectedToken(s.sessionToken)}
            >
              <View style={styles.sessionHeader}>
                <Text style={[styles.sessionTokenText, { color: textColor }]}>
                  {s.sessionToken.substring(0, 16)}...
                </Text>
                <View style={styles.tagActive}>
                  <Text style={styles.tagActiveText}>ACTIVE</Text>
                </View>
              </View>

              <Text style={[styles.messageSnippet, { color: mutedColor }]} numberOfLines={1}>
                "{s.lastMessage}"
              </Text>

              <Text style={{ fontSize: 11, color: '#10b981', fontWeight: 'bold', marginTop: 4 }}>
                👤 Assigned: {s.assignedAgentName || 'You'}
              </Text>
            </TouchableOpacity>
          ))
        )
      ) : (
        missedData?.queries?.length === 0 ? (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol, alignItems: 'center' }]}>
            <Text style={{ fontSize: 24, marginBottom: 4 }}>✅</Text>
            <Text style={[styles.cardTitle, { color: textColor }]}>No Missed Queries</Text>
            <Text style={{ fontSize: 12, color: mutedColor, textAlign: 'center' }}>
              All customer queries have been addressed.
            </Text>
          </View>
        ) : (
          missedData?.queries?.map((q) => (
            <View key={q.id} style={[styles.sessionCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={{ color: textColor, fontWeight: '600', fontSize: 13 }}>"{q.query}"</Text>
              <Text style={{ fontSize: 10, color: mutedColor, marginTop: 4 }}>
                Lang: {q.language} • {new Date(q.createdAt).toLocaleDateString()}
              </Text>
            </View>
          ))
        )
      )}

      {/* ── LIVE CHAT MODAL ROOM ── */}
      <Modal visible={!!selectedToken} animationType="slide" transparent onRequestClose={() => setSelectedToken(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.chatRoomCard, { backgroundColor: isDark ? '#090d16' : '#ffffff' }]}>
            {/* Room Header */}
            <View style={styles.roomHeader}>
              <TouchableOpacity onPress={() => setSelectedToken(null)} style={styles.roomBackBtn}>
                <Ionicons name="arrow-back" size={20} color="#ffffff" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.roomTitle} numberOfLines={1}>
                  Session #{selectedToken?.substring(0, 12)}
                </Text>
                <Text style={styles.roomSubtitle}>
                  Status: {currentSession?.status?.replace('_', ' ').toUpperCase() || 'LIVE'}
                </Text>
              </View>
              {selectedToken && (
                <TouchableOpacity
                  style={styles.closeSessionBtn}
                  onPress={() => closeMutation.mutate(selectedToken)}
                >
                  <Ionicons name="checkmark-circle" size={14} color="#ffffff" />
                  <Text style={styles.closeSessionText}>Close 🏁</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Messages ScrollView */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
            >
              {messages.map((m) => {
                const isCustomer = m.sender === 'customer';
                const isSupport = m.sender === 'support';
                const isBot = m.sender === 'bot';

                return (
                  <View
                    key={m.id}
                    style={[
                      styles.msgBubbleWrapper,
                      isCustomer ? styles.msgLeft : styles.msgRight,
                    ]}
                  >
                    <View
                      style={[
                        styles.msgBubble,
                        isCustomer
                          ? styles.bubbleCustomer
                          : isSupport
                          ? styles.bubbleSupport
                          : styles.bubbleBot,
                      ]}
                    >
                      <Text style={styles.msgSenderName}>
                        {m.senderName || (isCustomer ? 'Customer' : isSupport ? 'Support Rep' : 'Laxshmi Bot')}
                      </Text>
                      <Text style={styles.msgText}>{m.message}</Text>
                      <Text style={styles.msgTime}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Quick replies */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRepliesBar}>
              <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 10 }}>
                {QUICK_REPLIES.map((reply, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.quickReplyChip}
                    onPress={() => setReplyInput(reply)}
                  >
                    <Text style={styles.quickReplyText} numberOfLines={1}>{reply}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Input Bar */}
            <View style={styles.inputBar}>
              <TextInput
                style={[styles.textInput, { color: isDark ? '#ffffff' : '#000000' }]}
                placeholder="Type your response to customer..."
                placeholderTextColor="#9ca3af"
                value={replyInput}
                onChangeText={setReplyInput}
              />
              <TouchableOpacity
                style={[styles.sendBtn, !replyInput.trim() && { opacity: 0.5 }]}
                disabled={!replyInput.trim()}
                onPress={handleSend}
              >
                <Ionicons name="send" size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '800' },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    position: 'relative',
  },
  tabBtnActive: {
    backgroundColor: '#10b981',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  tabBtnTextActive: {
    color: '#ffffff',
  },
  badgeDot: {
    position: 'absolute',
    top: 4,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  sessionCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionTokenText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '700',
  },
  tagWaiting: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagWaitingText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '800',
  },
  tagActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagActiveText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
  },
  messageSnippet: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  sessionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  claimBtn: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  claimBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  chatRoomCard: {
    width: '100%',
    height: '92%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  roomHeader: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  roomBackBtn: { padding: 4 },
  roomTitle: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  roomSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '600' },
  closeSessionBtn: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeSessionText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  messagesContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' },
  messagesContent: { padding: 12, gap: 10 },
  msgBubbleWrapper: { flexDirection: 'row', marginVertical: 2 },
  msgLeft: { justifyContent: 'flex-start' },
  msgRight: { justifyContent: 'flex-end' },
  msgBubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 14,
  },
  bubbleCustomer: {
    backgroundColor: '#1f2937',
    borderBottomLeftRadius: 2,
  },
  bubbleSupport: {
    backgroundColor: '#10b981',
    borderBottomRightRadius: 2,
  },
  bubbleBot: {
    backgroundColor: '#3b82f6',
    borderBottomLeftRadius: 2,
  },
  msgSenderName: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  msgText: { fontSize: 13, color: '#ffffff', lineHeight: 18 },
  msgTime: { fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 4, alignSelf: 'flex-end' },
  quickRepliesBar: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickReplyChip: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    maxWidth: 200,
  },
  quickReplyText: { color: '#10b981', fontSize: 11, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    fontSize: 13,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
