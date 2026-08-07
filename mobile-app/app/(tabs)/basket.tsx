import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { COLORS } from '../../constants/config';
import { useDelivery } from '../../hooks/useDelivery';
import { useThemeStore } from '../../lib/theme';
import { useCartStore } from '../../lib/cart';

export default function BasketScreen() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const { items, updateQty, removeItem, clearCart } = useCartStore();
  const { resolution } = useDelivery();
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (resolution?.locationArea && !address) {
      setAddress(resolution.locationArea);
    }
  }, [resolution]);

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryFee = resolution?.fee || 0;
  const total = subtotal + deliveryFee;

  const isServiceable = !resolution || resolution.serviceable !== false;

  const bg = isDark ? '#000000' : '#f8fafc';
  const cardBg = isDark ? '#0c121e' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : COLORS.text;
  const mutedColor = isDark ? '#94a3b8' : COLORS.textMuted;
  const borderCol = isDark ? 'rgba(16, 185, 129, 0.25)' : '#e2e8f0';

  if (items.length === 0) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: bg }]}>
        <View style={[styles.empty, { paddingTop: insets.top + 40 }]}>
          <Text style={styles.emptyIcon}>🧺</Text>
          <Text style={[styles.emptyTitle, { color: textColor }]}>Your Basket is Empty</Text>
          <Text style={[styles.emptyText, { color: mutedColor }]}>Add some fresh organic fruits, sweets, or pickles to get started.</Text>
          <TouchableOpacity style={styles.shopButton} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.shopButtonText}>Start Shopping Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.shopButton, { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }]} onPress={() => router.push('/(tabs)/orders')}>
            <Text style={[styles.shopButtonText, { color: textColor }]}>📦 My Orders</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.content, { paddingTop: Math.max(insets.top + 10, 45) }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Your Basket ({items.length})</Text>

        {/* Warehouse Delivery Timing Card */}
        {resolution?.serviceable && (
          <View style={styles.timingCard}>
            <View style={styles.timingHeader}>
              <Text style={styles.timingLocation}>📍 {resolution.locationArea || 'Delivery Address'}</Text>
              <Text style={styles.timingEta}>⏱️ {resolution.etaMinutes} mins ETA</Text>
            </View>
            <View style={styles.timingDetails}>
              <Text style={styles.timingText}>🏬 Warehouse: {resolution.warehouseName}</Text>
              <Text style={styles.timingText}>📦 Packing: {resolution.packingTimeMinutes || 30} mins</Text>
              {!!resolution.travelTimeMinutes && (
                <Text style={styles.timingText}>🚚 Transit: {resolution.travelTimeMinutes} mins ({resolution.distanceKm} km)</Text>
              )}
            </View>
          </View>
        )}

        {resolution && resolution.serviceable === false && (
          <View style={styles.nonServiceableCard}>
            <Text style={styles.nonServiceableTitle}>🛑 Delivery Unavailable</Text>
            <Text style={styles.nonServiceableText}>
              We cannot deliver to {resolution.locationArea || resolution.pincode || 'this location'} right now. Please change your pincode/GPS location in the top bar to place an order.
            </Text>
          </View>
        )}

        {/* Items List */}
        {items.map((item) => (
          <View key={item.id} style={[styles.itemRow, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, { color: textColor }]}>{item.name}</Text>
              <Text style={[styles.itemUnit, { color: mutedColor }]}>{item.unit}</Text>
              <Text style={styles.itemPrice}>₹{(item.price * item.qty).toFixed(0)}</Text>
            </View>
            <View style={[styles.qtyRow, { backgroundColor: isDark ? '#1a2332' : '#f1f5f9' }]}>
              <TouchableOpacity
                style={[styles.qtyBtn, { backgroundColor: cardBg }]}
                onPress={() => {
                  if (item.qty <= 1) {
                    removeItem(item.id);
                  } else {
                    updateQty(item.id, -1);
                  }
                }}
              >
                <Text style={[styles.qtyBtnText, { color: textColor }]}>-</Text>
              </TouchableOpacity>
              <Text style={[styles.qtyText, { color: textColor }]}>{item.qty}</Text>
              <TouchableOpacity
                style={[styles.qtyBtn, { backgroundColor: cardBg }]}
                onPress={() => updateQty(item.id, 1)}
              >
                <Text style={[styles.qtyBtnText, { color: textColor }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Delivery Details */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Delivery Details</Text>
          <TextInput
            style={[styles.input, { backgroundColor: bg, borderColor: borderCol, color: textColor }]}
            placeholder="Full Name"
            placeholderTextColor={mutedColor}
            value={customerName}
            onChangeText={setCustomerName}
          />
          <TextInput
            style={[styles.input, { backgroundColor: bg, borderColor: borderCol, color: textColor }]}
            placeholder="Phone Number"
            placeholderTextColor={mutedColor}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <TextInput
            style={[styles.input, { backgroundColor: bg, borderColor: borderCol, color: textColor, height: 70 }]}
            placeholder="Full Street Address"
            placeholderTextColor={mutedColor}
            multiline
            value={address}
            onChangeText={setAddress}
          />
        </View>

        {/* Order Summary */}
        <View style={[styles.summaryCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: mutedColor }]}>Subtotal</Text>
            <Text style={[styles.summaryVal, { color: textColor }]}>₹{subtotal.toFixed(0)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: mutedColor }]}>Delivery Charge</Text>
            <Text style={[styles.summaryVal, { color: COLORS.primary }]}>
              {deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`}
            </Text>
          </View>
          <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: borderCol, paddingTop: 10, marginTop: 10 }]}>
            <Text style={[styles.totalLabel, { color: textColor }]}>Grand Total</Text>
            <Text style={styles.totalVal}>₹{total.toFixed(0)}</Text>
          </View>
        </View>

        <TouchableOpacity
          disabled={!isServiceable}
          style={[styles.checkoutBtn, !isServiceable && { backgroundColor: '#64748b', opacity: 0.7 }]}
          onPress={() => {
            if (!isServiceable) {
              Alert.alert('Delivery Unavailable', 'Your location is not serviceable right now. Please change location.');
              return;
            }
            if (!customerName || !phone || !address) {
              Alert.alert('Delivery Info Required', 'Please enter your name, phone, and delivery address.');
              return;
            }
            Alert.alert('Order Placed! 🎉', `Order total ₹${total.toFixed(0)}. Cash on Delivery.`);
            clearCart();
          }}
        >
          <Text style={styles.checkoutBtnText}>Place Order · ₹{total.toFixed(0)}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 45 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, marginBottom: 24, textAlign: 'center' },
  shopButton: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  shopButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  timingCard: { backgroundColor: '#092615', borderWidth: 1, borderColor: '#15803d', borderRadius: 16, padding: 14, marginBottom: 16, shadowColor: '#10b981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 },
  timingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timingLocation: { color: '#f59e0b', fontWeight: 'bold', fontSize: 13 },
  timingEta: { color: '#86efac', fontWeight: 'bold', fontSize: 12 },
  timingDetails: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#15803d', gap: 4 },
  timingText: { color: '#e2e8f0', fontSize: 12 },
  nonServiceableCard: { backgroundColor: '#450a0a', borderColor: '#b91c1c', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16, shadowColor: '#ef4444', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 },
  nonServiceableTitle: { color: '#fca5a5', fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  nonServiceableText: { color: '#fecdd3', fontSize: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  itemName: { fontSize: 15, fontWeight: 'bold' },
  itemUnit: { fontSize: 12, marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: 'bold', color: COLORS.primary, marginTop: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 4 },
  qtyBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  qtyBtnText: { fontSize: 16, fontWeight: 'bold' },
  qtyText: { paddingHorizontal: 10, fontSize: 14, fontWeight: 'bold' },
  sectionCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10, fontSize: 14 },
  summaryCard: { borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: 14 },
  summaryVal: { fontSize: 14, fontWeight: 'bold' },
  totalLabel: { fontSize: 16, fontWeight: 'bold' },
  totalVal: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
  checkoutBtn: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 40 },
  checkoutBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});
