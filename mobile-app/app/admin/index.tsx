import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useThemeStore } from '../../lib/theme';
import { COLORS } from '../../constants/config';

export default function AdminDashboardScreen() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const queryClient = useQueryClient();
  
  const bg = isDark ? '#000000' : '#f8fafc';
  const cardBg = isDark ? '#0c121e' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : COLORS.text;
  const mutedColor = isDark ? '#94a3b8' : COLORS.textMuted;
  const borderCol = isDark ? 'rgba(16, 185, 129, 0.25)' : '#e2e8f0';

  const [activeTab, setActiveTab] = useState<'orders' | 'inventory' | 'pincodes'>('orders');

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => api.get('/api/admin/orders').then(r => r.data),
    enabled: activeTab === 'orders'
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => api.get('/api/products').then(r => r.data),
    enabled: activeTab === 'inventory'
  });

  const updateOrderStatus = useMutation({
    mutationFn: ({ id, status }: { id: number, status: string }) => api.patch(`/api/orders/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    }
  });

  const adjustStock = useMutation({
    mutationFn: ({ id, changeQty }: { id: number, changeQty: number }) => api.post(`/api/admin/inventory/${id}/adjust`, { changeQty }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    }
  });

  const statuses = ['placed', 'confirmed', 'packed', 'out_for_delivery', 'delivered'];
  const statusLabels: Record<string, string> = {
    'placed': 'Placed',
    'confirmed': 'Confirmed',
    'packed': 'Packed',
    'out_for_delivery': 'Out for delivery',
    'delivered': 'Delivered'
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.navBar, { borderBottomColor: borderCol }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: textColor }]}>Admin Control</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'orders' && styles.tabActive]} onPress={() => setActiveTab('orders')}>
          <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>📦 Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'inventory' && styles.tabActive]} onPress={() => setActiveTab('inventory')}>
          <Text style={[styles.tabText, activeTab === 'inventory' && styles.tabTextActive]}>🌾 Stock</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'pincodes' && styles.tabActive]} onPress={() => setActiveTab('pincodes')}>
          <Text style={[styles.tabText, activeTab === 'pincodes' && styles.tabTextActive]}>🚚 Pincodes</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'orders' && (
          <View style={styles.tabContent}>
            {ordersLoading ? <ActivityIndicator size="large" color="#10b981" /> : (orders || []).map((order: any) => (
              <View key={order.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <Text style={[styles.cardTitle, { color: textColor }]}>Order #{order.id}</Text>
                <Text style={[styles.cardSubtitle, { color: mutedColor }]}>{order.customerName}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{statusLabels[order.status] || order.status}</Text>
                </View>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => {
                    const nextIdx = statuses.indexOf(order.status) + 1;
                    if (nextIdx < statuses.length) updateOrderStatus.mutate({ id: order.id, status: statuses[nextIdx] });
                  }}>
                    <Text style={styles.actionBtnText}>Advance Status →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'inventory' && (
          <View style={styles.tabContent}>
            {productsLoading ? <ActivityIndicator size="large" color="#10b981" /> : (products || []).map((product: any) => (
              <View key={product.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <Text style={[styles.cardTitle, { color: textColor }]}>{product.name}</Text>
                <Text style={[styles.stockText, { color: textColor }]}>{product.stock} units remaining</Text>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.outlineBtn} onPress={() => adjustStock.mutate({ id: product.id, changeQty: -10 })}>
                    <Text style={[styles.outlineBtnText, { color: textColor }]}>-10 Stock</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.outlineBtn} onPress={() => adjustStock.mutate({ id: product.id, changeQty: 50 })}>
                    <Text style={[styles.outlineBtnText, { color: textColor }]}>+50 Stock</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'pincodes' && (
          <View style={styles.tabContent}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>Manage Delivery Pincodes</Text>
              <Text style={[styles.cardSubtitle, { color: mutedColor }]}>This feature is currently configured via web admin panel settings. Mobile pincode manager coming soon.</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  backBtnText: { color: '#10b981', fontWeight: 'bold', fontSize: 13 },
  navTitle: { fontSize: 18, fontWeight: '700' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(16, 185, 129, 0.25)' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#10b981' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  tabTextActive: { color: '#10b981', fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  tabContent: { gap: 16, paddingBottom: 40 },
  card: { padding: 20, borderRadius: 16, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 20, fontWeight: '800' },
  cardSubtitle: { fontSize: 14 },
  statusBadge: { backgroundColor: 'rgba(59, 130, 246, 0.15)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'flex-start' },
  statusText: { color: '#3b82f6', fontWeight: '700', fontSize: 16 },
  actionBtn: { backgroundColor: '#10b981', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 8, flex: 1 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  stockText: { fontSize: 24, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  outlineBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', padding: 12, borderRadius: 12, alignItems: 'center' },
  outlineBtnText: { fontWeight: '600' },
});
