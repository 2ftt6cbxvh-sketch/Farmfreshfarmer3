import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, Animated, TouchableOpacity, TextInput,
  StyleSheet, Image, RefreshControl, Modal, Dimensions, LayoutAnimation, Alert, ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, resolveImgUrl } from '../../lib/api';
import { useThemeStore } from '../../lib/theme';
import { COLORS } from '../../constants/config';
import type { Product, Category } from '../../lib/types';
import { useCartStore } from '../../lib/cart';
import { useDelivery } from '../../hooks/useDelivery';
import { useAuth } from '../../lib/store';
import { AnimatedFreeDeliveryBar } from '../../components/FreeDeliveryBar';
import { AnimatedSideMenu } from '../../components/AnimatedSideMenu';

const { width } = Dimensions.get('window');

const CAT_IMAGES: Record<string, string> = {
  fruits: '/images/cat-fruits.jpg',
  vegetables: '/images/cat-vegetables.jpg',
  'homemade-sweets': '/images/cat-sweets.jpg',
  namkeen: '/images/cat-namkeen.jpg',
  'pickles-veg': '/images/cat-pickle-veg.jpg',
  'pickles-non-veg': '/images/cat-pickle-nonveg.jpg',
  millets: '/images/cat-millets.jpg',
  pulses: '/images/cat-pulses.jpg',
  spices: '/images/cat-spices.jpg',
};

const SEARCH_RECOMMENDATIONS = [
  { label: '🥭 Mango', query: 'mango' },
  { label: '🍅 Tomatoes', query: 'tomato' },
  { label: '🍌 Bananas', query: 'banana' },
  { label: '🌶️ Pickles', query: 'pickle' },
  { label: '🍯 Sweets', query: 'sweet' },
  { label: '🌾 Millets', query: 'millet' },
  { label: '🍇 Grapes', query: 'grape' },
  { label: '🧄 Spices', query: 'spice' },
];

