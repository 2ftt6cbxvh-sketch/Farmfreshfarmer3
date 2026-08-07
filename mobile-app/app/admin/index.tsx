import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { useThemeStore } from '../../lib/theme';
import { COLORS } from '../../constants/config';

export default function AdminDashboardScreen() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  
  const bg = isDark ? '#000000' : '#f8fafc';
  const cardBg = isDark ? '#0c121e' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : COLORS.text;
  const mutedColor = isDark ? '#94a3b8' : COLORS.textMuted;
  const borderCol = isDark ? 'rgba(16, 185, 129, 0.25)' : '#e2e8f0';

  const [orderStatus, setOrderStatus] = useState('Placed');
  const [stockLevel, setStockLevel] = useState(150);

  const statuses = ['Placed', 'Packed', 'Out for delivery', 'Delivered'];

  const cycleStatus = () => {
    const nextIdx = (statuses.indexOf(orderStatus) + 1) % statuses.length;
    setOrderStatus(statuses[nextIdx]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.navBar, { borderBottomColor: borderCol }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: textColor }]}>Admin Control</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Order Fulfillment</Text>
          <Text style={[styles.cardSubtitle, { color: mutedColor }]}>Current Demo Order Status:</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{orderStatus}</Text>
          </View>
          <TouchableOpacity style={styles.actionBtn} onPress={cycleStatus}>
            <Text style={styles.actionBtnText}>Advance Status →</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Stock Inventory</Text>
          <Text style={[styles.cardSubtitle, { color: mutedColor }]}>Organic Tomatoes</Text>
          <Text style={[styles.stockText, { color: textColor }]}>{stockLevel} units remaining</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => setStockLevel(Math.max(0, stockLevel - 10))}>
              <Text style={[styles.outlineBtnText, { color: textColor }]}>-10 Stock</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => setStockLevel(stockLevel + 50)}>
              <Text style={[styles.outlineBtnText, { color: textColor }]}>+50 Stock</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  backBtnText: { color: '#10b981', fontWeight: 'bold', fontSize: 13 },
  navTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 16, gap: 16 },
  card: { padding: 20, borderRadius: 16, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 20, fontWeight: '800' },
  cardSubtitle: { fontSize: 14 },
  statusBadge: { backgroundColor: 'rgba(59, 130, 246, 0.15)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'flex-start' },
  statusText: { color: '#3b82f6', fontWeight: '700', fontSize: 16 },
  actionBtn: { backgroundColor: '#10b981', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  stockText: { fontSize: 28, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  outlineBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', padding: 12, borderRadius: 12, alignItems: 'center' },
  outlineBtnText: { fontWeight: '600' },
});
