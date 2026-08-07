import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Animated, TouchableOpacity, TextInput,
  StyleSheet, Image, RefreshControl, Modal, Dimensions, LayoutAnimation, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, resolveImgUrl } from '../../lib/api';
import { useThemeStore } from '../../lib/theme';
import { COLORS, BRAND } from '../../constants/config';
import type { Product, Category } from '../../lib/types';
import { useCartStore } from '../../lib/cart';
import { useDelivery } from '../../hooks/useDelivery';
import { useAuth } from '../../lib/store';
const { width } = Dimensions.get('window');

function ProductCard({ product }: { product: Product }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const { user } = useAuth();
  const addItem = useCartStore((state) => state.addItem);
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
            <View>
              <Text style={styles.price}>₹{effectivePrice.toFixed(0)}</Text>
              {discount > 0 && <Text style={styles.originalPrice}>₹{price.toFixed(0)}</Text>}
            </View>
            <TouchableOpacity 
              style={styles.addBtn}
              onPress={() => {
                if (!user) {
                  Alert.alert('Sign In Required 🔐', 'Please log in to your account to add fresh items to your basket.', [{ text: 'Cancel' }, { text: 'Sign In', onPress: () => router.push('/(auth)/login') }]);
                  return;
                }
                addItem(product);
                Alert.alert('Success', 'Added to Basket! 🎉');
              }}
            >
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();

  const handleToggleTheme = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    toggleTheme();
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [pincodeModal, setPincodeModal] = useState(false);
  const [inputPincode, setInputPincode] = useState('');

  const { resolution, isLoading: deliveryLoading, resolveByPincode, resolveByGps, clearResolution } = useDelivery();

  // Auto-open pincode modal when GPS fails with non-India coordinates
  useEffect(() => {
    if (resolution && !resolution.serviceable && resolution.locationArea === 'GPS location unavailable') {
      setPincodeModal(true);
    }
  }, [resolution]);

  // Sync server cart on mount
  useEffect(() => {
    useCartStore.getState().syncWithServer();
  }, []);

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
    const trimmed = inputPincode.trim();
    if (!/^[1-9][0-9]{5}$/.test(trimmed)) {
      Alert.alert('Invalid PIN Code', 'Please enter a valid 6-digit Indian PIN code (e.g. 522001)');
      return;
    }
    resolveByPincode(trimmed);
    setPincodeModal(false);
  };

  return (
    <Animated.ScrollView
      style={[styles.container, isDark && styles.containerDark]}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      scrollEventThrottle={16}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      {/* Scroll-Parallax Header */}
      <Animated.View style={[styles.headerBg, isDark && styles.headerBgDark, { transform: [{ translateY: headerParallaxY }], paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.headerTitle, { fontSize: 22 }, isDark && styles.textWhite]}>🌿 {BRAND.name}</Text>
            <View style={[styles.versionTag, { alignItems: 'center', justifyContent: 'center' }]}><Text style={styles.versionTagText}>v2.0.6</Text></View>
          </View>
          <TouchableOpacity style={[styles.themeToggleBtn, { alignItems: 'center', justifyContent: 'center' }]} onPress={handleToggleTheme}>
            <Text style={{ fontSize: 20 }}>{isDark ? '☀️' : '🌙'}</Text>
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
            <Text style={styles.deliveryLocationText} numberOfLines={1}>
              📍 {resolution?.serviceable ? `Delivering to: ${resolution?.locationArea} (PIN: ${resolution?.pincode})` : 'Select Delivery Location'}
            </Text>
            <TouchableOpacity onPress={() => { clearResolution(); setPincodeModal(true); }}>
              <Text style={styles.changeBtnText}>Change ✏️</Text>
            </TouchableOpacity>
          </View>

          {resolution?.serviceable ? (
            <View style={styles.etaDetailsRow}>
              <View style={styles.etaBadge}>
                <Text style={styles.etaBadgeText}>⚡ {resolution?.etaMinutes} Min{resolution?.etaMinutes !== 1 ? 's' : ''} Express Delivery • {resolution?.warehouseName}</Text>
              </View>
            </View>
          ) : resolution ? (
            <Text style={[styles.pincodePrompt, { color: resolution?.locationArea === 'GPS location unavailable' ? '#f59e0b' : '#ef4444' }]}>
              {resolution?.locationArea === 'GPS location unavailable' 
                ? '📍 ' + resolution?.reason
                : 'Not Covered Yet: ' + resolution?.reason
              }
            </Text>
          ) : (
            <Text style={styles.pincodePrompt}>Enter PIN code or detect GPS to check instant delivery ETA</Text>
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
                <Text style={[styles.gpsBtnText, isDark && styles.textWhite]}>{deliveryLoading ? 'Detecting...' : 'Use GPS 🛰️'}</Text>
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
  containerDark: { backgroundColor: '#050505' },
  headerBg: { backgroundColor: '#064e3b', padding: 20, paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#064e3b', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  headerBgDark: { backgroundColor: '#022c22', borderBottomWidth: 1, borderBottomColor: 'rgba(52, 211, 153, 0.3)', shadowColor: '#10b981', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 15 },
  headerTitle: { color: '#ffffff', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  versionTag: { backgroundColor: 'rgba(52, 211, 153, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(52, 211, 153, 0.5)' },
  versionTagText: { color: '#34d399', fontSize: 10, fontWeight: '700' },
  themeToggleBtn: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 6, fontWeight: '500', lineHeight: 22 },
  deliveryBanner: {
    backgroundColor: '#0f172a', borderWidth: 1, borderColor: 'rgba(52, 211, 153, 0.6)',
    padding: 16, marginHorizontal: 16, marginTop: -20, borderRadius: 24,
    shadowColor: '#10b981', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 15, elevation: 10,
  },
  deliveryBannerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deliveryLocationText: { flex: 1, marginRight: 8, color: '#38bdf8', fontWeight: '700', fontSize: 12.5, textShadowColor: 'rgba(56, 189, 248, 0.3)', textShadowOffset: {width: 0, height: 0}, textShadowRadius: 10 },
  changeBtnText: { color: '#10b981', fontSize: 12, fontWeight: '600', backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  etaDetailsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 },
  warehouseText: { color: '#10b981', fontSize: 12, fontWeight: '600' },
  packingText: { color: '#10b981', fontSize: 12, fontWeight: '600' },
  transitText: { color: '#10b981', fontSize: 12, fontWeight: '600' },
  etaBadge: { paddingHorizontal: 0, paddingVertical: 0, borderRadius: 0, borderWidth: 0, borderColor: 'transparent', backgroundColor: 'transparent' },
  etaBadgeText: { color: '#34d399', fontWeight: '700', fontSize: 11 },
  pincodePrompt: { color: '#34d399', fontSize: 13, marginTop: 6, lineHeight: 20 },
  searchContainer: { paddingHorizontal: 16, marginTop: 24 },
  searchInput: {
    backgroundColor: '#ffffff', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16,
    fontSize: 15, color: COLORS.text, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  searchInputDark: { backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOpacity: 0.5 },
  section: { paddingHorizontal: 16, marginTop: 28 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 16, letterSpacing: -0.5 },
  categoryScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  categoryChip: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, backgroundColor: '#ffffff',
    marginRight: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  categoryChipDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  categoryChipActive: { backgroundColor: '#10b981', borderColor: '#059669' },
  categoryChipActiveDark: { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981', shadowColor: '#10b981', shadowOpacity: 0.6, shadowRadius: 12, elevation: 8 },
  categoryChipText: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  categoryChipTextActive: { color: '#ffffff', fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  productCardWrapper: {
    width: '47%', marginHorizontal: '1.5%', marginBottom: 20,
  },
  productCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  productCardDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.15)', shadowColor: '#10b981', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10
  },
  productImage: { width: '100%', height: 140 },
  productImagePlaceholder: { backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  discountBadge: {
    position: 'absolute', top: 10, left: 10, backgroundColor: '#ef4444',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    borderWidth: 1, borderColor: '#f87171', shadowColor: '#ef4444', shadowOpacity: 0.4, shadowRadius: 6,
  },
  discountText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  productInfo: { padding: 14 },
  productName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  productUnit: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, fontWeight: '500', lineHeight: 20 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  price: { fontSize: 18, fontWeight: '700', color: '#10b981' },
  originalPrice: { fontSize: 13, color: COLORS.textMuted, textDecorationLine: 'line-through', fontWeight: '500' },
  addBtn: { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  addBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '88%', backgroundColor: '#ffffff', borderRadius: 32, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20 },
  modalCardDark: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.3)' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  modalSub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  modalInput: {
    width: '100%', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', borderRadius: 16, backgroundColor: '#f8fafc',
    padding: 16, fontSize: 20, textAlign: 'center', marginVertical: 20, fontWeight: '600', letterSpacing: 2,
  },
  modalInputDark: { backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', borderColor: 'rgba(255,255,255,0.1)' },
  modalBtnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  gpsBtn: { flex: 1, backgroundColor: '#f1f5f9', padding: 16, borderRadius: 16, alignItems: 'center' },
  gpsBtnDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  gpsBtnText: { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  submitBtn: { flex: 1, backgroundColor: '#10b981', padding: 16, borderRadius: 16, alignItems: 'center', shadowColor: '#10b981', shadowOpacity: 0.4, shadowRadius: 10 },
  submitBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  closeBtn: { marginTop: 20 },
  closeBtnText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  textWhite: { color: '#ffffff' },
  textMutedDark: { color: '#94a3b8' },
  bentoStrip: { marginTop: 16, padding: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center' },
  bentoStripDark: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.4)' },
  bentoText: { fontSize: 12, color: '#fff', fontWeight: '700', letterSpacing: 0.5 },
});