// ─── Product Card with Dynamic Warehouse Radius & Stepper ────────────────────
function ProductCard({ product, maxRadiusKm }: { product: Product; maxRadiusKm?: number }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const { user } = useAuth();
  const items = useCartStore((state) => state.items) || [];
  const addItem = useCartStore((state) => state.addItem);
  const updateQty = useCartStore((state) => state.updateQty);
  const removeItem = useCartStore((state) => state.removeItem);

  const [localQty, setLocalQty] = useState(1);
  const [imgFailed, setImgFailed] = useState(false);
  const price = parseFloat(product.price);
  const discount = parseFloat(product.discountPercent || '0');
  const effectivePrice = discount > 0 ? price * (1 - discount / 100) : price;

  const cartItem = items.find((i) => i.id === product.id || (i as any).productId === product.id);
  const inCartQty = cartItem?.qty || 0;
  const isInCart = inCartQty > 0;
  const isLocalOnly = (product as any).allowInternationalShipping === false;
  const isVeg = product.dietTag !== 'nonveg';
  const outOfStock = Number(product.stock !== undefined ? product.stock : 999) <= 0;

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  };

  const handleAddToCart = () => {
    if (!user) {
      Alert.alert('Sign In Required 🔐', 'Please log in to your account to add fresh items to your basket.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    if (outOfStock) {
      Alert.alert('Out of Stock ⚠️', 'This item is currently out of stock.');
      return;
    }
    const stock = Number(product.stock !== undefined ? product.stock : 999);
    if (inCartQty + localQty > stock) {
      Alert.alert('Stock Limit Reached ⚠️', `Only ${stock} unit(s) available in stock.`);
      return;
    }
    addItem(product, localQty);
    Alert.alert('Added to Basket! 🎉', `${localQty} × ${product.name} added to your basket.`);
    setLocalQty(1);
  };

  return (
    <Animated.View style={[styles.productCardWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.productCard, isDark ? styles.productCardDark : styles.productCardLight]}
        onPress={() => router.push(`/product/${product.id}`)}
      >
        <View style={styles.cardTopAccent} />

        <View style={[styles.imageWrapper, isDark && { backgroundColor: '#091510' }]}>
          {product.image && !imgFailed ? (
            <Image
              source={{ uri: resolveImgUrl(product.image) }}
              style={styles.productImage}
              resizeMode="cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <View style={[styles.productImage, styles.productImagePlaceholder, isDark && { backgroundColor: '#091510' }]}>
              <Text style={{ fontSize: 32 }}>🌱</Text>
              <Text style={{ fontSize: 9, fontWeight: '800', color: '#10b981', marginTop: 2 }}>Farm Fresh</Text>
            </View>
          )}

          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{Math.round(discount)}% OFF</Text>
            </View>
          )}

          {isLocalOnly && (
            <View style={styles.localOnlyBadge}>
              <Text style={styles.localOnlyText}>
                📍 Local Only {maxRadiusKm ? `(${maxRadiusKm}km)` : ''}
              </Text>
            </View>
          )}

          {isInCart && (
            <View style={styles.inCartBadge}>
              <Text style={styles.inCartText}>✓ {inCartQty} in Cart</Text>
            </View>
          )}
        </View>

        <View style={styles.productInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <Text style={{ fontSize: 11 }}>{isVeg ? '🟢' : '🔴'}</Text>
            <Text style={[styles.categoryTag, isDark ? { color: '#34d399' } : { color: '#059669' }]}>
              {product.categorySlug?.toUpperCase() || 'FRESH'}
            </Text>
          </View>

          <Text style={[styles.productName, isDark ? styles.textWhite : styles.textDark]} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={[styles.productUnit, isDark ? styles.textMutedDark : styles.textMutedLight]}>{product.unit}</Text>

          <View style={styles.priceRow}>
            <View>
              <Text style={styles.price}>₹{effectivePrice.toFixed(0)}</Text>
              {discount > 0 && <Text style={styles.originalPrice}>₹{price.toFixed(0)}</Text>}
            </View>
          </View>

          <View style={styles.stepperAndBtnRow}>
            {isInCart ? (
              <View style={[styles.cartQtyControl, isDark ? styles.cartQtyControlDark : styles.cartQtyControlLight]}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => (inCartQty === 1 ? removeItem(product.id) : updateQty(product.id, inCartQty - 1))}
                >
                  <Text style={[styles.stepBtnText, inCartQty === 1 && { color: COLORS.error }]}>
                    {inCartQty === 1 ? '🗑' : '−'}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.stepQtyText, isDark ? styles.textWhite : styles.textDark]}>{inCartQty}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => updateQty(product.id, inCartQty + 1)}>
                  <Text style={[styles.stepBtnText, { color: '#10b981' }]}>+</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.cartQtyControl, isDark ? styles.cartQtyControlDark : styles.cartQtyControlLight]}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setLocalQty(Math.max(1, localQty - 1))}>
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.stepQtyText, isDark ? styles.textWhite : styles.textDark]}>{localQty}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setLocalQty(localQty + 1)}>
                  <Text style={[styles.stepBtnText, { color: '#10b981' }]}>+</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.addBtn, isInCart && styles.addBtnInCart]}
              onPress={isInCart ? () => router.push('/(tabs)/basket') : handleAddToCart}
            >
              <Text style={styles.addBtnText}>{isInCart ? '🛒 Cart' : '🛒 Add'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Home Screen ───────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const cartItems = useCartStore((state) => state.items) || [];
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);
  const cartSubtotal = cartItems.reduce((s, i) => s + i.qty * i.price, 0);

  const { data: deliveryRules } = useQuery({
    queryKey: ['delivery-rules'],
    queryFn: () => api.get('/api/delivery-rules').then((r) => r.data),
    staleTime: 60000,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [pincodeModal, setPincodeModal] = useState(false);
  const [categoriesDrawerOpen, setCategoriesDrawerOpen] = useState(false);
  const [inputPincode, setInputPincode] = useState('');

  const scrollViewRef = useRef<ScrollView>(null);
  const categoriesLayoutY = useRef<number>(380);
  const productsLayoutY = useRef<number>(750);

  const { resolution, isLoading: deliveryLoading, resolveByPincode, resolveByGps } = useDelivery();

  useEffect(() => {
    useCartStore.getState().syncWithServer();
  }, []);

  const handleToggleTheme = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    toggleTheme();
  };

  // Queries
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/categories').then((r) => r.data),
  });

  const { data: productsData, isLoading, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/api/products').then((r) => r.data),
    staleTime: 60000,
  });

  const { data: siteTextData } = useQuery({
    queryKey: ['site-text'],
    queryFn: () => api.get('/api/content/site-text').then((r) => r.data).catch(() => ({ textMap: {} })),
    staleTime: 60000,
  });
  const txt: Record<string, string> = siteTextData?.textMap || {};

  const { data: heroConfig } = useQuery({
    queryKey: ['hero-showcase'],
    queryFn: () => api.get('/api/hero-showcase').then((r) => r.data).catch(() => ({})),
    staleTime: 60000,
  });

  const categories: Category[] = categoriesData?.categories || categoriesData || [];
  const allProducts: Product[] = productsData?.products || productsData || [];

  // GLOBAL SEARCH & CATEGORY FILTERING
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      return allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.categorySlug?.toLowerCase().includes(q) ||
          (p.dietTag && p.dietTag.toLowerCase().includes(q))
      );
    }
    if (selectedCategory) {
      return allProducts.filter(
        (p) => p.categorySlug === selectedCategory || (p as any).categoryId === selectedCategory
      );
    }
    return allProducts;
  }, [allProducts, selectedCategory, searchQuery]);

  const handlePincodeSubmit = () => {
    const trimmed = inputPincode.trim();
    if (!/^[1-9][0-9]{5}$/.test(trimmed)) {
      Alert.alert('Invalid PIN Code', 'Please enter a valid 6-digit Indian PIN code (e.g. 522001)');
      return;
    }
    resolveByPincode(trimmed);
    setPincodeModal(false);
  };

  const handleCategoryPress = (slug: string) => {
    setSearchQuery('');
    if (selectedCategory === slug) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(slug);
    }
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: productsLayoutY.current, animated: true });
    }, 100);
  };

  const handleExploreCategoriesPress = () => {
    scrollViewRef.current?.scrollTo({ y: categoriesLayoutY.current, animated: true });
  };

  const handleRecommendationPress = (query: string) => {
    setSelectedCategory(null);
    setSearchQuery(query);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: productsLayoutY.current, animated: true });
    }, 100);
  };

  const currentCategoryObj = categories.find((c) => c.slug === selectedCategory);
  const bg = isDark ? '#050505' : '#ffffff';
  const maxRadius = resolution?.maxRadiusKm;
  const freeDeliveryThreshold = Number(resolution?.freeDeliveryAbove || deliveryRules?.freeAbove || 500);
  const isFreeDelivery = cartSubtotal >= freeDeliveryThreshold;

  return (
    <View style={[styles.mainContainer, { backgroundColor: bg }]}>
      {/* ── 1. Top Delivery ETA Header Bar (Mirrored exactly from website) ─── */}
      <View
        style={[
          styles.topDeliveryBar,
          resolution?.serviceable === false
            ? isDark
              ? styles.deliveryBarUnserviceableDark
              : styles.deliveryBarUnserviceableLight
            : isDark
            ? styles.topDeliveryBarDark
            : styles.topDeliveryBarLight,
          { paddingTop: insets.top + 6 },
        ]}
      >
        {resolution ? (
          resolution.serviceable ? (
            <>
              <View style={styles.topDeliveryInfoRow}>
                <Text style={[styles.topDeliveryLocationText, isDark ? styles.deliveryTextYellow : styles.deliveryTextGreen]} numberOfLines={1}>
                  📍 Delivering to: <Text style={{ fontWeight: '800' }}>{resolution.locationArea}</Text>
                </Text>
              </View>
              <View style={styles.topDeliveryEtaRow}>
                <Text style={[styles.topDeliveryEtaText, isDark ? styles.deliveryEtaDark : styles.deliveryEtaLight]}>
                  ⚡ {resolution.etaMinutes} Mins Express Delivery • {resolution.warehouseName}
                </Text>
              </View>
              <View style={styles.topDeliveryActionRow}>
                <TouchableOpacity
                  style={[styles.topDeliveryPill, isDark ? styles.deliveryPillDark : styles.deliveryPillLight]}
                  onPress={() => resolveByGps()}
                >
                  <Text style={[styles.topDeliveryPillText, isDark ? styles.deliveryPillTextDark : styles.deliveryPillTextLight]}>
                    {deliveryLoading ? 'Detecting...' : '🧭 Detect My Location'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.topDeliveryPill, isDark ? styles.deliveryPillSecondaryDark : styles.deliveryPillSecondaryLight]}
                  onPress={() => setPincodeModal(true)}
                >
                  <Text style={[styles.topDeliveryPillText, isDark ? styles.deliveryPillSecTextDark : styles.deliveryPillSecTextLight]}>
                    Change Pincode
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.topDeliveryInfoRow}>
                <Text style={[styles.topDeliveryLocationText, { color: '#ef4444' }]} numberOfLines={1}>
                  📍 Delivery not available for <Text style={{ fontWeight: '800' }}>{resolution.locationArea || 'this location'}</Text>
                </Text>
              </View>
              <View style={styles.topDeliveryEtaRow}>
                <Text style={[styles.topDeliveryEtaText, { color: '#f87171' }]}>
                  {resolution.reason || 'Outside local warehouse deliverable radius'}
                </Text>
              </View>
              <View style={styles.topDeliveryActionRow}>
                <TouchableOpacity
                  style={[styles.topDeliveryPill, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' }]}
                  onPress={() => setPincodeModal(true)}
                >
                  <Text style={[styles.topDeliveryPillText, { color: '#ef4444' }]}>Try Another Pincode</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.topDeliveryPill, isDark ? styles.deliveryPillSecondaryDark : styles.deliveryPillSecondaryLight]}
                  onPress={() => resolveByGps()}
                >
                  <Text style={[styles.topDeliveryPillText, isDark ? styles.deliveryPillSecTextDark : styles.deliveryPillSecTextLight]}>
                    🧭 Use GPS
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )
        ) : (
          <>
            <View style={styles.topDeliveryInfoRow}>
              <Text style={[styles.topDeliveryLocationText, isDark ? styles.deliveryTextYellow : styles.deliveryTextGreen]} numberOfLines={1}>
                📍 Select Delivery Location
              </Text>
            </View>
            <View style={styles.topDeliveryEtaRow}>
              <Text style={[styles.topDeliveryEtaText, isDark ? styles.deliveryEtaDark : styles.deliveryEtaLight]}>
                Enter PIN code or allow GPS to check instant delivery ETA
              </Text>
            </View>
            <View style={styles.topDeliveryActionRow}>
              <TouchableOpacity
                style={[styles.topDeliveryPill, isDark ? styles.deliveryPillDark : styles.deliveryPillLight]}
                onPress={() => resolveByGps()}
              >
                <Text style={[styles.topDeliveryPillText, isDark ? styles.deliveryPillTextDark : styles.deliveryPillTextLight]}>
                  {deliveryLoading ? 'Detecting...' : '🧭 Detect My Location'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.topDeliveryPill, isDark ? styles.deliveryPillSecondaryDark : styles.deliveryPillSecondaryLight]}
                onPress={() => setPincodeModal(true)}
              >
                <Text style={[styles.topDeliveryPillText, isDark ? styles.deliveryPillSecTextDark : styles.deliveryPillSecTextLight]}>
                  Enter Pincode
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ── 2. Sticky Navbar with 3-Lines Menu + Brand + Search + Cart ───── */}
      <View style={[styles.navbar, isDark ? styles.navbarDark : styles.navbarLight]}>
        <View style={styles.navbarTopRow}>
          <TouchableOpacity
            style={[styles.navIconBtn, isDark ? styles.navIconBtnDark : styles.navIconBtnLight]}
            onPress={() => setCategoriesDrawerOpen(true)}
          >
            <Text style={{ fontSize: 20, color: isDark ? '#fff' : '#0f172a' }}>☰</Text>
          </TouchableOpacity>

          <View style={styles.brandTitleContainer}>
            <Text style={styles.brandLeaf}>🌿</Text>
            <Text style={[styles.brandTextPrimary, isDark ? { color: '#34d399' } : { color: '#059669' }]}>
              FarmFresh<Text style={styles.brandTextAccent}>Farmer</Text>
            </Text>
          </View>

          <View style={styles.navbarRightGroup}>
            <TouchableOpacity
              style={[styles.navCircleBtn, isDark ? styles.navCircleBtnDark : styles.navCircleBtnLight]}
              onPress={handleToggleTheme}
            >
              <Text style={{ fontSize: 16 }}>{isDark ? '🌕' : '☀️'}</Text>
            </TouchableOpacity>

            {user && (
              (() => {
                const isSuperAdmin = user.isPrimaryAdmin || user.email?.toLowerCase() === "admin@farmfreshfarmer.com";
                const isStaff = isSuperAdmin || user.role !== "customer";
                const starsCount = isSuperAdmin
                  ? 6
                  : isStaff
                  ? Math.max(0, Math.min(6, Number(user.starRating) ?? 5))
                  : Math.max(0, Math.min(5, Number(user.customerStars) || 0));

                const tierCol = starsCount <= 2
                  ? { color: '#22c55e', bg: 'rgba(34,197,94,0.18)', border: 'rgba(34,197,94,0.45)' }
                  : starsCount === 3
                  ? { color: '#cd7f32', bg: 'rgba(205,127,50,0.18)', border: 'rgba(205,127,50,0.45)' }
                  : starsCount === 4
                  ? { color: '#c0c0c0', bg: 'rgba(192,192,192,0.22)', border: 'rgba(192,192,192,0.55)' }
                  : starsCount === 5
                  ? { color: '#3b82f6', bg: 'rgba(59,130,246,0.2)', border: 'rgba(59,130,246,0.45)' }
                  : { color: '#fbbf24', bg: 'rgba(251,191,36,0.22)', border: 'rgba(251,191,36,0.6)' };

                return (
                  <TouchableOpacity
                    style={[styles.navCircleBtn, { backgroundColor: tierCol.bg, borderColor: tierCol.border, borderWidth: 1, paddingHorizontal: 7, width: 'auto' }]}
                    onPress={() => router.push('/(tabs)/account')}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '900', color: tierCol.color }}>
                      {isSuperAdmin ? '👑 6★' : `★ ${starsCount}`}
                    </Text>
                  </TouchableOpacity>
                );
              })()
            )}

            <TouchableOpacity
              style={[styles.navCircleBtn, isDark ? styles.navCircleBtnDark : styles.navCircleBtnLight]}
              onPress={() => router.push('/(tabs)/account')}
            >
              <Text style={{ fontSize: 16 }}>👤</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cartIconBtn,
                isDark ? styles.cartIconBtnDark : styles.cartIconBtnLight,
                cartCount > 0 && styles.cartIconBtnActive,
              ]}
              onPress={() => router.push('/(tabs)/basket')}
            >
              <Text style={{ fontSize: 18 }}>🛒</Text>
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Integrated Global Real-Time Search Bar */}
        <View style={[styles.searchBarWrapper, isDark ? styles.searchBarWrapperDark : styles.searchBarWrapperLight]}>
          <TextInput
            style={[styles.searchBarInput, isDark ? styles.textWhite : styles.textDark]}
            placeholder="Search organic fruits, vegetables, pickles, sweets..."
            placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
            value={searchQuery}
            onChangeText={(txtVal) => {
              setSearchQuery(txtVal);
              if (txtVal.trim()) {
                setSelectedCategory(null);
                scrollViewRef.current?.scrollTo({ y: productsLayoutY.current, animated: true });
              }
            }}
          />
          {searchQuery.trim() ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ paddingHorizontal: 6 }}>
              <Text style={{ fontSize: 14, color: isDark ? '#94a3b8' : '#64748b' }}>✕</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.searchIconBtn, isDark ? styles.searchIconBtnDark : styles.searchIconBtnLight]}>
            <Text style={{ fontSize: 15, color: '#ffffff' }}>🔍</Text>
          </TouchableOpacity>
        </View>

        {/* Recommendation Chips / Quick Suggestions */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recommendationsScroll} contentContainerStyle={{ paddingVertical: 4 }}>
          {SEARCH_RECOMMENDATIONS.map((rec, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.recChip,
                isDark ? styles.recChipDark : styles.recChipLight,
                searchQuery.toLowerCase() === rec.query && styles.recChipActive,
              ]}
              onPress={() => handleRecommendationPress(rec.query)}
            >
              <Text style={[styles.recChipText, isDark ? styles.textWhite : styles.textDark]}>
                {rec.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Minimal Animated Free Delivery Progress Bar ──────────────────────────────── */}
      <AnimatedFreeDeliveryBar subtotal={cartSubtotal} threshold={freeDeliveryThreshold} isDark={isDark} />

      {/* ── Scrollable Body ─────────────────────────────────────────────── */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.primary} />}
      >
        {/* ── 3. Hero Landing Section ───────────────────────────────────── */}
        <View style={[styles.heroSection, isDark ? styles.heroSectionDark : styles.heroSectionLight]}>
          <View style={[styles.heroBadgePill, isDark ? styles.heroBadgePillDark : styles.heroBadgePillLight]}>
            <Text style={[styles.heroBadgePillText, isDark ? { color: '#34d399' } : { color: '#059669' }]}>
              ✨ {txt.hero_badge_text || "Vijayawada's #1 Instant Organic Farm Delivery"}
            </Text>
          </View>

          <Text style={[styles.heroHeadline, isDark ? styles.textWhite : styles.textDark]}>
            {txt.hero_headline_text || 'Fresh from local farms,\ndelivered straight to your doorstep.'}
          </Text>

          <Text style={[styles.heroSubtitle, isDark ? styles.textMutedDark : styles.textMutedLight]}>
            {txt.hero_subtitle_text ||
              'Hand-picked organic fruits, vine-ripened vegetables, authentic ghee sweets, traditional Andhra pickles, millets & spices.'}
          </Text>

          <View style={styles.heroCtaRow}>
            <TouchableOpacity style={styles.exploreCategoriesBtn} onPress={handleExploreCategoriesPress}>
              <Text style={styles.exploreCategoriesBtnText}>Explore Categories →</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.referEarnHeroBtn} onPress={() => router.push('/(tabs)/referrals')}>
              <Text style={styles.referEarnHeroBtnText}>🎁 Refer & Earn Rewards</Text>
            </TouchableOpacity>
          </View>

          {/* Feature Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.heroFeatureStrip, isDark ? styles.heroFeatureStripDark : styles.heroFeatureStripLight]}
            contentContainerStyle={styles.heroFeatureStripContent}
          >
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🛡️</Text>
              <Text style={[styles.featureText, isDark ? styles.textWhite : styles.textDark]}>100% Naturally Grown</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>⚡</Text>
              <Text style={[styles.featureText, isDark ? styles.textWhite : styles.textDark]}>Instant Delivery ETA</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📦</Text>
              <Text style={[styles.featureText, isDark ? styles.textWhite : styles.textDark]}>Zero Preservatives</Text>
            </View>
          </ScrollView>

          {/* Hero Showcase Card */}
          <View style={[styles.heroShowcaseCard, isDark ? styles.heroShowcaseCardDark : styles.heroShowcaseCardLight]}>
            <Image
              source={{ uri: resolveImgUrl(heroConfig?.customImageUrl || '/images/p-mango.jpg') }}
              style={styles.heroShowcaseImage}
              resizeMode="cover"
            />
            <View style={styles.heroFloatingBadgeTop}>
              <Text style={{ fontSize: 16 }}>🌿</Text>
              <View>
                <Text style={styles.heroFloatingTitle}>Direct Farm Harvest</Text>
                <Text style={styles.heroFloatingSub}>Picked this morning</Text>
              </View>
            </View>
            <View style={styles.heroFloatingBadgeBottom}>
              <Text style={{ fontSize: 16 }}>⚡</Text>
              <View>
                <Text style={styles.heroFloatingTitle}>Express Delivery</Text>
                <Text style={styles.heroFloatingSub}>Combined ETA calculated live</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── 4. Curated Categories 2-Column Grid (Screenshot 1) ─────────── */}
        <View
          style={styles.categoriesSection}
          onLayout={(e) => {
            categoriesLayoutY.current = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.sectionHeaderCentered}>
            <View style={[styles.curatedBadgePill, isDark ? styles.curatedBadgePillDark : styles.curatedBadgePillLight]}>
              <Text style={[styles.curatedBadgePillText, isDark ? { color: '#34d399' } : { color: '#059669' }]}>
                CURATED CATEGORIES
              </Text>
            </View>
            <Text style={[styles.curatedSectionTitle, isDark ? styles.textWhite : styles.textDark]}>
              Explore Our Organic Harvest
            </Text>
          </View>

          <View style={styles.categoriesGrid}>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.slug;
              const catImg = CAT_IMAGES[cat.slug] || cat.image || '/images/cat-fruits.jpg';
              const isCatVeg = cat.dietTag !== 'nonveg';
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryCard,
                    isDark ? styles.categoryCardDark : styles.categoryCardLight,
                    isSelected && (isDark ? styles.categoryCardActiveDark : styles.categoryCardActiveLight),
                  ]}
                  onPress={() => handleCategoryPress(cat.slug)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.catCircleBorder, isSelected && styles.catCircleBorderActive]}>
                    <Image source={{ uri: resolveImgUrl(catImg) }} style={styles.catCircleImage} resizeMode="cover" />
                  </View>
                  <View style={styles.catTitleRow}>
                    <Text style={[styles.catCardTitle, isDark ? styles.textWhite : styles.textDark]}>{cat.name}</Text>
                    <Text style={{ fontSize: 12 }}>{isCatVeg ? '🟢' : '🔴'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 5. Peak Season Favorites / Filtered Products (Screenshot 1 & 2) ─── */}
        <View
          style={styles.productsSection}
          onLayout={(e) => {
            productsLayoutY.current = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.sectionHeaderLeft}>
            {searchQuery.trim() ? (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Text style={[styles.productsSectionTitle, isDark ? styles.textWhite : styles.textDark]}>
                    Search Results for "{searchQuery}"
                  </Text>
                  <TouchableOpacity
                    style={styles.clearCategoryFilterBtn}
                    onPress={() => setSearchQuery('')}
                  >
                    <Text style={styles.clearCategoryFilterBtnText}>Clear Search ✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.productCountSubtitle, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                  {filteredProducts.length} organic product{filteredProducts.length !== 1 ? 's' : ''} found
                </Text>
              </View>
            ) : selectedCategory ? (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Text style={[styles.productsSectionTitle, isDark ? styles.textWhite : styles.textDark]}>
                    {currentCategoryObj?.name || selectedCategory}
                  </Text>
                  <Text style={{ fontSize: 16 }}>{currentCategoryObj?.dietTag === 'nonveg' ? '🔴' : '🟢'}</Text>
                  <TouchableOpacity
                    style={styles.clearCategoryFilterBtn}
                    onPress={() => setSelectedCategory(null)}
                  >
                    <Text style={styles.clearCategoryFilterBtnText}>Show All ✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.productCountSubtitle, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                  {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} available
                </Text>
              </View>
            ) : (
              <View>
                <View style={styles.favoritesBadgePill}>
                  <Text style={styles.favoritesBadgePillText}>PEAK SEASON FAVORITES</Text>
                </View>
                <Text style={[styles.productsSectionTitle, isDark ? styles.textWhite : styles.textDark]}>
                  Fresh Picks for You
                </Text>
              </View>
            )}
          </View>

          {filteredProducts.length === 0 ? (
            <View style={styles.noProductsFoundBox}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🌱</Text>
              <Text style={[styles.noProductsFoundTitle, isDark ? styles.textWhite : styles.textDark]}>
                No products found
              </Text>
              <Text style={[styles.noProductsFoundSub, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                Try searching for another fresh item or explore all categories.
              </Text>
              <TouchableOpacity
                style={styles.resetFiltersBtn}
                onPress={() => {
                  setSelectedCategory(null);
                  setSearchQuery('');
                }}
              >
                <Text style={styles.resetFiltersBtnText}>Reset Filters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.productsGrid}>
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} maxRadiusKm={maxRadius} />
              ))}
            </View>
          )}
        </View>

        {/* ── 6. Farm-to-Home Promise Bento Grid ────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginTop: 24, marginBottom: 32 }}>
          <View style={[styles.promiseCard, isDark ? styles.promiseCardDark : styles.promiseCardLight]}>
            <Text style={[styles.promiseBadge, isDark ? { color: '#34d399' } : { color: '#059669' }]}>
              {txt.promise_badge_text || 'VISAKHAPATNAM FARM TO FORK'}
            </Text>
            <Text style={[styles.promiseTitle, isDark ? styles.textWhite : styles.textDark]}>
              {txt.promise_title_text || 'Our Farm-to-Home Promise'}
            </Text>
            <Text style={[styles.promiseDesc, isDark ? styles.textMutedDark : styles.textMutedLight]}>
              {txt.promise_desc_text ||
                'Connecting households directly with local organic farms and authentic Andhra kitchens. Zero chemicals, zero artificial ripening, and instant delivery right when you need it.'}
            </Text>

            <View style={styles.promiseGrid}>
              {[
                {
                  icon: '🌿',
                  title: txt.promise_card1_title || '100% Organic',
                  desc: txt.promise_card1_desc || 'Sourced daily from certified local organic farms.',
                },
                {
                  icon: '⚡',
                  title: txt.promise_card2_title || 'Instant Delivery',
                  desc: txt.promise_card2_desc || 'Live ETA + packing mins calculated for your location.',
                },
                {
                  icon: '🍯',
                  title: txt.promise_card3_title || 'Authentic Recipes',
                  desc: txt.promise_card3_desc || 'Pure ghee sweets & spicy avakaya pickles.',
                },
                {
                  icon: '⭐',
                  title: txt.promise_card4_title || 'Rated 4.9/5 Stars',
                  desc: txt.promise_card4_desc || 'Trusted by 1,200+ households across Andhra.',
                },
              ].map((card, idx) => (
                <View key={idx} style={[styles.promiseItem, isDark ? styles.promiseItemDark : styles.promiseItemLight]}>
                  <Text style={{ fontSize: 24, marginBottom: 6 }}>{card.icon}</Text>
                  <Text style={[styles.promiseItemTitle, isDark ? styles.textWhite : styles.textDark]}>{card.title}</Text>
                  <Text style={[styles.promiseItemDesc, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                    {card.desc}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={[styles.promiseRating, isDark ? styles.textWhite : styles.textDark]}>
              ⭐⭐⭐⭐⭐ Rated 4.9/5 by 1,200+ Households
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── 7. Category Drawer / Menu Modal (Smooth Animated Side Drawer) ─────────── */}
      <AnimatedSideMenu
        visible={categoriesDrawerOpen}
        onClose={() => setCategoriesDrawerOpen(false)}
        isDark={isDark}
        user={user}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={(slug) => {
          if (!slug) {
            setSelectedCategory(null);
            setSearchQuery('');
            setTimeout(() => {
              scrollViewRef.current?.scrollTo({ y: productsLayoutY.current, animated: true });
            }, 100);
          } else {
            handleCategoryPress(slug);
          }
        }}
        onOpenPincodeModal={() => setPincodeModal(true)}
        onToggleTheme={handleToggleTheme}
        router={router}
        cartCount={cartCount}
      />

      {/* ── 8. PIN Code Modal ────────────────────────────────────────────── */}
      <Modal visible={pincodeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark ? styles.modalCardDark : styles.modalCardLight]}>
            <Text style={[styles.modalTitle, isDark ? styles.textWhite : styles.textDark]}>Set Delivery Location</Text>
            <Text style={[styles.modalSub, isDark ? styles.textMutedDark : styles.textMutedLight]}>
              Enter your 6-digit PIN code to view nearby warehouse & delivery ETA
            </Text>
            <TextInput
              style={[styles.modalInput, isDark ? styles.modalInputDark : styles.modalInputLight]}
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              placeholder="e.g. 522001"
              value={inputPincode}
              onChangeText={setInputPincode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.gpsBtn, isDark ? styles.gpsBtnDark : styles.gpsBtnLight]}
                onPress={() => {
                  resolveByGps();
                  setPincodeModal(false);
                }}
              >
                <Text style={[styles.gpsBtnText, isDark ? styles.textWhite : styles.textDark]}>
                  {deliveryLoading ? 'Detecting...' : 'Use GPS 🛰️'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handlePincodeSubmit}>
                <Text style={styles.submitBtnText}>Submit</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setPincodeModal(false)}>
              <Text style={[styles.closeBtnText, isDark ? styles.textMutedDark : styles.textMutedLight]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  scrollBody: { flex: 1 },

  // 1. Top Delivery ETA Header Bar
  topDeliveryBar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  topDeliveryBarDark: {
    backgroundColor: '#022c22',
    borderBottomColor: 'rgba(52, 211, 153, 0.25)',
  },
  topDeliveryBarLight: {
    backgroundColor: '#ecfdf5',
    borderBottomColor: '#a7f3d0',
  },
  deliveryBarUnserviceableDark: {
    backgroundColor: '#450a0a',
    borderBottomColor: 'rgba(239, 68, 68, 0.3)',
  },
  deliveryBarUnserviceableLight: {
    backgroundColor: '#fef2f2',
    borderBottomColor: '#fecaca',
  },
  topDeliveryInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  topDeliveryLocationText: { fontSize: 12, fontWeight: '600' },
  deliveryTextYellow: { color: '#fde047' },
  deliveryTextGreen: { color: '#065f46' },

  topDeliveryEtaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  topDeliveryEtaText: { fontSize: 11, fontWeight: '700' },
  deliveryEtaDark: { color: '#6ee7b7' },
  deliveryEtaLight: { color: '#047857' },

  topDeliveryActionRow: { flexDirection: 'row', gap: 8 },
  topDeliveryPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  deliveryPillDark: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981' },
  deliveryPillLight: { backgroundColor: '#d1fae5', borderColor: '#34d399' },
  topDeliveryPillText: { fontSize: 11, fontWeight: '700' },
  deliveryPillTextDark: { color: '#34d399' },
  deliveryPillTextLight: { color: '#065f46' },

  deliveryPillSecondaryDark: { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.2)' },
  deliveryPillSecondaryLight: { backgroundColor: '#ffffff', borderColor: '#a7f3d0' },
  deliveryPillSecTextDark: { color: '#a7f3d0' },
  deliveryPillSecTextLight: { color: '#047857' },

  // 2. Navbar
  navbar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  navbarDark: { backgroundColor: '#021812', borderBottomColor: 'rgba(52, 211, 153, 0.2)' },
  navbarLight: { backgroundColor: '#ffffff', borderBottomColor: '#e2e8f0' },
  navbarTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navIconBtn: {
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  navIconBtnDark: { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderColor: 'rgba(255, 255, 255, 0.12)' },
  navIconBtnLight: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  brandTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandLeaf: { fontSize: 18 },
  brandTextPrimary: { fontSize: 18, fontWeight: '900', fontFamily: 'serif' },
  brandTextAccent: { color: '#fbbf24' },
  navbarRightGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  navCircleBtnDark: { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.15)' },
  navCircleBtnLight: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  cartIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  cartIconBtnDark: { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.15)' },
  cartIconBtnLight: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  cartIconBtnActive: { backgroundColor: '#10b981', borderColor: '#059669' },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fbbf24',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: { color: '#000', fontSize: 10, fontWeight: '900' },

  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
    marginTop: 10,
    borderWidth: 1,
  },
  searchBarWrapperDark: { backgroundColor: '#041f17', borderColor: 'rgba(52, 211, 153, 0.35)' },
  searchBarWrapperLight: { backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
  searchBarInput: { flex: 1, fontSize: 13, paddingVertical: 6 },
  searchIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIconBtnDark: { backgroundColor: '#10b981' },
  searchIconBtnLight: { backgroundColor: '#10b981' },

  recommendationsScroll: { marginTop: 8 },
  recChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 6,
    borderWidth: 1,
  },
  recChipLight: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  recChipDark: { backgroundColor: '#061a14', borderColor: 'rgba(52, 211, 153, 0.25)' },
  recChipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  recChipText: { fontSize: 11, fontWeight: '700' },

  // 3. Hero Section
  heroSection: { padding: 16, paddingTop: 20 },
  heroSectionDark: { backgroundColor: '#050505' },
  heroSectionLight: { backgroundColor: '#ffffff' },
  heroBadgePill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  heroBadgePillDark: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(52, 211, 153, 0.3)' },
  heroBadgePillLight: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  heroBadgePillText: { fontSize: 11, fontWeight: '800' },
  heroHeadline: { fontSize: 26, fontWeight: '900', lineHeight: 32, fontFamily: 'serif', marginBottom: 10 },
  heroSubtitle: { fontSize: 13, lineHeight: 19, marginBottom: 16 },
  heroCtaRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  exploreCategoriesBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#10b981',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  exploreCategoriesBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  referEarnHeroBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
  },
  referEarnHeroBtnText: { color: '#fbbf24', fontWeight: '800', fontSize: 12 },

  heroFeatureStrip: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    maxHeight: 44,
  },
  heroFeatureStripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
    minWidth: '100%',
  },
  heroFeatureStripDark: { backgroundColor: '#0c121e', borderColor: 'rgba(52, 211, 153, 0.2)' },
  heroFeatureStripLight: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  featureIcon: { fontSize: 12 },
  featureText: { fontSize: 9.5, fontWeight: '700' },

  heroShowcaseCard: {
    borderRadius: 24,
    overflow: 'hidden',
    height: 260,
    position: 'relative',
    borderWidth: 1,
    shadowColor: '#10b981',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 6,
  },
  heroShowcaseCardDark: { backgroundColor: '#0c121e', borderColor: 'rgba(52, 211, 153, 0.3)' },
  heroShowcaseCardLight: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  heroShowcaseImage: { width: '100%', height: '100%' },
  heroFloatingBadgeTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  heroFloatingBadgeBottom: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  heroFloatingTitle: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  heroFloatingSub: { color: '#94a3b8', fontSize: 9 },

  // 4. Curated Categories 2-Column Grid (Screenshot 1)
  categoriesSection: { paddingHorizontal: 16, marginTop: 24 },
  sectionHeaderCentered: { alignItems: 'center', marginBottom: 16 },
  curatedBadgePill: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  curatedBadgePillDark: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(52, 211, 153, 0.35)' },
  curatedBadgePillLight: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  curatedBadgePillText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  curatedSectionTitle: { fontSize: 24, fontWeight: '900', fontFamily: 'serif', textAlign: 'center' },

  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  categoryCard: {
    width: '48%',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  categoryCardLight: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  categoryCardDark: { backgroundColor: '#091510', borderColor: 'rgba(52, 211, 153, 0.2)' },
  categoryCardActiveDark: { borderColor: '#10b981', backgroundColor: '#062d22' },
  categoryCardActiveLight: { borderColor: '#059669', backgroundColor: '#ecfdf5' },
  catCircleBorder: {
    width: 104,
    height: 104,
    borderRadius: 52,
    padding: 3,
    borderWidth: 2.5,
    borderColor: '#059669',
    marginBottom: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catCircleBorderActive: { borderColor: '#34d399', borderWidth: 3.5 },
  catCircleImage: { width: '100%', height: '100%', borderRadius: 50 },
  catTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  catCardTitle: { fontSize: 14, fontWeight: '800', fontFamily: 'serif', textAlign: 'center' },

  // 5. Featured Products Grid (Screenshot 2)
  productsSection: { paddingHorizontal: 16, marginTop: 16 },
  sectionHeaderLeft: { marginBottom: 14, paddingTop: 4, overflow: 'visible' },
  favoritesBadgePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 6,
  },
  favoritesBadgePillText: { color: '#fbbf24', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  productsSectionTitle: { fontSize: 22, fontWeight: '800', lineHeight: 30 },
  productCountSubtitle: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  clearCategoryFilterBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  clearCategoryFilterBtnText: { color: '#ef4444', fontSize: 11, fontWeight: '800' },

  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  productCardWrapper: { width: '48%' },
  productCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  productCardLight: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  productCardDark: { backgroundColor: '#091510', borderColor: 'rgba(52, 211, 153, 0.2)' },
  cardTopAccent: { height: 3, width: '100%', backgroundColor: '#10b981' },

  imageWrapper: { width: '100%', height: 130, position: 'relative', overflow: 'hidden', backgroundColor: '#091510' },
  productImage: { width: '100%', height: 130 },
  productImagePlaceholder: { backgroundColor: '#091510', alignItems: 'center', justifyContent: 'center' },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountText: { color: '#000000', fontSize: 10, fontWeight: '900' },
  localOnlyBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(120, 53, 15, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  localOnlyText: { color: '#fef3c7', fontSize: 9, fontWeight: '800' },
  inCartBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inCartText: { color: '#ffffff', fontSize: 9, fontWeight: '800' },

  productInfo: { padding: 12 },
  categoryTag: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  productName: { fontSize: 14, fontWeight: '800', fontFamily: 'serif' },
  productUnit: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  priceRow: { marginTop: 6 },
  price: { fontSize: 16, fontWeight: '900', color: '#10b981' },
  originalPrice: { fontSize: 11, color: '#94a3b8', textDecorationLine: 'line-through' },

  stepperAndBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  cartQtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
    flex: 1,
    justifyContent: 'space-between',
  },
  cartQtyControlLight: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  cartQtyControlDark: { backgroundColor: '#0f172a', borderColor: '#1e293b' },
  stepBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  stepBtnText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  stepQtyText: { fontSize: 12, fontWeight: '800' },
  addBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnInCart: { backgroundColor: '#10b981' },
  addBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },

  noProductsFoundBox: { alignItems: 'center', justifyContent: 'center', padding: 30 },
  noProductsFoundTitle: { fontSize: 18, fontWeight: '800', fontFamily: 'serif', marginBottom: 4 },
  noProductsFoundSub: { fontSize: 12, textAlign: 'center', marginBottom: 14 },
  resetFiltersBtn: { backgroundColor: '#059669', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  resetFiltersBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },

  // 6. Promise Bento Grid
  promiseCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  promiseCardDark: { backgroundColor: '#0c121e', borderColor: 'rgba(16, 185, 129, 0.25)' },
  promiseCardLight: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  promiseBadge: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  promiseTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  promiseDesc: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  promiseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  promiseItem: {
    width: '47%',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  promiseItemDark: { backgroundColor: '#0f172a', borderColor: '#1e293b' },
  promiseItemLight: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  promiseItemTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  promiseItemDesc: { fontSize: 11, lineHeight: 14 },
  promiseRating: { textAlign: 'center', fontSize: 12, fontWeight: '700', marginTop: 4 },

  // 7. Drawer Modal
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-start' },
  drawerCard: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    padding: 20,
    paddingTop: 50,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  drawerCardDark: { backgroundColor: '#021812', borderWidth: 1, borderColor: 'rgba(52, 211, 153, 0.3)' },
  drawerCardLight: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
  drawerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  drawerCloseBtn: { padding: 8 },
  categoryPillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 10 },
  categoryPillItem: {
    width: '48%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryPillItemLight: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  categoryPillItemDark: { backgroundColor: '#062d22', borderColor: 'rgba(52, 211, 153, 0.25)' },
  categoryPillItemActiveDark: { borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  categoryPillItemActiveLight: { borderColor: '#059669', backgroundColor: '#ecfdf5' },
  categoryPillText: { fontSize: 13, fontWeight: '700' },

  // 8. PIN Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '88%', borderRadius: 32, padding: 28, alignItems: 'center' },
  modalCardDark: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.3)' },
  modalCardLight: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalSub: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  modalInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    fontSize: 20,
    textAlign: 'center',
    marginVertical: 20,
    fontWeight: '600',
    letterSpacing: 2,
  },
  modalInputDark: { backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', borderColor: 'rgba(255,255,255,0.1)' },
  modalInputLight: { backgroundColor: '#f8fafc', color: '#0f172a', borderColor: '#e2e8f0' },
  modalBtnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  gpsBtn: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center' },
  gpsBtnDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  gpsBtnLight: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  gpsBtnText: { fontWeight: '600', fontSize: 14 },
  submitBtn: { flex: 1, backgroundColor: '#10b981', padding: 16, borderRadius: 16, alignItems: 'center' },
  submitBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  closeBtn: { marginTop: 20 },
  closeBtnText: { fontSize: 14, fontWeight: '600' },

  textWhite: { color: '#ffffff' },
  textDark: { color: '#0f172a' },
  textMutedDark: { color: '#94a3b8' },
  textMutedLight: { color: '#64748b' },
});
