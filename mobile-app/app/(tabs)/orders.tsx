import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/config';
import type { Order } from '../../lib/types';
import { useThemeStore } from '../../lib/theme';

function OrderCard({ order, isDark }: { order: Order; isDark: boolean }) {
  const statusColor = {
    Placed: COLORS.accent, Packed: '#3b82f6', 'Out for delivery': '#f59e0b',
    Delivered: COLORS.success, Cancelled: COLORS.error,
  }[order.status] || COLORS.textMuted;

  const cardBg = isDark ? '#0c121e' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : COLORS.text;
  const mutedColor = isDark ? '#94a3b8' : COLORS.textMuted;
  const borderCol = isDark ? 'rgba(16, 185, 129, 0.25)' : '#e2e8f0';

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.orderId, { color: textColor }]}>Order #{order.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{order.status}</Text>
        </View>
      </View>
      <Text style={[styles.date, { color: mutedColor }]}>{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.total}>₹{parseFloat(order.total).toFixed(0)}</Text>
        <Text style={[styles.method, { color: mutedColor, backgroundColor: isDark ? '#1a2332' : '#f1f5f9' }]}>{order.paymentMethod}</Text>
      </View>
    </View>
  );
}

export default function OrdersScreen() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.get('/api/orders/mine').then((r) => r.data),
  });

  const orders: Order[] = data?.orders || data || [];
  const bg = isDark ? '#000000' : '#f8fafc';
  const textColor = isDark ? '#f8fafc' : COLORS.text;
  const mutedColor = isDark ? '#94a3b8' : COLORS.textMuted;

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg, paddingTop: Math.max(insets.top + 10, 16) }]} refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}>
      <Text style={[styles.pageTitle, { color: textColor }]}>My Orders</Text>
      {isLoading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={[styles.emptyTitle, { color: textColor }]}>No orders yet</Text>
          <Text style={[styles.emptyText, { color: mutedColor }]}>Your order history will appear here</Text>
        </View>
      ) : (
        orders.map((o) => <OrderCard key={o.id} order={o} isDark={isDark} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  pageTitle: { fontSize: 22, fontWeight: '800', marginBottom: 16, marginTop: 8 },
  card: { borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderId: { fontSize: 15, fontWeight: '700' },
  statusBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  date: { fontSize: 12, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  method: { fontSize: 12, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyText: { fontSize: 13 },
});
