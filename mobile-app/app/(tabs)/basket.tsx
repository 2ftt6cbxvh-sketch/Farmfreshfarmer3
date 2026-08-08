import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert,
  ActivityIndicator, Image, Switch, Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { COLORS, BRAND } from '../../constants/config';
import { useDelivery } from '../../hooks/useDelivery';
import { useThemeStore } from '../../lib/theme';
import { useCartStore } from '../../lib/cart';
import { useAuth } from '../../lib/store';
import { api, resolveImgUrl } from '../../lib/api';
import type { Product } from '../../lib/types';

interface PriceQuote {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  deliveryCity: string | null;
  total: number;
  firstOrderDiscount: number;
  referralDiscount: number;
  referralRewardApplied: number;
  couponDiscount: number;
  breakdown: Array<{ ruleType: string; label: string; amount: number }>;
  taxableSubtotal?: number;
  cgst?: number;
  sgst?: number;
  totalGst?: number;
}

export default function BasketScreen() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const { items, updateQty, removeItem, clearCart } = useCartStore();
  const { resolution, resolveByPincode, resolveByGps, isLoading: deliveryLoading } = useDelivery();
  const { user } = useAuth();

  // Delivery details
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [cityArea, setCityArea] = useState(resolution?.locationArea || '');
  const [streetAddress, setStreetAddress] = useState('');
  const [inputPincode, setInputPincode] = useState(resolution?.pincode || '');

  // International / Out-of-station shipping toggle
  const [isInternationalDelivery, setIsInternationalDelivery] = useState(false);

  // Coupon / referral
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discountPercent: number } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const [referralValidated, setReferralValidated] = useState<string | null>(null);
  const [referralBusy, setReferralBusy] = useState(false);
  const [redeemReward, setRedeemReward] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'PHONEPE'>('PHONEPE');
  const [placingOrder, setPlacingOrder] = useState(false);

  useEffect(() => { useCartStore.getState().syncWithServer(); }, []);

  useEffect(() => {
    if (user?.name && !customerName) setCustomerName(user.name);
    if (user?.phone && !phone) setPhone(user.phone);
  }, [user]);

  useEffect(() => {
    if (resolution?.locationArea) setCityArea(resolution.locationArea);
    if (resolution?.pincode) setInputPincode(resolution.pincode);
  }, [resolution]);

  // Fetch all products to check local-only constraints
  const { data: allProductsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/api/products').then((r) => r.data),
  });
  const allProducts: Product[] = allProductsData?.products || allProductsData || [];

  // Local-only items in cart (conflict with out-of-station shipping)
  const localOnlyConflictItems = useMemo(() => {
    return items.filter((cartItem) => {
      const p = allProducts.find((prod) => prod.id === cartItem.id || (prod as any).productId === cartItem.id);
      return p && p.allowInternationalShipping === false;
    });
  }, [items, allProducts]);

  const handleToggleInternational = (checked: boolean) => {
    if (checked && localOnlyConflictItems.length > 0) {
      setIsInternationalDelivery(false);
      Alert.alert(
        '⚠️ Cannot Enable Out-of-Station Shipping',
        `Your cart contains ${localOnlyConflictItems.length} item(s) restricted to local warehouse delivery only. Please remove them to proceed with international shipping.`
      );
      return;
    }
    setIsInternationalDelivery(checked);
  };

  const handleRemoveLocalOnlyItems = () => {
    localOnlyConflictItems.forEach((it) => removeItem(it.id));
    setIsInternationalDelivery(true);
    Alert.alert('✅ Local Items Removed', 'International / Out-of-Station Shipping mode activated.');
  };

  // Subtotal & live server price quote
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  const { data: quote } = useQuery<PriceQuote>({
    queryKey: ['price-quote', items.map((i) => `${i.id}:${i.qty}`).join(','), coupon?.code, referralValidated, redeemReward, cityArea, inputPincode],
    queryFn: async () => {
      if (items.length === 0) return null;
      const res = await api.post('/api/price/quote', {
        items: items.map((i) => ({ productId: i.id, qty: i.qty })),
        couponCode: coupon?.code || null,
        referralCode: referralValidated || null,
        redeemReward,
        city: cityArea || null,
        pincode: inputPincode || '522502',
      });
      return res.data;
    },
    enabled: items.length > 0,
    staleTime: 5000,
  });

  const { data: checkoutConfig } = useQuery({
    queryKey: ['checkout-config'],
    queryFn: () => api.get('/api/checkout-config').then((r) => r.data),
    staleTime: 60000,
  });

  // Calculate taxes and itemized financial breakdown
  const taxableSubtotal = Math.round((subtotal / 1.05) * 100) / 100;
  const totalGst = Math.round((subtotal - taxableSubtotal) * 100) / 100;
  const cgst = Math.round((totalGst / 2) * 100) / 100;
  const sgst = Math.round((totalGst - cgst) * 100) / 100;

  const isLocationUnserviceable = !isInternationalDelivery && resolution && resolution.serviceable === false;
  const freeDeliveryThreshold = Number(resolution?.freeDeliveryAbove || 500);
  const isFreeDelivery = subtotal >= freeDeliveryThreshold;
  const fallbackDeliveryFee = (isInternationalDelivery || isLocationUnserviceable) ? 0 : ((resolution?.fee && resolution.fee > 0) ? Number(resolution.fee) : (isFreeDelivery ? 0 : 30));
  const effectiveDeliveryFee = (isInternationalDelivery || isLocationUnserviceable) ? 0 : (quote ? Number(quote.deliveryFee) : fallbackDeliveryFee);

  const discountAmount = quote ? Number(quote.discount) : (coupon ? Math.round(subtotal * (coupon.discountPercent / 100)) : 0);
  const grandTotal = quote ? Number(quote.total) : Math.max(0, subtotal - discountAmount + effectiveDeliveryFee);

  const applyCoupon = useCallback(async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponBusy(true);
    try {
      const res = await api.get(`/api/coupons/validate?code=${encodeURIComponent(code)}&subtotal=${subtotal}`);
      if (res.data?.valid) {
        setCoupon({ code: res.data.code, discountPercent: Number(res.data.discountPercent) });
        Alert.alert('✅ Coupon Applied!', `${res.data.discountPercent}% discount applied to your order.`);
      } else {
        setCoupon(null);
        Alert.alert('Coupon Not Valid', res.data?.message || 'Please check the code.');
      }
    } catch {
      Alert.alert('Invalid Coupon', 'Please check the code and try again.');
    } finally {
      setCouponBusy(false);
    }
  }, [couponInput, subtotal]);

  const validateReferral = useCallback(async () => {
    const code = referralInput.trim().toUpperCase();
    if (!code) return;
    setReferralBusy(true);
    try {
      const res = await api.get(`/api/referral/validate?code=${encodeURIComponent(code)}`);
      if (res.data?.valid) {
        setReferralValidated(res.data.code);
        Alert.alert('🎁 Referral Code Applied!', '10% referral discount will be applied on your first order.');
      } else {
        setReferralValidated(null);
        Alert.alert('Referral Code Not Valid', res.data?.message || 'Please check the code.');
      }
    } catch {
      Alert.alert('Invalid Code', 'Could not validate referral code.');
    } finally {
      setReferralBusy(false);
    }
  }, [referralInput]);

  const handleCheckout = async () => {
    if (!isInternationalDelivery && resolution && resolution.serviceable === false) {
      Alert.alert('Delivery Unavailable', 'We cannot deliver to your location right now. Please enter a serviceable PIN code or turn on International Shipping above.');
      return;
    }
    if (!customerName.trim() || !phone.trim() || !cityArea.trim() || !streetAddress.trim()) {
      Alert.alert('Complete Address Required 📍', 'Please enter your Full Name, 10-digit Phone Number, City/Area, and Complete Street Address.');
      return;
    }
    setPlacingOrder(true);
    try {
      const fullAddress = `${streetAddress.trim()}, ${cityArea.trim()}${inputPincode ? ` - ${inputPincode}` : ''}`;
      const payload = {
        userId: user?.id ?? null,
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: fullAddress,
        items: items.map((i) => ({ productId: i.id, name: i.name, unit: i.unit, price: i.price, qty: i.qty })),
        couponCode: coupon?.code ?? undefined,
        referralCode: referralValidated ?? undefined,
        redeemReward,
        paymentMethod,
        city: cityArea || undefined,
      };

      const res = await api.post('/api/orders', payload);
      if (paymentMethod === 'PHONEPE' && res.data?.payment?.redirectUrl) {
        clearCart();
        const url = res.data.payment.redirectUrl;
        if (url.startsWith('http')) {
          Linking.openURL(url);
        }
        router.replace('/(tabs)/orders');
        return;
      }
      clearCart();
      Alert.alert('🎉 Order Placed!', `Order #${res.data?.id || ''} confirmed successfully.`);
      router.replace('/(tabs)/orders');
    } catch (err: any) {
      Alert.alert('Checkout Failed', err.response?.data?.message || 'Could not place order. Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  const bg = isDark ? '#050505' : '#ffffff';
  const cardBg = isDark ? '#0c121e' : '#ffffff';
  const borderCol = isDark ? 'rgba(16, 185, 129, 0.25)' : '#e2e8f0';
  const textColor = isDark ? '#ffffff' : '#0f172a';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';

  if (items.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: bg, paddingTop: insets.top + 40 }]}>
        <Text style={{ fontSize: 60, marginBottom: 12 }}>🧺</Text>
        <Text style={[styles.emptyTitle, { color: textColor }]}>Your Cart is Empty</Text>
        <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
          Explore our fresh fruits, sweets, vegetables & pickles to fill your basket!
        </Text>
        <TouchableOpacity style={styles.startShoppingBtn} onPress={() => router.push('/(tabs)')}>
          <Text style={styles.startShoppingBtnText}>Start Shopping Now →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
        <Text style={[styles.pageTitle, { color: textColor }]}>Your cart</Text>

        {/* ── Dynamic Free Delivery Progress Banner ────────────────────────── */}
        <View style={[styles.freeDeliveryBanner, isDark ? styles.freeDeliveryBannerDark : styles.freeDeliveryBannerLight]}>
          <View style={styles.freeDeliveryHeader}>
            {isFreeDelivery ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Text style={{ fontSize: 16 }}>🎉</Text>
                <Text style={[styles.freeDeliveryTitle, isDark && styles.textWhite]}>
                  You've unlocked <Text style={{ color: '#10b981', fontWeight: '900' }}>FREE Express Delivery</Text>!
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Text style={{ fontSize: 16 }}>🚚</Text>
                <Text style={[styles.freeDeliveryTitle, isDark && styles.textWhite]}>
                  Add <Text style={{ color: '#10b981', fontWeight: '900' }}>₹{(freeDeliveryThreshold - subtotal).toFixed(0)}</Text> more for <Text style={{ fontWeight: '900' }}>FREE Delivery</Text>!
                </Text>
              </View>
            )}
            <View style={styles.freeDeliveryBadge}>
              <Text style={styles.freeDeliveryBadgeText}>
                {isFreeDelivery ? 'FREE DELIVERED' : `Free Above ₹${freeDeliveryThreshold}`}
              </Text>
            </View>
          </View>

          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(100, Math.round((subtotal / freeDeliveryThreshold) * 100))}%` },
              ]}
            />
          </View>
        </View>

        {/* ── 1. Cart Items List ────────────────────────────────────────────── */}
        <View style={styles.itemsListContainer}>
          {items.map((item) => (
            <View key={item.id} style={[styles.cartItemCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
              {item.image ? (
                <Image source={{ uri: resolveImgUrl(item.image) }} style={styles.itemImage} resizeMode="cover" />
              ) : (
                <View style={[styles.itemImage, styles.itemPlaceholder]}>
                  <Text style={{ fontSize: 24 }}>🌱</Text>
                </View>
              )}

              <View style={styles.itemDetails}>
                <View style={styles.itemHeaderRow}>
                  <Text style={[styles.itemName, { color: textColor }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <TouchableOpacity onPress={() => removeItem(item.id)} style={{ padding: 4 }}>
                    <Text style={{ fontSize: 16, color: '#ef4444' }}>🗑</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.itemUnit, { color: mutedColor }]}>{item.unit}</Text>
                <Text style={styles.itemPrice}>₹{item.price}</Text>

                <View style={styles.stepperRow}>
                  <View style={[styles.stepperControl, isDark ? styles.stepperDark : styles.stepperLight]}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => item.qty === 1 ? removeItem(item.id) : updateQty(item.id, item.qty - 1)}
                    >
                      <Text style={[styles.stepBtnText, item.qty === 1 && { color: '#ef4444' }]}>
                        {item.qty === 1 ? '🗑' : '−'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={[styles.stepQtyText, { color: textColor }]}>{item.qty}</Text>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => updateQty(item.id, item.qty + 1)}>
                      <Text style={[styles.stepBtnText, { color: '#10b981' }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* ── 2. Order Summary Card (Matching Website 1:1) ──────────────────── */}
        <View style={[styles.summaryCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
          <Text style={[styles.summaryTitle, { color: textColor }]}>Order summary</Text>

          {/* Coupon Code Input */}
          <View style={styles.inputActionRow}>
            <TextInput
              style={[styles.couponInput, isDark ? styles.inputDark : styles.inputLight]}
              placeholder="Coupon code (e.g. FRESH10)"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              value={couponInput}
              onChangeText={setCouponInput}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.applyBtn} onPress={applyCoupon} disabled={couponBusy}>
              <Text style={styles.applyBtnText}>{couponBusy ? '...' : '🏷️ Apply'}</Text>
            </TouchableOpacity>
          </View>
          {coupon && (
            <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '700', marginTop: -4, marginBottom: 8 }}>
              ✓ Coupon {coupon.code} applied ({coupon.discountPercent}% OFF)
            </Text>
          )}

          {/* Referral Code Input */}
          <View style={styles.inputActionRow}>
            <TextInput
              style={[styles.couponInput, isDark ? styles.inputDark : styles.inputLight]}
              placeholder="Referral code (optional)"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              value={referralInput}
              onChangeText={setReferralInput}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={[styles.applyBtn, { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#f59e0b', borderWidth: 1 }]} onPress={validateReferral} disabled={referralBusy}>
              <Text style={[styles.applyBtnText, { color: '#fbbf24' }]}>{referralBusy ? '...' : '🎁 Check'}</Text>
            </TouchableOpacity>
          </View>
          {referralValidated && (
            <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700', marginTop: -4, marginBottom: 8 }}>
              ✓ Referral code {referralValidated} validated (10% off first order)
            </Text>
          )}

          {/* Itemized Order & GST Breakdown Box */}
          <View style={[styles.gstBreakdownBox, isDark ? styles.gstBreakdownDark : styles.gstBreakdownLight]}>
            <View style={styles.gstBadgeRow}>
              <Text style={{ fontSize: 13 }}>🧾</Text>
              <Text style={styles.gstBreakdownTitle}>Itemized Order & GST Breakdown</Text>
              <View style={styles.gstGreenPill}>
                <Text style={styles.gstGreenPillText}>Taxable Base + GST</Text>
              </View>
            </View>

            {items.map((it) => {
              const lineTotal = it.price * it.qty;
              const base = Math.round((lineTotal / 1.05) * 100) / 100;
              const gst = Math.round((lineTotal - base) * 100) / 100;
              return (
                <View key={it.id} style={styles.itemizedLineRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemizedLineName, { color: textColor }]}>
                      {it.name} ({it.unit}) × {it.qty}
                    </Text>
                    <Text style={styles.itemizedLineSub}>
                      Base: ₹{base} + <Text style={{ color: '#10b981' }}>5% GST (₹{gst})</Text>
                    </Text>
                  </View>
                  <Text style={[styles.itemizedLinePrice, { color: '#10b981' }]}>₹{lineTotal}</Text>
                </View>
              );
            })}
          </View>

          {/* Financial Breakdown */}
          <View style={styles.financialLines}>
            <View style={styles.calcRow}>
              <Text style={[styles.calcLabel, { color: mutedColor }]}>Taxable Subtotal (Excl. GST)</Text>
              <Text style={[styles.calcValue, { color: textColor }]}>₹{taxableSubtotal}</Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={[styles.calcLabel, { color: mutedColor }]}>CGST Tax Component</Text>
              <Text style={[styles.calcValue, { color: textColor }]}>₹{cgst}</Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={[styles.calcLabel, { color: mutedColor }]}>SGST Tax Component</Text>
              <Text style={[styles.calcValue, { color: textColor }]}>₹{sgst}</Text>
            </View>
            <View style={[styles.calcRow, { marginTop: 4, borderTopWidth: 1, borderTopColor: borderCol, paddingTop: 6 }]}>
              <Text style={[styles.calcLabel, { color: textColor, fontWeight: '700' }]}>Cart Subtotal (Incl. GST)</Text>
              <Text style={[styles.calcValue, { color: textColor, fontWeight: '700' }]}>₹{subtotal}</Text>
            </View>

            {discountAmount > 0 && (
              <View style={styles.calcRow}>
                <Text style={[styles.calcLabel, { color: '#10b981' }]}>Discount Applied</Text>
                <Text style={[styles.calcValue, { color: '#10b981' }]}>−₹{discountAmount}</Text>
              </View>
            )}

            <View style={styles.calcRow}>
              <Text style={[styles.calcLabel, { color: mutedColor }]}>
                Delivery Fee {resolution?.locationArea ? `(${resolution.locationArea})` : ''}
              </Text>
              <Text style={[styles.calcValue, isFreeDelivery ? { color: '#10b981' } : { color: textColor }]}>
                {isFreeDelivery ? `FREE (Above ₹${freeDeliveryThreshold})` : `₹${effectiveDeliveryFee} (Free above ₹${freeDeliveryThreshold})`}
              </Text>
            </View>

            <View style={[styles.calcRow, styles.grandTotalRow, { borderTopColor: borderCol }]}>
              <Text style={[styles.grandTotalLabel, { color: textColor }]}>Grand total</Text>
              <Text style={styles.grandTotalValue}>₹{grandTotal}</Text>
            </View>
          </View>
        </View>

        {/* ── 3. Delivery Details Card (Matching Screenshot 2, 3, 4) ─────────── */}
        <View style={[styles.detailsCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
          <Text style={[styles.detailsTitle, { color: textColor }]}>Delivery details</Text>

          {/* International / Out-of-Station Shipping Switch */}
          <View style={[styles.intlSwitchBox, isDark ? styles.intlSwitchBoxDark : styles.intlSwitchBoxLight]}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>✈️</Text>
                <Text style={[styles.intlSwitchTitle, { color: textColor }]}>International / Out-of-Station Shipping</Text>
              </View>
              <Text style={[styles.intlSwitchSub, { color: mutedColor }]}>
                Turn on to ship to any city, state, or international country (bypasses 100km local warehouse radius limit).
              </Text>
            </View>
            <Switch
              value={isInternationalDelivery}
              onValueChange={handleToggleInternational}
              trackColor={{ false: '#334155', true: '#10b981' }}
              thumbColor="#ffffff"
            />
          </View>

          {/* Warning: Cannot Enable Out-of-Station Shipping (if local-only items conflict) */}
          {localOnlyConflictItems.length > 0 && !isInternationalDelivery && (
            <View style={styles.conflictWarningCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Text style={{ fontSize: 16 }}>⚠️</Text>
                <Text style={styles.conflictWarningTitle}>Cannot Enable Out-of-Station Shipping</Text>
              </View>
              <Text style={styles.conflictWarningText}>
                Your cart contains {localOnlyConflictItems.length} item(s) restricted to Local Warehouse Area Only (fresh produce/raw items not eligible for express courier):
              </Text>
              {localOnlyConflictItems.map((it) => (
                <Text key={it.id} style={styles.conflictItemBullet}>• {it.name} ({it.unit})</Text>
              ))}
              <TouchableOpacity style={styles.removeLocalOnlyBtn} onPress={handleRemoveLocalOnlyItems}>
                <Text style={styles.removeLocalOnlyBtnText}>
                  🗑️ Remove Local-Only Items ({localOnlyConflictItems.length}) & Activate Out-of-Station Delivery
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Warning: Delivery Unavailable for this Location */}
          {!isInternationalDelivery && resolution && resolution.serviceable === false && (
            <View style={styles.unserviceableWarningCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={{ fontSize: 16 }}>🚫</Text>
                <Text style={styles.unserviceableWarningTitle}>Delivery Unavailable for this Location</Text>
              </View>
              <Text style={styles.unserviceableWarningText}>
                We cannot deliver to <Text style={{ fontWeight: '800' }}>{resolution.locationArea || 'this location'}</Text> right now. Please enter a serviceable PIN code or turn on International Shipping above.
              </Text>
            </View>
          )}

          {/* Resolved Hub & ETA Pill */}
          {!isInternationalDelivery && resolution?.serviceable && (
            <View style={[styles.resolvedHubCard, isDark ? styles.resolvedHubDark : styles.resolvedHubLight]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[styles.resolvedHubTitle, { color: textColor }]}>🏬 {resolution.warehouseName}</Text>
                <Text style={styles.resolvedEtaBadge}>⚡ {resolution.etaMinutes} mins</Text>
              </View>
              <Text style={[styles.resolvedHubArea, { color: mutedColor }]}>📍 Customer Area: {resolution.locationArea}</Text>
              <Text style={[styles.resolvedHubBreakdown, { color: mutedColor }]}>
                🕒 ETA Breakdown: {resolution.packingTimeMinutes || 30}m packing + {resolution.travelTimeMinutes || 14}m travel
              </Text>
              <Text style={[styles.resolvedFeeText, { color: '#10b981' }]}>
                🚚 Delivery Fee: {resolution.fee > 0 ? `₹${resolution.fee}` : 'FREE'}
              </Text>
            </View>
          )}

          {/* PIN Code Input Row */}
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={[styles.fieldLabel, { color: mutedColor }]}>PIN Code / Postal Code</Text>
              <TouchableOpacity onPress={() => resolveByGps()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 12 }}>🧭</Text>
                <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '700' }}>
                  {deliveryLoading ? 'Detecting...' : 'Detect My Location'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pincodeRow}>
              <TextInput
                style={[styles.pincodeInput, isDark ? styles.inputDark : styles.inputLight]}
                placeholder="e.g. 522502"
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                value={inputPincode}
                onChangeText={setInputPincode}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity style={styles.updatePinBtn} onPress={() => resolveByPincode(inputPincode)}>
                <Text style={styles.updatePinBtnText}>Update PIN</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Full Name */}
          <View style={{ marginTop: 14 }}>
            <Text style={[styles.fieldLabel, { color: mutedColor }]}>Full name *</Text>
            <TextInput
              style={[styles.fullWidthInput, isDark ? styles.inputDark : styles.inputLight]}
              placeholder="e.g. Store Admin"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              value={customerName}
              onChangeText={setCustomerName}
            />
          </View>

          {/* Phone Number */}
          <View style={{ marginTop: 14 }}>
            <Text style={[styles.fieldLabel, { color: mutedColor }]}>Phone number *</Text>
            <TextInput
              style={[styles.fullWidthInput, isDark ? styles.inputDark : styles.inputLight]}
              placeholder="10-digit mobile number"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>

          {/* City / Area / District */}
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={[styles.fieldLabel, { color: mutedColor }]}>City / Area / District *</Text>
              <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '700' }}>Auto-detected location</Text>
            </View>
            <TextInput
              style={[styles.fullWidthInput, isDark ? styles.inputDark : styles.inputLight]}
              placeholder="e.g. Vaddeswaram, Guntur"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              value={cityArea}
              onChangeText={setCityArea}
            />
          </View>

          {/* Complete Address (Door No, Street Name, Landmark) */}
          <View style={{ marginTop: 14 }}>
            <Text style={[styles.fieldLabel, { color: mutedColor }]}>
              Complete Address (Door No, Street Name, Landmark) *
            </Text>
            <TextInput
              style={[styles.multiLineInput, isDark ? styles.inputDark : styles.inputLight]}
              placeholder="Enter complete street address..."
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              value={streetAddress}
              onChangeText={setStreetAddress}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Payment Method Selector */}
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.fieldLabel, { color: mutedColor, marginBottom: 8 }]}>PAYMENT METHOD</Text>
            <View style={styles.paymentMethodRow}>
              <TouchableOpacity
                style={[
                  styles.paymentOptionBtn,
                  paymentMethod === 'PHONEPE' ? styles.paymentOptionActive : (isDark ? styles.paymentOptionDark : styles.paymentOptionLight)
                ]}
                onPress={() => setPaymentMethod('PHONEPE')}
              >
                <Text style={[styles.paymentOptionText, paymentMethod === 'PHONEPE' && { color: '#ffffff' }]}>
                  ⚡ PhonePe UPI / Card
                </Text>
              </TouchableOpacity>

              {checkoutConfig?.codEnabled !== false && (
                <TouchableOpacity
                  style={[
                    styles.paymentOptionBtn,
                    paymentMethod === 'COD' ? styles.paymentOptionActive : (isDark ? styles.paymentOptionDark : styles.paymentOptionLight)
                  ]}
                  onPress={() => setPaymentMethod('COD')}
                >
                  <Text style={[styles.paymentOptionText, paymentMethod === 'COD' && { color: '#ffffff' }]}>
                    💵 Cash on Delivery
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Checkout Submit Button */}
          <TouchableOpacity
            style={[
              styles.checkoutSubmitBtn,
              (!isInternationalDelivery && resolution && resolution.serviceable === false) && styles.checkoutSubmitBtnDisabled,
              placingOrder && { opacity: 0.7 }
            ]}
            onPress={handleCheckout}
            disabled={placingOrder || (!isInternationalDelivery && resolution?.serviceable === false)}
          >
            {placingOrder ? (
              <ActivityIndicator color="#ffffff" />
            ) : !isInternationalDelivery && resolution && resolution.serviceable === false ? (
              <Text style={styles.checkoutSubmitBtnText}>Delivery Unavailable for this Location</Text>
            ) : (
              <Text style={styles.checkoutSubmitBtnText}>
                {paymentMethod === 'PHONEPE' ? `Pay with PhonePe ₹${grandTotal}` : `Place Order (Cash on Delivery) ₹${grandTotal}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageTitle: { fontSize: 28, fontWeight: '900', fontFamily: 'serif', marginBottom: 16 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '800', fontFamily: 'serif', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  startShoppingBtn: { backgroundColor: '#059669', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 24 },
  startShoppingBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },

  freeDeliveryBanner: { borderRadius: 20, borderWidth: 1, padding: 14, marginBottom: 16 },
  freeDeliveryBannerLight: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  freeDeliveryBannerDark: { backgroundColor: '#022c22', borderColor: 'rgba(52, 211, 153, 0.35)' },
  freeDeliveryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 },
  freeDeliveryTitle: { fontSize: 13, fontWeight: '700', color: '#065f46' },
  freeDeliveryBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  freeDeliveryBadgeText: { color: '#059669', fontSize: 10, fontWeight: '900' },
  progressBarBg: { width: '100%', height: 8, borderRadius: 4, backgroundColor: 'rgba(16, 185, 129, 0.15)', overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },

  itemsListContainer: { marginBottom: 16 },
  cartItemCard: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  itemImage: { width: 80, height: 80, borderRadius: 14 },
  itemPlaceholder: { backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  itemDetails: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
  itemHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 15, fontWeight: '800', flex: 1 },
  itemUnit: { fontSize: 11, marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: '900', color: '#10b981', marginTop: 2 },
  stepperRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  stepperControl: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1, paddingHorizontal: 4, paddingVertical: 2 },
  stepperLight: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  stepperDark: { backgroundColor: '#091510', borderColor: '#1e293b' },
  stepBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  stepBtnText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  stepQtyText: { fontSize: 13, fontWeight: '800', marginHorizontal: 4 },

  summaryCard: { borderRadius: 24, borderWidth: 1, padding: 16, marginBottom: 16 },
  summaryTitle: { fontSize: 20, fontWeight: '900', fontFamily: 'serif', marginBottom: 14 },
  inputActionRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  couponInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  inputLight: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1', color: '#0f172a' },
  inputDark: { backgroundColor: '#091510', borderColor: '#1e293b', color: '#ffffff' },
  applyBtn: { backgroundColor: '#059669', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  applyBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },

  gstBreakdownBox: { borderRadius: 16, borderWidth: 1, padding: 12, marginVertical: 12 },
  gstBreakdownLight: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  gstBreakdownDark: { backgroundColor: '#022c22', borderColor: 'rgba(52, 211, 153, 0.3)' },
  gstBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  gstBreakdownTitle: { fontSize: 12, fontWeight: '800', color: '#059669', flex: 1 },
  gstGreenPill: { backgroundColor: '#10b981', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  gstGreenPillText: { color: '#ffffff', fontSize: 9, fontWeight: '900' },
  itemizedLineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  itemizedLineName: { fontSize: 12, fontWeight: '700' },
  itemizedLineSub: { fontSize: 10, color: '#64748b', marginTop: 1 },
  itemizedLinePrice: { fontSize: 13, fontWeight: '800' },

  financialLines: { marginTop: 6 },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  calcLabel: { fontSize: 12 },
  calcValue: { fontSize: 12, fontWeight: '700' },
  grandTotalRow: { borderTopWidth: 1, paddingTop: 10, marginTop: 6, marginBottom: 0 },
  grandTotalLabel: { fontSize: 16, fontWeight: '900', fontFamily: 'serif' },
  grandTotalValue: { fontSize: 22, fontWeight: '900', color: '#10b981' },

  detailsCard: { borderRadius: 24, borderWidth: 1, padding: 16 },
  detailsTitle: { fontSize: 20, fontWeight: '900', fontFamily: 'serif', marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },

  intlSwitchBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 16, padding: 12, borderWidth: 1, marginBottom: 12 },
  intlSwitchBoxLight: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  intlSwitchBoxDark: { backgroundColor: '#091510', borderColor: 'rgba(52, 211, 153, 0.25)' },
  intlSwitchTitle: { fontSize: 12, fontWeight: '800' },
  intlSwitchSub: { fontSize: 10, lineHeight: 14, marginTop: 2 },

  conflictWarningCard: { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderWidth: 1, borderColor: '#ef4444', borderRadius: 16, padding: 12, marginBottom: 12 },
  conflictWarningTitle: { color: '#ef4444', fontSize: 12, fontWeight: '800' },
  conflictWarningText: { color: '#f87171', fontSize: 11, lineHeight: 15, marginBottom: 6 },
  conflictItemBullet: { color: '#ffffff', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  removeLocalOnlyBtn: { backgroundColor: '#ef4444', borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 8 },
  removeLocalOnlyBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },

  unserviceableWarningCard: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: '#ef4444', borderRadius: 16, padding: 12, marginBottom: 12 },
  unserviceableWarningTitle: { color: '#ef4444', fontSize: 12, fontWeight: '800' },
  unserviceableWarningText: { color: '#f87171', fontSize: 11, lineHeight: 15 },

  resolvedHubCard: { borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 12 },
  resolvedHubLight: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  resolvedHubDark: { backgroundColor: '#022c22', borderColor: 'rgba(52, 211, 153, 0.3)' },
  resolvedHubTitle: { fontSize: 13, fontWeight: '800' },
  resolvedEtaBadge: { color: '#10b981', fontWeight: '900', fontSize: 12 },
  resolvedHubArea: { fontSize: 11, marginTop: 2 },
  resolvedHubBreakdown: { fontSize: 10, marginTop: 2 },
  resolvedFeeText: { fontSize: 11, fontWeight: '800', marginTop: 4 },

  pincodeRow: { flexDirection: 'row', gap: 8 },
  pincodeInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: '700' },
  updatePinBtn: { backgroundColor: '#059669', borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  updatePinBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },

  fullWidthInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  multiLineInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, minHeight: 70, textAlignVertical: 'top' },

  paymentMethodRow: { flexDirection: 'row', gap: 10 },
  paymentOptionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  paymentOptionActive: { backgroundColor: '#059669', borderColor: '#059669' },
  paymentOptionLight: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
  paymentOptionDark: { backgroundColor: '#091510', borderColor: '#1e293b' },
  paymentOptionText: { fontSize: 12, fontWeight: '800', color: '#64748b' },

  checkoutSubmitBtn: { backgroundColor: '#059669', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  checkoutSubmitBtnDisabled: { backgroundColor: '#475569', opacity: 0.6 },
  checkoutSubmitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  textWhite: { color: '#ffffff' },
});
