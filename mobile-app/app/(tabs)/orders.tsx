import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Modal, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/config';
import type { Order } from '../../lib/types';
import { useThemeStore } from '../../lib/theme';
import { useAuth } from '../../lib/store';

// ─── Status Config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; emoji: string; step: number }> = {
  Placed:             { color: '#f59e0b', emoji: '📋', step: 1 },
  Confirmed:          { color: '#3b82f6', emoji: '✅', step: 2 },
  Packed:             { color: '#8b5cf6', emoji: '📦', step: 3 },
  'Out for delivery': { color: '#f97316', emoji: '🛵', step: 4 },
  Delivered:          { color: '#10b981', emoji: '✅', step: 5 },
  Cancelled:          { color: '#ef4444', emoji: '❌', step: 0 },
};
const ORDER_STEPS = ['Placed', 'Confirmed', 'Packed', 'Out for delivery', 'Delivered'];

// ─── Skeleton Card ─────────────────────────────────────────────────────────────
function SkeletonCard({ isDark }: { isDark: boolean }) {
  const bg = isDark ? '#0c121e' : '#f1f5f9';
  const shimmer = isDark ? '#1e293b' : '#e2e8f0';
  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#0c121e' : '#fff', borderColor: isDark ? 'rgba(16,185,129,0.15)' : '#e2e8f0' }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ height: 16, width: 100, borderRadius: 8, backgroundColor: shimmer }} />
        <View style={{ height: 20, width: 80, borderRadius: 8, backgroundColor: shimmer }} />
      </View>
      <View style={{ height: 12, width: 140, borderRadius: 6, backgroundColor: shimmer, marginBottom: 12 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ height: 20, width: 60, borderRadius: 6, backgroundColor: shimmer }} />
        <View style={{ height: 20, width: 50, borderRadius: 6, backgroundColor: shimmer }} />
      </View>
    </View>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({ order, isDark }: { order: Order; isDark: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [reason, setReason] = useState('Damaged or Spoiled Perishables');
  const [comments, setComments] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cfg = STATUS_CONFIG[order.status] || { color: COLORS.textMuted, emoji: '📋', step: 1 };
  const cardBg = isDark ? '#0c121e' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : COLORS.text;
  const mutedColor = isDark ? '#94a3b8' : COLORS.textMuted;
  const borderCol = isDark ? 'rgba(16, 185, 129, 0.25)' : '#e2e8f0';
  const stepperActiveBg = isDark ? '#022c22' : '#f0fdf4';

  const currentStep = cfg.step;

  const handlePickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Media library access is required to attach damage photo proof.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          setPhotoUrl(`data:${mime};base64,${asset.base64}`);
        } else if (asset.uri) {
          setPhotoUrl(asset.uri);
        }
      }
    } catch (err) {
      Alert.alert('Photo Picker Error', 'Could not select photo. Please try again.');
    }
  };

  const handleSubmitRefundRequest = async () => {
    if (!photoUrl) {
      Alert.alert(
        '📸 Compulsory Photo Proof Required',
        'Please select or take a clear photo of the damaged or delivered produce before submitting your return/refund request.'
      );
      return;
    }
    if (!comments.trim()) {
      Alert.alert('Refund Details Required', 'Please describe the issue or reason for your refund request.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/api/orders/${order.id}/request-refund`, {
        customerName: order.customerName || '',
        customerPhone: order.phone || '',
        customerEmail: (order as any).customerEmail || (order as any).email || '',
        concern: `${reason}: ${comments.trim()}`,
        photoUrl,
        refundAmount: order.total,
      });

      setShowRefundModal(false);
      setComments('');
      setPhotoUrl('');
      Alert.alert(
        '✅ Refund Request Submitted',
        res.data?.message || `Refund request for Order #${order.id} submitted successfully!`
      );
    } catch (err: any) {
      Alert.alert('Refund Error', err?.response?.data?.message || 'Failed to submit refund request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
      {/* Header */}
      <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.cardHeader} activeOpacity={0.7}>
        <View>
          <Text style={[styles.orderId, { color: textColor }]}>Order #{order.id}</Text>
          <Text style={[styles.date, { color: mutedColor }]}>
            {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={[styles.statusBadge, { backgroundColor: cfg.color + '20', borderColor: cfg.color }]}>
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.emoji} {order.status}</Text>
          </View>
          <Text style={[styles.chevron, { color: mutedColor }]}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {/* Status Stepper */}
      {order.status !== 'Cancelled' && (
        <View style={[styles.stepperRow, { backgroundColor: stepperActiveBg, borderColor: borderCol }]}>
          {ORDER_STEPS.map((step, idx) => {
            const active = currentStep >= idx + 1;
            const isCurrentStep = currentStep === idx + 1;
            return (
              <View key={step} style={styles.stepContainer}>
                <View style={[styles.stepCircle, { backgroundColor: active ? COLORS.primary : (isDark ? '#1e293b' : '#e2e8f0'), borderColor: active ? COLORS.primary : (isDark ? '#334155' : '#cbd5e1') }]}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: active ? '#fff' : mutedColor }}>{idx + 1}</Text>
                </View>
                {idx < ORDER_STEPS.length - 1 && (
                  <View style={[styles.stepLine, { backgroundColor: active ? COLORS.primary : (isDark ? '#1e293b' : '#e2e8f0') }]} />
                )}
                <Text style={{ fontSize: 8, color: isCurrentStep ? COLORS.primary : mutedColor, fontWeight: isCurrentStep ? '800' : '400', marginTop: 3, textAlign: 'center' }} numberOfLines={1}>
                  {step.split(' ')[0]}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Footer summary */}
      <View style={styles.cardFooter}>
        <Text style={styles.total}>₹{parseFloat(order.total).toFixed(0)}</Text>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {order.couponCode && (
            <Text style={[styles.badge, { backgroundColor: isDark ? '#1a2e1a' : '#f0fdf4', color: '#10b981' }]}>🏷 {order.couponCode}</Text>
          )}
          <Text style={[styles.badge, { backgroundColor: isDark ? '#1a2332' : '#f1f5f9', color: mutedColor }]}>{order.paymentMethod}</Text>
        </View>
      </View>

      {/* Expanded order details */}
      {expanded && (
        <View style={[styles.expandedSection, { borderTopColor: borderCol }]}>
          {/* Delivery address */}
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.expandedTitle, { color: textColor }]}>📦 Delivery Address</Text>
            <Text style={[{ color: mutedColor, fontSize: 13, marginTop: 4 }]}>{order.address}</Text>
            {order.phone && <Text style={[{ color: mutedColor, fontSize: 12, marginTop: 2 }]}>📱 {order.phone}</Text>}
          </View>

          {/* Order items */}
          {(order as any).items && (order as any).items.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.expandedTitle, { color: textColor }]}>🛒 Items Ordered</Text>
              {(order as any).items.map((item: any) => (
                <View key={item.id} style={[styles.itemLineRow, { borderBottomColor: borderCol }]}>
                  <Text style={[{ color: textColor, fontSize: 13, flex: 1 }]}>{item.name} ({item.unit}) × {item.qty}</Text>
                  <Text style={[{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }]}>₹{parseFloat(item.lineTotal).toFixed(0)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Price breakdown */}
          <View style={{ marginBottom: 8 }}>
            <Text style={[styles.expandedTitle, { color: textColor }]}>🧾 Price Breakdown</Text>
            <View style={styles.breakdownRow}>
              <Text style={[{ color: mutedColor, fontSize: 12 }]}>Subtotal</Text>
              <Text style={[{ color: textColor, fontWeight: '600', fontSize: 12 }]}>₹{parseFloat(order.subtotal).toFixed(0)}</Text>
            </View>
            {parseFloat(order.discount) > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={[{ color: '#10b981', fontSize: 12 }]}>Discount</Text>
                <Text style={[{ color: '#10b981', fontWeight: '700', fontSize: 12 }]}>−₹{parseFloat(order.discount).toFixed(0)}</Text>
              </View>
            )}
            <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: borderCol, paddingTop: 6, marginTop: 4 }]}>
              <Text style={[{ color: textColor, fontWeight: '800', fontSize: 14 }]}>Total</Text>
              <Text style={[{ color: COLORS.primary, fontWeight: '800', fontSize: 14 }]}>₹{parseFloat(order.total).toFixed(0)}</Text>
            </View>
          </View>

          {/* Reorder and Refund Request Buttons */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <TouchableOpacity style={[styles.reorderBtn, { flex: 1 }]} onPress={() => router.push('/(tabs)')}>
              <Text style={styles.reorderBtnText}>🔄 Reorder</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.reorderBtn,
                { flex: 1, backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2', borderColor: '#f87171', borderWidth: 1 }
              ]}
              onPress={() => setShowRefundModal(true)}
            >
              <Text style={[styles.reorderBtnText, { color: '#ef4444' }]}>📸 Request Refund</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Compulsory Photo Proof Refund Modal */}
      <Modal visible={showRefundModal} transparent animationType="slide" onRequestClose={() => setShowRefundModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: isDark ? '#0b1320' : '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%', borderWidth: 1, borderColor: borderCol }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: textColor }}>📸 Request Order Return & Refund</Text>
              <TouchableOpacity onPress={() => setShowRefundModal(false)} style={{ padding: 6, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 12 }}>
                <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
              <View style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: borderCol }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: textColor }}>Order #{order.id} · Total ₹{parseFloat(order.total).toFixed(0)}</Text>
                <Text style={{ fontSize: 11, color: mutedColor, marginTop: 2 }}>{order.address}</Text>
              </View>

              {/* Select Reason */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: textColor, marginBottom: 6 }}>Select Issue Category:</Text>
                {['Damaged or Spoiled Perishables', 'Quality Issue / Rotten Items', 'Wrong Items Delivered', 'Severe Delivery Delay'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setReason(r)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: reason === r ? (isDark ? 'rgba(16,185,129,0.2)' : '#ecfdf5') : (isDark ? '#0f172a' : '#f8fafc'),
                      borderColor: reason === r ? '#10b981' : borderCol,
                      borderWidth: 1,
                      padding: 10,
                      borderRadius: 10,
                      marginBottom: 6,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: reason === r ? '800' : '400', color: reason === r ? '#10b981' : textColor, flex: 1 }}>{r}</Text>
                    {reason === r && <Text style={{ color: '#10b981', fontWeight: 'bold' }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Compulsory Photo Upload */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#ef4444', marginBottom: 4 }}>
                  📸 Damage Photo Proof (COMPULSORY *):
                </Text>
                <Text style={{ fontSize: 11, color: mutedColor, marginBottom: 8 }}>
                  Attach a clear photo of the damaged produce item or package proof. Requests without photo proof cannot be processed.
                </Text>

                {photoUrl ? (
                  <View style={{ alignItems: 'center', gap: 8 }}>
                    <Image source={{ uri: photoUrl }} style={{ width: '100%', height: 160, borderRadius: 12, borderWidth: 1, borderColor: '#10b981' }} resizeMode="cover" />
                    <TouchableOpacity onPress={handlePickPhoto} style={{ backgroundColor: isDark ? '#1e293b' : '#e2e8f0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: textColor }}>🔄 Change Photo</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handlePickPhoto}
                    style={{
                      height: 110,
                      backgroundColor: isDark ? '#0f172a' : '#fef2f2',
                      borderColor: '#ef4444',
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>📷</Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#ef4444' }}>+ Upload Damage Photo Proof (Required)</Text>
                    <Text style={{ fontSize: 10, color: mutedColor }}>Tap to choose photo from gallery / camera</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Detailed Comments */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: textColor, marginBottom: 4 }}>Describe Issue / Notes:</Text>
                <TextInput
                  style={{
                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                    color: textColor,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: borderCol,
                    fontSize: 12,
                    height: 70,
                  }}
                  placeholder="Tell us what was wrong with your item or delivery..."
                  placeholderTextColor={mutedColor}
                  multiline
                  value={comments}
                  onChangeText={setComments}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#ef4444',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginTop: 6,
                  opacity: submitting ? 0.6 : 1,
                }}
                onPress={handleSubmitRefundRequest}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>Submit Refund Request & Photo Proof</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Orders Screen ─────────────────────────────────────────────────────────────
export default function OrdersScreen() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.get('/api/orders/mine').then((r) => r.data),
    enabled: !!user,
    staleTime: 30000,
  });

  const orders: Order[] = data?.orders || data || [];
  const bg = isDark ? '#000000' : '#f8fafc';
  const textColor = isDark ? '#f8fafc' : COLORS.text;
  const mutedColor = isDark ? '#94a3b8' : COLORS.textMuted;

  // ── Not logged in ──────────────────────────────────────────────────────
  if (!user) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
        <View style={styles.authPrompt}>
          <Text style={styles.authIcon}>📦</Text>
          <Text style={[styles.authTitle, { color: textColor }]}>Track Your Orders</Text>
          <Text style={[styles.authText, { color: mutedColor }]}>
            Log in to view your order history, track deliveries, and reorder your favourites.
          </Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginBtnText}>Sign In / Register →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shopBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={[styles.shopBtnText, { color: mutedColor }]}>🛒 Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: bg, paddingTop: Math.max(insets.top + 10, 16) }]}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
    >
      <Text style={[styles.pageTitle, { color: textColor }]}>📦 My Orders</Text>

      {isLoading ? (
        // Skeleton loading
        <>
          <SkeletonCard isDark={isDark} />
          <SkeletonCard isDark={isDark} />
          <SkeletonCard isDark={isDark} />
        </>
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={[styles.emptyTitle, { color: textColor }]}>No orders yet</Text>
          <Text style={[styles.emptyText, { color: mutedColor }]}>Your order history will appear here</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.loginBtnText}>🛒 Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        orders.map((o) => <OrderCard key={o.id} order={o} isDark={isDark} />)
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  pageTitle: { fontSize: 22, fontWeight: '800', marginBottom: 16, marginTop: 8 },

  card: { borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  orderId: { fontSize: 15, fontWeight: '700' },
  date: { fontSize: 12, marginTop: 2 },
  statusBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  chevron: { fontSize: 11, marginTop: 4 },

  stepperRow: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 10, padding: 8, marginBottom: 10, borderWidth: 1 },
  stepContainer: { flex: 1, alignItems: 'center' },
  stepCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepLine: { position: 'absolute', right: -4, top: 9, left: '100%', height: 2, width: '100%' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  total: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  badge: { fontSize: 11, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, overflow: 'hidden', fontWeight: '700' },

  expandedSection: { borderTopWidth: 1, paddingTop: 12, marginTop: 8 },
  expandedTitle: { fontSize: 13, fontWeight: '800', marginBottom: 6 },
  itemLineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  reorderBtn: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 8 },
  reorderBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  authPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 80 },
  authIcon: { fontSize: 64, marginBottom: 16 },
  authTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  authText: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  loginBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14, width: '100%', alignItems: 'center', marginBottom: 10 },
  loginBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  shopBtn: { marginTop: 6, paddingVertical: 8 },
  shopBtnText: { fontSize: 14, fontWeight: '600' },

  empty: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyText: { fontSize: 13, marginBottom: 20 },
});
