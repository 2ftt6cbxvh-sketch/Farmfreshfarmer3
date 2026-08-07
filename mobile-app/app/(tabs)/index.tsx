import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Animated, TouchableOpacity, TextInput,
  StyleSheet, Image, RefreshControl, Modal, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, resolveImgUrl } from '../../lib/api';
import { useThemeStore } from '../../lib/theme';
import { COLORS, BRAND } from '../../constants/config';
import type { Product, Category } from '../../lib/types';
import { useDelivery } from '../../hooks/useDelivery';

const { width } = Dimensions.get('window');

function ProductCard({ product }: { product: Product }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const price = parseFloat(product.price);
  const discount = parseFloat(product.discountPercent);
  const effectivePrice = discount > 0 ? price * (1 - discount / 100) : price;

  // Touch press depth animation
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[styles.productCardWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.productCard, isDark && styles.productCardDark]}
        onPress={() => router.push(`/product/${product.id}`)}
      >
        {product.image ? (
          <Image source={{ uri: resolveImgUrl(product.image) }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={[styles.productImage, styles.productImagePlaceholder]}>
            <Text style={{ fontSize: 32 }}>🌱</Text>
          </View>
        )}
        {discount > 0 && (
          <View style={styles.discountBadge}><Text style={styles.discountText}>{Math.round(discount)}% OFF</Text></View>
        )}
        <View style={styles.productInfo}>
          <Text style={[styles.productName, isDark && styles.textWhite]} numberOfLines={2}>{product.name}</Text>
          <Text style={styles.productUnit}>{product.unit}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{effectivePrice.toFixed(0)}</Text>
            {discount > 0 && <Text style={styles.originalPrice}>₹{price.toFixed(0)}</Text>}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [pincodeModal, setPincodeModal] = useState(false);
  const [inputPincode, setInputPincode] = useState('');

  const { resolution, isLoading: deliveryLoading, resolveByPincode, resolveByGps } = useDelivery();

  // Scroll-Driven Parallax Animation
  const scrollY = useRef(new Animated.Value(0)).current;

  // Continuous Ambient Levitation Animation (Floating without touch/cursor)
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -6, duration: 1800, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const headerParallaxY = scrollY.interpolate({
    inputRange: [-100, 0, 200],
    outputRange: [-30, 0, 70],
    extrapolate: 'clamp',
  });

  const bannerScale = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [1, 0.95],
    extrapolate: 'clamp',
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/categories').then((r) => r.data),
  });

  const { data: productsData, isLoading, refetch } = useQuery({
    queryKey: ['products', selectedCategory, searchQuery],
    queryFn: () =>
      api.get('/api/products', {
        params: { ...(selectedCategory && { category: selectedCategory }), ...(searchQuery && { q: searchQuery }) },
      }).then((r) => r.data),
    staleTime: 60000,
  });

  const categories: Category[] = categoriesData?.categories || categoriesData || [];
  const products: Product[] = productsData?.products || productsData || [];

  const handlePincodeSubmit = () => {
    if (inputPincode.length >= 4) {
      resolveByPincode(inputPincode);
      setPincodeModal(false);
    }
  };

  return (
    <Animated.ScrollView
      style={[styles.container, isDark && styles.containerDark]}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      scrollEventThrottle={16}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      {/* Scroll-Parallax Header */}
      <Animated.View style={[styles.headerBg, isDark && styles.headerBgDark, { transform: [{ translateY: headerParallaxY }] }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.headerTitle, isDark && styles.textWhite]}>🌿 {BRAND.name}</Text>
          <TouchableOpacity onPress={toggleTheme}>
            <Text style={{ fontSize: 24 }}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerSub, isDark && styles.textMutedDark]}>Farm fresh delivered to your door</Text>

        {/* 3D Glass Bento Feature Strip */}
        <View style={[styles.bentoStrip, isDark && styles.bentoStripDark]}>
          <Text style={[styles.bentoText, isDark && styles.textWhite]}>100% Naturally Grown • Instant Delivery ETA • Zero Preservatives</Text>
        </View>
      </Animated.View>

      {/* Floating 3D Delivery ETA Banner */}
      <Animated.View style={{ transform: [{ scale: bannerScale }, { translateY: floatAnim }] }}>
        <TouchableOpacity style={styles.deliveryBanner} onPress={() => setPincodeModal(true)}>
          <View style={styles.deliveryBannerRow}>
            <Text style={styles.deliveryLocationText}>
              📍 {resolution?.locationArea || 'Set Delivery Location'}
            </Text>
            <Text style={styles.changeBtnText}>Change ✏️</Text>
          </View>

          {resolution?.serviceable ? (
            <View style={styles.etaDetailsRow}>
              <Text style={styles.warehouseText}>🏬 {resolution.warehouseName}</Text>
              <Text style={styles.packingText}>📦 Pack: {resolution.packingTimeMinutes || 30}m</Text>
              {!!resolution.travelTimeMinutes && (
                <Text style={styles.transitText}>🚚 Transit: {resolution.travelTimeMinutes}m</Text>
              )}
              <View style={styles.etaBadge}>
                <Text style={styles.etaBadgeText}>⏱️ {resolution.etaMinutes} mins ETA</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.pincodePrompt}>Tap to check warehouse delivery ETA for your PIN code</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={[styles.searchInput, isDark && styles.searchInputDark]}
          placeholder="Search fruits & vegetables..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* 3D Glassmorphic Category Chips */}
      {categories.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDark && styles.textWhite]}>Categories</Text>
          <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            <TouchableOpacity
              style={[styles.categoryChip, isDark && styles.categoryChipDark, !selectedCategory && styles.categoryChipActive, !selectedCategory && isDark && styles.categoryChipActiveDark]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.categoryChipText, isDark && styles.textWhite, !selectedCategory && styles.categoryChipTextActive]}>All</Text>
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, isDark && styles.categoryChipDark, selectedCategory === cat.slug && styles.categoryChipActive, selectedCategory === cat.slug && isDark && styles.categoryChipActiveDark]}
                onPress={() => setSelectedCategory(selectedCategory === cat.slug ? null : cat.slug)}
              >
                <Text style={[styles.categoryChipText, isDark && styles.textWhite, selectedCategory === cat.slug && styles.categoryChipTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.ScrollView>
        </View>
      )}

      {/* 3D Products Grid */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDark && styles.textWhite]}>
          {selectedCategory ? `${categories.find((c) => c.slug === selectedCategory)?.name || 'Products'}` : 'Fresh Harvest'}
        </Text>
        <View style={styles.grid}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </View>
      </View>

      {/* PIN Code Modal */}
      <Modal visible={pincodeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            <Text style={[styles.modalTitle, isDark && styles.textWhite]}>Set Delivery Location</Text>
            <Text style={[styles.modalSub, isDark && styles.textMutedDark]}>Enter your 6-digit PIN code to view nearby warehouse & delivery ETA</Text>
            <TextInput
              style={[styles.modalInput, isDark && styles.modalInputDark]}
              placeholderTextColor={isDark ? '#555' : '#999'}
              placeholder="e.g. 522001"
              value={inputPincode}
              onChangeText={setInputPincode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.gpsBtn, isDark && styles.gpsBtnDark]} onPress={() => { resolveByGps(); setPincodeModal(false); }}>
                <Text style={[styles.gpsBtnText, isDark && styles.textWhite]}>Use GPS 🛰️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handlePincodeSubmit}>
                <Text style={styles.submitBtnText}>Submit</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setPincodeModal(false)}>
              <Text style={[styles.closeBtnText, isDark && styles.textWhite]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  containerDark: { backgroundColor: '#000000' },
  headerBg: { backgroundColor: COLORS.primaryDark, padding: 20, paddingTop: 50 },
  headerBgDark: { backgroundColor: '#000000', borderBottomWidth: 1, borderBottomColor: '#22c55e', shadowColor: '#22c55e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  headerTitle: { color: '#ffffff', fontSize: 24, fontWeight: 'bold' },
  headerSub: { color: COLORS.primaryLight, fontSize: 13, marginTop: 4 },
  deliveryBanner: {
    backgroundColor: '#092615', borderBottomWidth: 2, borderBottomColor: '#15803d',
    padding: 14, marginHorizontal: 12, marginTop: 10, borderRadius: 20,
    shadowColor: '#15803d', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  deliveryBannerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deliveryLocationText: { color: '#f59e0b', fontWeight: 'bold', fontSize: 14 },
  changeBtnText: { color: '#86efac', fontSize: 12, fontWeight: 'bold' },
  etaDetailsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 },
  warehouseText: { color: '#86efac', fontSize: 12, fontWeight: 'bold' },
  packingText: { color: '#fde047', fontSize: 12, fontWeight: 'semibold' },
  transitText: { color: '#86efac', fontSize: 12, fontWeight: 'semibold' },
  etaBadge: { backgroundColor: '#15803d', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  etaBadgeText: { color: '#ffffff', fontWeight: 'bold', fontSize: 11 },
  pincodePrompt: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  searchContainer: { paddingHorizontal: 16, marginTop: 14 },
  searchInput: {
    backgroundColor: '#f1f5f9', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: COLORS.text, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  searchInputDark: { backgroundColor: '#111', color: '#fff', borderWidth: 1, borderColor: '#22c55e' },
  section: { paddingHorizontal: 16, marginTop: 22 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 12 },
  categoryScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  categoryChip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, backgroundColor: '#f1f5f9',
    marginRight: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3,
  },
  categoryChipDark: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333' },
  categoryChipActive: { backgroundColor: COLORS.primary },
  categoryChipActiveDark: { backgroundColor: '#000', borderColor: '#22c55e', shadowColor: '#22c55e', shadowOpacity: 0.8, shadowRadius: 8, elevation: 8 },
  categoryChipText: { color: COLORS.text, fontWeight: '600', fontSize: 13 },
  categoryChipTextActive: { color: '#ffffff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  productCardWrapper: {
    width: '47%', marginHorizontal: '1.5%', marginBottom: 16,
  },
  productCard: {
    backgroundColor: '#ffffff', borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#15803d', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 5,
  },
  productCardDark: {
    backgroundColor: '#000', borderColor: '#22c55e', shadowColor: '#22c55e', shadowOpacity: 0.4, shadowRadius: 8, elevation: 8
  },
  productImage: { width: '100%', height: 135 },
  productImagePlaceholder: { backgroundColor: '#f8fafc', alignItems: 'center', justifyCenter: 'center' },
  discountBadge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: COLORS.accent,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
  },
  discountText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  productInfo: { padding: 12 },
  productName: { fontSize: 14, fontWeight: 'bold', color: COLORS.text },
  productUnit: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  price: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  originalPrice: { fontSize: 12, color: COLORS.textMuted, textDecorationLine: 'line-through' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '85%', backgroundColor: '#ffffff', borderRadius: 24, padding: 22, alignItems: 'center' },
  modalCardDark: { backgroundColor: '#000', borderWidth: 1, borderColor: '#22c55e' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  modalSub: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: 4 },
  modalInput: {
    width: '100%', borderWidth: 1, borderColor: COLORS.border, borderRadius: 14,
    padding: 12, fontSize: 16, textAlign: 'center', marginVertical: 16, fontWeight: 'bold',
  },
  modalInputDark: { backgroundColor: '#111', color: '#fff', borderColor: '#22c55e' },
  modalBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  gpsBtn: { flex: 1, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12, alignItems: 'center' },
  gpsBtnDark: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333' },
  gpsBtnText: { color: COLORS.text, fontWeight: 'bold', fontSize: 13 },
  submitBtn: { flex: 1, backgroundColor: COLORS.primary, padding: 12, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  closeBtn: { marginTop: 14 },
  closeBtnText: { color: COLORS.textMuted, fontSize: 13 },
  textWhite: { color: '#ffffff' },
  textMutedDark: { color: '#aaa' },
  bentoStrip: { marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' },
  bentoStripDark: { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.4)' },
  bentoText: { fontSize: 11, color: '#fff', fontWeight: '600' },
});
