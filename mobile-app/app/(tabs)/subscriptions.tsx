import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, RefreshControl, ActivityIndicator, TextInput, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/config';
import { useAuth } from '../../lib/store';
import { useThemeStore } from '../../lib/theme';

interface Plan {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: string;
  frequency: string;
  deliveryDays: string;
  active: boolean;
  items?: Array<{ productId: number; productName?: string }>;
}

interface Subscription {
  id: number;
  planId: number;
  planName: string;
  status: string;
  deliveryDays: string;
  phone: string;
  address: string;
  createdAt: string;
  cycles?: Array<{ id: number; scheduledDate: string; status: string; amount: string }>;
}

export default function SubscriptionsScreen() {
  const { user } = useAuth();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [subscribePlan, setSubscribePlan] = useState<Plan | null>(null);
  const [deliveryDays, setDeliveryDays] = useState('saturday');
  const [subPhone, setSubPhone] = useState(user?.phone || '');
  const [subAddress, setSubAddress] = useState('');
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);

  const { data: plansData, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: () => api.get('/api/plans').then(r => r.data),
    staleTime: 60000,
  });

  const { data: subsData, isLoading: subsLoading, refetch } = useQuery<{ subscriptions: Subscription[]; upcomingDeliveries: string[] }>({
    queryKey: ['my-subscriptions'],
    queryFn: () => api.get('/api/subscriptions/mine').then(r => r.data),
    enabled: !!user,
    staleTime: 30000,
  });

  const bg = isDark ? '#000000' : '#f8fafc';
  const cardBg = isDark ? '#0c121e' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : COLORS.text;
  const mutedColor = isDark ? '#94a3b8' : COLORS.textMuted;
  const borderCol = isDark ? 'rgba(16, 185, 129, 0.25)' : '#e2e8f0';
  const inputBg = isDark ? '#0f172a' : '#f8fafc';

  const doAction = async (id: number, action: string) => {
    try {
      await api.post(`/api/subscriptions/${id}/${action}`);
      qc.invalidateQueries({ queryKey: ['my-subscriptions'] });
      Alert.alert('Done', `Subscription ${action}d successfully.`);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || `Could not ${action} subscription.`);
    }
  };

  const doSubscribe = async () => {
    if (!subscribePlan) return;
    if (!subPhone.trim() || subPhone.length < 10) { Alert.alert('Phone Required', 'Enter a valid 10-digit phone.'); return; }
    if (!subAddress.trim()) { Alert.alert('Address Required', 'Enter your delivery address.'); return; }
    try {
      await api.post('/api/subscriptions', {
        planId: subscribePlan.id,
        deliveryDays,
        phone: subPhone.trim(),
        address: subAddress.trim(),
      });
      qc.invalidateQueries({ queryKey: ['my-subscriptions'] });
      setSubscribeOpen(false);
      Alert.alert('Subscribed!', `You are now subscribed to ${subscribePlan.name}. Deliveries every ${deliveryDays}.`);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not create subscription.');
    }
  };

  const doCancel = async () => {
    if (!cancelTarget) return;
    await doAction(cancelTarget, 'cancel');
    setCancelTarget(null);
  };

  const statusColor = (s: string) => {
    if (s === 'active') return '#10b981';
    if (s === 'paused') return '#f59e0b';
    if (s === 'cancelled') return COLORS.error;
    return mutedColor;
  };

  const plans: Plan[] = plansData || [];
  const subscriptions: Subscription[] = subsData?.subscriptions || [];
  const upcomingDeliveries: string[] = subsData?.upcomingDeliveries || [];

  if (!user) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.authPrompt}>
          <Text style={styles.authIcon}>🔄</Text>
          <Text style={[styles.authTitle, { color: textColor }]}>My Subscriptions</Text>
          <Text style={[styles.authText, { color: mutedColor }]}>Log in to manage your weekly fresh produce subscriptions and upcoming deliveries.</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginBtnText}>Sign In to Manage Subscriptions</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: bg }]}
      refreshControl={<RefreshControl refreshing={subsLoading} onRefresh={refetch} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
    >
      <View style={{ paddingTop: Math.max(insets.top + 10, 40), padding: 16 }}>
        <Text style={[styles.pageTitle, { color: textColor }]}>🔄 My Subscriptions</Text>

        {upcomingDeliveries.length > 0 && (
          <View style={[styles.upcomingCard, { backgroundColor: isDark ? '#022c22' : '#f0fdf4', borderColor: isDark ? '#065f46' : '#bbf7d0' }]}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#86efac' : '#15803d' }]}>📅 Upcoming Deliveries</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {upcomingDeliveries.slice(0, 4).map((d: any, index: number) => {
                const dateVal = typeof d === 'string' ? d : d?.date;
                const parsedDate = dateVal ? new Date(dateVal) : null;
                const key = typeof d === 'string' ? `date-${d}-${index}` : `date-${d?.date || index}-${d?.day || ''}-${index}`;
                const isValidDate = parsedDate && !isNaN(parsedDate.getTime());
                return (
                  <View key={key} style={[styles.dateBadge, { backgroundColor: isDark ? '#064e3b' : '#dcfce7' }]}>
                    <Text style={{ color: isDark ? '#86efac' : '#15803d', fontWeight: '700', fontSize: 12 }}>
                      {isValidDate
                        ? parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })
                        : String(dateVal || 'Scheduled')}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {subsLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
        ) : subscriptions.length === 0 ? (
          <View style={styles.noSubCard}>
            <Text style={{ fontSize: 40 }}>📦</Text>
            <Text style={[{ color: textColor, fontWeight: '700', fontSize: 16, marginTop: 10 }]}>No active subscriptions</Text>
            <Text style={[{ color: mutedColor, textAlign: 'center', marginTop: 6 }]}>Subscribe to a plan below for weekly fresh deliveries</Text>
          </View>
        ) : (
          subscriptions.map(sub => (
            <View key={sub.id} style={[styles.subCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[{ fontWeight: '800', fontSize: 16, color: textColor }]}>{sub.planName}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(sub.status) + '25' }]}>
                  <Text style={[{ color: statusColor(sub.status), fontWeight: '800', fontSize: 12 }]}>{sub.status.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={[{ color: mutedColor, fontSize: 13, marginBottom: 4 }]}>📅 Delivery: {sub.deliveryDays}</Text>
              <Text style={[{ color: mutedColor, fontSize: 12, marginBottom: 12 }]}>📍 {sub.address}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {sub.status === 'active' && (
                  <>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#1e3a5f' }]} onPress={() => doAction(sub.id, 'pause')}>
                      <Text style={styles.actionBtnText}>⏸ Pause</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#3b2614' }]} onPress={() => doAction(sub.id, 'skip')}>
                      <Text style={styles.actionBtnText}>⏭ Skip Next</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#3b0808' }]} onPress={() => setCancelTarget(sub.id)}>
                      <Text style={styles.actionBtnText}>✕ Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}
                {sub.status === 'paused' && (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#14532d' }]} onPress={() => doAction(sub.id, 'resume')}>
                    <Text style={styles.actionBtnText}>▶ Resume</Text>
                  </TouchableOpacity>
                )}
                {sub.status === 'cancelled' && (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#14532d' }]} onPress={() => doAction(sub.id, 'reactivate')}>
                    <Text style={styles.actionBtnText}>🔄 Reactivate</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}

        <Text style={[styles.sectionTitle, { color: textColor, marginTop: 24, marginBottom: 12 }]}>🌿 Available Plans</Text>
        {plansLoading ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          plans.filter(p => p.active).map(plan => (
            <View key={plan.id} style={[styles.planCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontWeight: '800', fontSize: 16, color: textColor }]}>{plan.name}</Text>
                  <Text style={[{ color: mutedColor, fontSize: 12, marginTop: 2 }]}>{plan.description}</Text>
                </View>
                <Text style={[{ color: COLORS.primary, fontWeight: '900', fontSize: 18 }]}>₹{parseFloat(plan.price).toFixed(0)}<Text style={{ fontSize: 11, color: mutedColor }}>/week</Text></Text>
              </View>
              <Text style={[{ color: mutedColor, fontSize: 12, marginBottom: 12 }]}>📅 Delivery: {plan.deliveryDays} • {plan.frequency}</Text>
              <TouchableOpacity
                style={styles.subscribeBtn}
                onPress={() => {
                  if (!user) { router.push('/(auth)/login'); return; }
                  setSubscribePlan(plan);
                  setDeliveryDays(plan.deliveryDays === 'both' ? 'saturday' : plan.deliveryDays);
                  setSubPhone(user?.phone || '');
                  setSubAddress('');
                  setSubscribeOpen(true);
                }}
              >
                <Text style={styles.subscribeBtnText}>Subscribe →</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </View>

      {/* Subscribe Modal */}
      <Modal visible={subscribeOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Subscribe to {subscribePlan?.name}</Text>
            <Text style={[{ color: mutedColor, fontSize: 13, marginBottom: 16 }]}>₹{parseFloat(subscribePlan?.price || '0').toFixed(0)}/week</Text>

            <Text style={[styles.inputLabel, { color: mutedColor }]}>Delivery Days</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {['saturday', 'sunday', 'both'].map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayBtn, { borderColor: deliveryDays === d ? COLORS.primary : borderCol, backgroundColor: deliveryDays === d ? COLORS.primary + '20' : 'transparent' }]}
                  onPress={() => setDeliveryDays(d)}
                >
                  <Text style={[{ color: deliveryDays === d ? COLORS.primary : mutedColor, fontWeight: '700', fontSize: 12 }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: mutedColor }]}>Phone</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: inputBg, borderColor: borderCol, color: textColor }]}
              placeholder="10-digit phone"
              placeholderTextColor={mutedColor}
              value={subPhone}
              onChangeText={setSubPhone}
              keyboardType="phone-pad"
            />

            <Text style={[styles.inputLabel, { color: mutedColor }]}>Delivery Address</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: inputBg, borderColor: borderCol, color: textColor, height: 80, textAlignVertical: 'top' }]}
              placeholder="Full delivery address"
              placeholderTextColor={mutedColor}
              value={subAddress}
              onChangeText={setSubAddress}
              multiline
            />

            <TouchableOpacity style={styles.subscribeBtn} onPress={doSubscribe}>
              <Text style={styles.subscribeBtnText}>Confirm Subscription</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 10, padding: 10, alignItems: 'center' }} onPress={() => setSubscribeOpen(false)}>
              <Text style={{ color: mutedColor }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cancel Confirmation */}
      <Modal visible={cancelTarget !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Cancel Subscription?</Text>
            <Text style={[{ color: mutedColor, marginBottom: 20, textAlign: 'center' }]}>This will stop all future deliveries. You can reactivate later.</Text>
            <TouchableOpacity style={[styles.subscribeBtn, { backgroundColor: COLORS.error }]} onPress={doCancel}>
              <Text style={styles.subscribeBtnText}>Yes, Cancel Subscription</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 10, padding: 10, alignItems: 'center' }} onPress={() => setCancelTarget(null)}>
              <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Keep Subscription</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageTitle: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  authPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 80 },
  authIcon: { fontSize: 64, marginBottom: 16 },
  authTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  authText: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  loginBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, width: '100%', alignItems: 'center' },
  loginBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  upcomingCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1.5 },
  dateBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  noSubCard: { alignItems: 'center', paddingVertical: 32 },
  subCard: { borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  actionBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
  planCard: { borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  subscribeBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  subscribeBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  modalInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 12 },
  dayBtn: { flex: 1, borderWidth: 1.5, borderRadius: 10, padding: 8, alignItems: 'center' },
});
