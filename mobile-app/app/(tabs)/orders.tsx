import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/config';
import type { Order } from '../../lib/types';
import { useThemeStore } from '../../lib/theme';

function OrderCard({ order }: { order: Order }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const statusColor = {
    Placed: COLORS.accent, Packed: '#3b82f6', 'Out for delivery': '#f59e0b',
    Delivered: COLORS.success, Cancelled: COLORS.error,
  }[order.status] || COLORS.textMuted;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>Order #{order.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{order.status}</Text>
        </View>
      </View>
      <Text style={styles.date}>{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.total}>₹{parseFloat(order.total).toFixed(0)}</Text>
        <Text style={styles.method}>{order.paymentMethod}</Text>
      </View>
    </View>
  );
}

export default function OrdersScreen() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.get('/api/orders/mine').then((r) => r.data),
  });

  const orders: Order[] = data?.orders || data || [];

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}>
      <Text style={styles.pageTitle}>My Orders</Text>
      {isLoading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyText}>Your order history will appear here</Text>
        </View>
      ) : (
        orders.map((o) => <OrderCard key={o.id} order={o} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? '#000000' : '#f8fafc', padding: 16 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: isDark ? '#f8fafc' : COLORS.text, marginBottom: 16, marginTop: 8 },
  card: { backgroundColor: isDark ? '#0c121e' : '#ffffff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderId: { fontSize: 15, fontWeight: '700', color: isDark ? '#f8fafc' : COLORS.text },
  statusBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  date: { fontSize: 12, color: isDark ? '#f8fafc' : COLORS.textMuted, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  method: { fontSize: 12, color: isDark ? '#f8fafc' : COLORS.textMuted, backgroundColor: '#f1f5f9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: isDark ? '#f8fafc' : COLORS.text, marginBottom: 6 },
  emptyText: { fontSize: 13, color: isDark ? '#f8fafc' : COLORS.textMuted },
});
