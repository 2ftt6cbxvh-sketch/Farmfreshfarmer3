import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/store';
import { useThemeStore } from '../lib/theme';
import { api } from '../lib/api';

export default function TicketsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [concern, setConcern] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const bg = isDark ? '#090d16' : '#f8fafc';
  const cardBg = isDark ? '#111827' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const mutedColor = isDark ? '#9ca3af' : '#64748b';
  const borderCol = isDark ? '#1f2937' : '#e2e8f0';
  const inputBg = isDark ? '#162032' : '#f1f5f9';

  // Query customer tickets
  const { data: ticketsData, refetch, isLoading } = useQuery<{ tickets: any[] }>({
    queryKey: ['my-support-tickets-page', user?.email],
    queryFn: () => api.get(`/api/support-tickets/my?email=${encodeURIComponent(user?.email || '')}`).then(r => r.data),
    enabled: true,
  });

  const tickets = ticketsData?.tickets || [];

  const handleSubmitTicket = async () => {
    if (!concern.trim()) {
      Alert.alert('Support Ticket', 'Please describe your concern before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/api/support-tickets', {
        customerName: customerName || user?.name || 'Customer',
        customerPhone: customerPhone || user?.phone || '',
        customerEmail: customerEmail || user?.email || '',
        concern: concern.trim(),
      });
      setConcern('');
      refetch();
      Alert.alert('🎫 Ticket Submitted', res.data?.message || 'Your support ticket has been created! Our Grievance Officer will respond shortly.');
    } catch (err: any) {
      Alert.alert('Ticket Error', err?.response?.data?.message || 'Could not submit support ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: Math.max(insets.top + 8, 44) }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: cardBg, borderColor: borderCol }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={textColor} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: textColor }]}>🎫 Support Tickets & Complaints</Text>
          <Text style={[styles.headerSub, { color: mutedColor }]}>Raise issues and track grievance status</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Form to Raise Ticket */}
        <View style={[styles.formCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
          <Text style={[styles.sectionTitle, { color: '#10b981' }]}>+ Create New Support Ticket</Text>
          
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, borderColor: borderCol, color: textColor }]}
            placeholder="Your Full Name"
            placeholderTextColor={mutedColor}
            value={customerName}
            onChangeText={setCustomerName}
          />

          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, backgroundColor: inputBg, borderColor: borderCol, color: textColor }]}
              placeholder="Mobile Phone"
              placeholderTextColor={mutedColor}
              keyboardType="phone-pad"
              value={customerPhone}
              onChangeText={setCustomerPhone}
            />
            <TextInput
              style={[styles.input, { flex: 1, backgroundColor: inputBg, borderColor: borderCol, color: textColor }]}
              placeholder="Email Address"
              placeholderTextColor={mutedColor}
              keyboardType="email-address"
              value={customerEmail}
              onChangeText={setCustomerEmail}
            />
          </View>

          <TextInput
            style={[styles.input, { height: 80, backgroundColor: inputBg, borderColor: borderCol, color: textColor }]}
            placeholder="Describe your issue, order ID, or complaint details..."
            placeholderTextColor={mutedColor}
            multiline
            value={concern}
            onChangeText={setConcern}
          />

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmitTicket}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Ticket to Grievance Team</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Tickets History Roster */}
        <Text style={[styles.rosterTitle, { color: textColor }]}>📋 Your Ticket History ({tickets.length})</Text>

        {isLoading ? (
          <ActivityIndicator size="small" color="#10b981" style={{ marginVertical: 20 }} />
        ) : tickets.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <Text style={{ fontSize: 32, marginBottom: 6 }}>🎫</Text>
            <Text style={[styles.emptyTitle, { color: textColor }]}>No Support Tickets Found</Text>
            <Text style={[styles.emptySub, { color: mutedColor }]}>
              Fill out the form above to submit your first inquiry or grievance ticket.
            </Text>
          </View>
        ) : (
          tickets.map((t: any) => {
            const statusColor = t.status === 'resolved' ? '#34d399' : t.status === 'in_progress' ? '#fbbf24' : '#60a5fa';
            const statusBg = t.status === 'resolved' ? 'rgba(52, 211, 153, 0.15)' : t.status === 'in_progress' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(96, 165, 250, 0.15)';
            return (
              <View key={t.id || t.ticketId} style={[styles.ticketCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <View style={styles.ticketHeaderRow}>
                  <Text style={[styles.ticketIdText, { color: textColor }]}>{t.ticketId || `TCK-${t.id}`}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {t.status === 'resolved' ? '🟢 Resolved' : t.status === 'in_progress' ? '🟡 In Progress' : '🔵 Open'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.concernText, { color: textColor }]}>{t.concern}</Text>

                {t.adminNotes && (
                  <View style={styles.resolutionBox}>
                    <Text style={styles.resolutionLabel}>Grievance Officer Resolution:</Text>
                    <Text style={[styles.resolutionText, { color: textColor }]}>{t.adminNotes}</Text>
                  </View>
                )}

                <Text style={[styles.dateText, { color: mutedColor }]}>
                  Submitted: {new Date(t.createdAt).toLocaleString()}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 11,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  formCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    borderWidth: 1,
  },
  submitBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  rosterTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  ticketCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketIdText: {
    fontSize: 14,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  concernText: {
    fontSize: 12,
    lineHeight: 18,
  },
  resolutionBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  resolutionLabel: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
  },
  resolutionText: {
    fontSize: 12,
    marginTop: 2,
  },
  dateText: {
    fontSize: 10,
    marginTop: 4,
  },
});
