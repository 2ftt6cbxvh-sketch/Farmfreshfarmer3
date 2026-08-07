import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../../constants/config';
import { useDelivery } from '../../hooks/useDelivery';

export default function BasketScreen() {
  const [items, setItems] = useState<any[]>([]);
  const { resolution } = useDelivery();
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryFee = resolution?.fee || 0;
  const total = subtotal + deliveryFee;

  if (items.length === 0) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🧺</Text>
          <Text style={styles.emptyTitle}>Your Basket is Empty</Text>
          <Text style={styles.emptyText}>Add some fresh organic fruits, sweets, or pickles to get started.</Text>
          <TouchableOpacity style={styles.shopButton} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.shopButtonText}>Start Shopping Now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.headerTitle}>Your Basket ({items.length})</Text>

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

        {/* Items List */}
        {items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemUnit}>{item.unit}</Text>
              <Text style={styles.itemPrice}>₹{(item.price * item.qty).toFixed(0)}</Text>
            </View>
            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => {
                  if (item.qty <= 1) {
                    setItems((prev) => prev.filter((i) => i.id !== item.id));
                  } else {
                    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty - 1 } : i)));
                  }
                }}
              >
                <Text style={styles.qtyBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.qty}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i)))}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Delivery Details */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor={COLORS.textMuted}
            value={customerName}
            onChangeText={setCustomerName}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <TextInput
            style={[styles.input, { height: 70 }]}
            placeholder="Full Street Address"
            placeholderTextColor={COLORS.textMuted}
            multiline
            value={address}
            onChangeText={setAddress}
          />
        </View>

        {/* Order Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryVal}>₹{subtotal.toFixed(0)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Charge</Text>
            <Text style={[styles.summaryVal, { color: COLORS.primary }]}>
              {deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`}
            </Text>
          </View>
          <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, marginTop: 10 }]}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalVal}>₹{total.toFixed(0)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => {
            if (!customerName || !phone || !address) {
              Alert.alert('Delivery Info Required', 'Please enter your name, phone, and delivery address.');
              return;
            }
            Alert.alert('Order Placed! 🎉', `Order total ₹${total.toFixed(0)}. Cash on Delivery.`);
            setItems([]);
          }}
        >
          <Text style={styles.checkoutBtnText}>Place Order · ₹{total.toFixed(0)}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingTop: 45 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, marginBottom: 24, textAlign: 'center' },
  shopButton: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  shopButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  timingCard: {
    backgroundColor: '#092615', border: '1px solid #15803d', borderRadius: 16, padding: 14, marginBottom: 16,
  },
  timingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timingLocation: { color: '#f59e0b', fontWeight: 'bold', fontSize: 13 },
  timingEta: { color: '#86efac', fontWeight: 'bold', fontSize: 12 },
  timingDetails: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#15803d', gap: 4 },
  timingText: { color: '#e2e8f0', fontSize: 12 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff',
    padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0',
  },
  itemName: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  itemUnit: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: 'bold', color: COLORS.primary, marginTop: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4 },
  qtyBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#ffffff' },
  qtyBtnText: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  qtyText: { paddingHorizontal: 10, fontSize: 14, fontWeight: 'bold', color: COLORS.text },
  sectionCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 12 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, marginBottom: 10, fontSize: 14, color: COLORS.text },
  summaryCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: 14, color: COLORS.textMuted },
  summaryVal: { fontSize: 14, fontWeight: 'bold', color: COLORS.text },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  totalVal: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
  checkoutBtn: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 40 },
  checkoutBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});
