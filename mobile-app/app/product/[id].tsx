import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  TextInput, ActivityIndicator, Alert, useWindowDimensions
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { COLORS, BRAND } from '../../constants/config';
import { useDelivery } from '../../hooks/useDelivery';
import { useThemeStore } from '../../lib/theme';
import { useCartStore } from '../../lib/cart';
import { useAuth } from '../../lib/store';
import { api, resolveImgUrl } from '../../lib/api';
import type { Product } from '../../lib/types';

// ─── Similar Product Card ─────────────────────────────────────────────────────
function SimilarProductCard({ product }: { product: Product }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const { resolution } = useDelivery();
  const radius = resolution?.maxRadiusKm || 30;

  const items = useCartStore((state) => state.items) || [];
  const addItem = useCartStore((state) => state.addItem);
  const updateQty = useCartStore((state) => state.updateQty);
  const removeItem = useCartStore((state) => state.removeItem);

  const [localQty, setLocalQty] = useState(1);
  const price = parseFloat(product.price);
  const discount = parseFloat(product.discountPercent || '0');
  const effectivePrice = discount > 0 ? price * (1 - discount / 100) : price;

  const cartItem = items.find((i) => i.id === product.id || (i as any).productId === product.id);
  const inCartQty = cartItem?.qty || 0;
  const isInCart = inCartQty > 0;
  const isLocalOnly = (product as any).allowInternationalShipping === false;
  const isVeg = product.dietTag !== 'nonveg';
  const outOfStock = Number(product.stock !== undefined ? product.stock : 999) <= 0;

  const handleAddToCart = () => {
    if (outOfStock) {
      Alert.alert('Out of Stock', 'This item is currently out of stock.');
      return;
    }
    addItem(product, localQty);
    Alert.alert('Added to Basket! 🎉', `${localQty} × ${product.name} added to your basket.`);
    setLocalQty(1);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={[styles.similarCard, isDark ? styles.similarCardDark : styles.similarCardLight]}
      onPress={() => router.push(`/product/${product.id}`)}
    >
      <View style={styles.cardTopAccent} />

      <View style={styles.similarImageWrapper}>
        {product.image ? (
          <Image source={{ uri: resolveImgUrl(product.image) }} style={styles.similarImage} resizeMode="cover" />
        ) : (
          <View style={[styles.similarImage, styles.imagePlaceholder]}><Text style={{ fontSize: 28 }}>🌱</Text></View>
        )}

        {discount > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{Math.round(discount)}% OFF</Text>
          </View>
        )}

        {isLocalOnly && (
          <View style={styles.localOnlyBadge}>
            <Text style={styles.localOnlyText}>📍 Local ({radius}km)</Text>
          </View>
        )}

        {isInCart && (
          <View style={styles.inCartBadge}>
            <Text style={styles.inCartText}>✓ {inCartQty}</Text>
          </View>
        )}
      </View>

      <View style={styles.similarInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          <Text style={{ fontSize: 10 }}>{isVeg ? '🟢' : '🔴'}</Text>
          <Text style={[styles.categoryTag, isDark ? { color: '#34d399' } : { color: '#059669' }]}>
            {product.categorySlug?.toUpperCase() || 'FRESH'}
          </Text>
        </View>

        <Text style={[styles.similarName, isDark && styles.textWhite]} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={[styles.similarUnit, isDark && styles.textMutedDark]}>{product.unit}</Text>

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
                onPress={() => inCartQty === 1 ? removeItem(product.id) : updateQty(product.id, inCartQty - 1)}
              >
                <Text style={[styles.stepBtnText, inCartQty === 1 && { color: COLORS.error }]}>
                  {inCartQty === 1 ? '🗑' : '−'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.stepQtyText, isDark && styles.textWhite]}>{inCartQty}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => updateQty(product.id, inCartQty + 1)}>
                <Text style={[styles.stepBtnText, { color: '#10b981' }]}>+</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.cartQtyControl, isDark ? styles.cartQtyControlDark : styles.cartQtyControlLight]}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setLocalQty(Math.max(1, localQty - 1))}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={[styles.stepQtyText, isDark && styles.textWhite]}>{localQty}</Text>
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
  );
}

// ─── Main Product Detail Screen ───────────────────────────────────────────────
export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const items = useCartStore((state) => state.items) || [];
  const addItem = useCartStore((state) => state.addItem);
  const cartCount = items.reduce((s, i) => s + i.qty, 0);

  const { resolution } = useDelivery();
  const radius = resolution?.maxRadiusKm || 30;
  const warehouseName = resolution?.warehouseName || 'Local Warehouse';

  const [qty, setQty] = useState(1);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: () => api.get(`/api/products/${id}`).then((r) => r.data),
  });

  const { data: reviews = [] } = useQuery<any[]>({
    queryKey: ['reviews', id],
    queryFn: () => api.get(`/api/reviews?productId=${id}`).then((r) => r.data || []),
  });

  const { data: allProductsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/api/products').then((r) => r.data),
  });

  const submitReview = useMutation({
    mutationFn: () => api.post(`/api/reviews`, { productId: Number(id), rating: reviewRating, comment: reviewComment }),
    onSuccess: () => {
      Alert.alert('Thank You! 🎉', 'Your review has been submitted successfully.');
      setReviewComment('');
      queryClient.invalidateQueries({ queryKey: ['reviews', id] });
    },
    onError: (err: any) => {
      Alert.alert('Review Failed', err?.response?.data?.message || 'Please log in to submit a review.');
    }
  });

  if (isLoading) {
    return (
      <View style={[styles.mainContainer, isDark ? styles.containerDark : styles.containerLight, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.mainContainer, isDark ? styles.containerDark : styles.containerLight, { padding: 20, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back to Harvest</Text>
        </TouchableOpacity>
        <Text style={[styles.errorTitle, isDark && styles.textWhite]}>Product not found</Text>
      </View>
    );
  }

  const price = parseFloat(product.price);
  const discount = parseFloat(product.discountPercent || '0');
  const effectivePrice = discount > 0 ? price * (1 - discount / 100) : price;
  const isVeg = product.dietTag !== 'nonveg';
  const outOfStock = Number(product.stock !== undefined ? product.stock : 999) <= 0;

  const allProducts: Product[] = allProductsData?.products || allProductsData || [];
  const similarProducts = allProducts.filter(p => p.categoryId === product.categoryId && p.id !== product.id).slice(0, 6);

  const bg = isDark ? '#050505' : '#f8fafc';
  const cardBg = isDark ? '#0c121e' : '#ffffff';
  const borderCol = isDark ? 'rgba(16, 185, 129, 0.25)' : '#e2e8f0';

  const handleAddToCart = () => {
    if (!user) {
      Alert.alert('Sign In Required 🔐', 'Please log in to your account to add fresh items to your basket.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/(auth)/login') }
      ]);
      return;
    }
    if (outOfStock) {
      Alert.alert('Out of Stock ⚠️', 'This item is currently out of stock.');
      return;
    }
    addItem(product, qty);
    Alert.alert('Added to Basket! 🎉', `${qty} × ${product.name} added to your basket.`);
  };

  return (
    <View style={[styles.mainContainer, { backgroundColor: bg }]}>
      {/* ── Top Header Navigation Bar ───────────────────────────────────────── */}
      <View style={[styles.topNavBar, isDark && styles.topNavBarDark, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.brandTitleContainer}>
          <Text style={styles.brandLeaf}>🌿</Text>
          <Text style={styles.brandTextPrimary}>FarmFresh<Text style={styles.brandTextAccent}>Farmer</Text></Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={[styles.navCircleBtn, isDark && styles.navCircleBtnDark]} onPress={toggleTheme}>
            <Text style={{ fontSize: 16 }}>{isDark ? '🌕' : '☀️'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cartIconBtn, cartCount > 0 && styles.cartIconBtnActive]}
            onPress={() => router.push('/(tabs)/basket')}
          >
            <Text style={{ fontSize: 16 }}>🛒</Text>
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── 1. Hero Image Container (Auto-Resizing) ─────────────────────────── */}
        <View style={styles.heroWrapper}>
          <View style={[styles.heroImageCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            {product.image ? (
              <Image source={{ uri: resolveImgUrl(product.image) }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={[styles.heroImage, styles.imagePlaceholder]}><Text style={{ fontSize: 80 }}>🌱</Text></View>
            )}

            {/* Dynamic Local Delivery Pill at bottom-left */}
            <View style={styles.heroFloatingLocalPill}>
              <Text style={styles.heroFloatingLocalPillText} numberOfLines={1}>
                {resolution?.serviceable
                  ? `📍 Local Delivery (${radius}km from ${warehouseName})`
                  : `📍 Local Farm Harvest (${radius}km Radius)`}
              </Text>
            </View>

            {/* Floating Discount Pill at top-left */}
            {discount > 0 && (
              <View style={styles.heroFloatingDiscountPill}>
                <Text style={styles.heroFloatingDiscountPillText}>{Math.round(discount)}% OFF</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── 2. Product Information Details ─────────────────────────────────── */}
        <View style={styles.detailsContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text style={{ fontSize: 16 }}>{isVeg ? '🟢' : '🔴'}</Text>
            <Text style={[styles.productDetailTitle, isDark && styles.textWhite]}>{product.name}</Text>
          </View>

          {product.description ? (
            <Text style={[styles.productDescription, isDark && styles.textMutedDark]}>{product.description}</Text>
          ) : null}

          {/* Dual Pill Tags Row (Responsive auto-wrapping) */}
          <View style={styles.dualPillsRow}>
            <View style={styles.packSizePill}>
              <Text style={styles.packSizePillText} numberOfLines={1}>Pack Size: {product.unit}</Text>
            </View>
            <View style={styles.warehousePill}>
              <Text style={styles.warehousePillText} numberOfLines={1}>
                🛵 {resolution?.serviceable ? `Deliverable (${radius}km Radius)` : `Check PIN for Delivery ETA`}
              </Text>
            </View>
          </View>

          {/* Price & Stock status */}
          <View style={styles.priceAndStockRow}>
            <View>
              <Text style={styles.detailPrice}>₹{effectivePrice.toFixed(0)}</Text>
              {discount > 0 && <Text style={styles.detailOriginalPrice}>₹{price.toFixed(0)}</Text>}
            </View>
            <Text style={[styles.stockStatus, { color: outOfStock ? COLORS.error : '#10b981' }]}>
              {outOfStock ? '⚠️ Out of Stock' : `In Stock: ${product.stock ?? 50} unit(s) available`}
            </Text>
          </View>

          {/* Stepper + Add to Cart + Go to Cart (Auto-Resizing Responsive Layout) */}
          <View style={styles.purchaseActionContainer}>
            <View style={styles.purchaseActionRow}>
              <View style={[styles.stepperBox, isDark ? styles.stepperBoxDark : styles.stepperBoxLight]}>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => setQty(Math.max(1, qty - 1))}>
                  <Text style={[styles.stepperBtnText, isDark && styles.textWhite]}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.stepperQtyText, isDark && styles.textWhite]}>{qty}</Text>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => setQty(qty + 1)}>
                  <Text style={[styles.stepperBtnText, isDark && styles.textWhite]}>+</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.detailAddToCartBtn} onPress={handleAddToCart}>
                <Text style={styles.detailAddToCartBtnText}>🛒 Add to Cart</Text>
              </TouchableOpacity>
            </View>

            {cartCount > 0 && (
              <TouchableOpacity style={styles.detailGoToCartFullBtn} onPress={() => router.push('/(tabs)/basket')}>
                <Text style={styles.detailGoToCartFullBtnText}>🛒 View Cart ({cartCount} items) →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── 3. Customer Reviews Card ────────────────────────────────────────── */}
        <View style={[styles.reviewsCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
          <Text style={[styles.reviewsHeaderTitle, isDark && styles.textWhite]}>
            Customer Reviews ({reviews.length})
          </Text>

          <View style={[styles.writeReviewBox, isDark ? styles.writeReviewBoxDark : styles.writeReviewBoxLight]}>
            <Text style={[styles.writeReviewLabel, isDark && styles.textMutedDark]}>Write a Review</Text>
            <View style={styles.starRatingRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                  <Text style={[styles.starIcon, { color: star <= reviewRating ? '#f59e0b' : '#64748b' }]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.reviewTextInput, isDark ? styles.reviewTextInputDark : styles.reviewTextInputLight]}
              placeholder="Share your fresh harvest experience..."
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
            />

            <TouchableOpacity
              style={[styles.postReviewBtn, submitReview.isPending && { opacity: 0.6 }]}
              onPress={() => submitReview.mutate()}
              disabled={submitReview.isPending}
            >
              {submitReview.isPending ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.postReviewBtnText}>Post Review</Text>
              )}
            </TouchableOpacity>
          </View>

          {reviews.length === 0 ? (
            <Text style={styles.noReviewsText}>No reviews yet. Be the first to review this produce!</Text>
          ) : (
            <View style={styles.reviewsList}>
              {reviews.map((r, idx) => (
                <View key={idx} style={[styles.singleReview, { borderBottomColor: borderCol }]}>
                  <View style={styles.singleReviewHeader}>
                    <Text style={[styles.reviewerName, isDark && styles.textWhite]}>{r.userName || 'Verified Buyer'}</Text>
                    <Text style={{ color: '#f59e0b', fontSize: 12 }}>{'★'.repeat(r.rating || 5)}</Text>
                  </View>
                  {r.comment ? <Text style={[styles.reviewCommentText, isDark && styles.textMutedDark]}>{r.comment}</Text> : null}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── 4. Similar Organic Products Grid ─────────────────────────────────── */}
        {similarProducts.length > 0 && (
          <View style={styles.similarSection}>
            <View style={styles.similarBadgePill}>
              <Text style={styles.similarBadgePillText}>RECOMMENDED FOR YOU</Text>
            </View>
            <Text style={[styles.similarSectionTitle, isDark && styles.textWhite]}>✨ Similar Organic Products</Text>

            <View style={styles.similarGrid}>
              {similarProducts.map((p) => (
                <SimilarProductCard key={p.id} product={p} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  containerLight: { backgroundColor: '#f8fafc' },
  containerDark: { backgroundColor: '#050505' },

  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  topNavBarDark: {
    backgroundColor: '#091510',
    borderBottomColor: 'rgba(52, 211, 153, 0.2)',
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  backButtonText: { color: '#059669', fontWeight: '800', fontSize: 13 },
  brandTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  brandLeaf: { fontSize: 16 },
  brandTextPrimary: { fontSize: 17, fontWeight: '900', color: '#059669', fontFamily: 'serif' },
  brandTextAccent: { color: '#f59e0b' },
  navCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCircleBtnDark: { backgroundColor: '#091510', borderColor: 'rgba(52, 211, 153, 0.3)' },
  cartIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartIconBtnActive: { backgroundColor: '#10b981' },
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

  scrollBody: { flex: 1 },

  heroWrapper: { paddingHorizontal: 16, marginTop: 14, marginBottom: 14, width: '100%' },
  heroImageCard: {
    width: '100%',
    height: 270,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 4,
  },
  heroImage: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  heroFloatingLocalPill: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(120, 53, 15, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    maxWidth: '85%',
  },
  heroFloatingLocalPillText: { color: '#fef3c7', fontSize: 11, fontWeight: '800' },
  heroFloatingDiscountPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroFloatingDiscountPillText: { color: '#000000', fontSize: 12, fontWeight: '900' },

  detailsContainer: { paddingHorizontal: 16, marginBottom: 20, width: '100%' },
  productDetailTitle: { fontSize: 24, fontWeight: '900', fontFamily: 'serif', color: '#0f172a', flex: 1 },
  productDescription: { fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 18 },
  
  dualPillsRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', width: '100%' },
  packSizePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    flexShrink: 1,
    maxWidth: '100%',
  },
  packSizePillText: { color: '#059669', fontSize: 11, fontWeight: '700' },
  warehousePill: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    flexShrink: 1,
    maxWidth: '100%',
  },
  warehousePillText: { color: '#d97706', fontSize: 11, fontWeight: '700' },

  priceAndStockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
  },
  detailPrice: { fontSize: 26, fontWeight: '900', color: '#10b981' },
  detailOriginalPrice: { fontSize: 13, color: '#94a3b8', textDecorationLine: 'line-through' },
  stockStatus: { fontSize: 11, fontWeight: '700' },

  purchaseActionContainer: { marginTop: 16, gap: 10, width: '100%' },
  purchaseActionRow: { flexDirection: 'row', gap: 10, alignItems: 'center', width: '100%' },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 105,
    flexShrink: 0,
    justifyContent: 'space-between',
  },
  stepperBoxLight: { backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
  stepperBoxDark: { backgroundColor: '#0f172a', borderColor: '#1e293b' },
  stepperBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  stepperBtnText: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  stepperQtyText: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  detailAddToCartBtn: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    shadowColor: '#059669',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  detailAddToCartBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  detailGoToCartFullBtn: {
    backgroundColor: '#10b981',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    width: '100%',
    shadowColor: '#10b981',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  detailGoToCartFullBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },

  reviewsCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    width: 'auto',
  },
  reviewsHeaderTitle: { fontSize: 18, fontWeight: '800', fontFamily: 'serif', color: '#0f172a', marginBottom: 14 },
  writeReviewBox: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  writeReviewBoxLight: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  writeReviewBoxDark: { backgroundColor: '#091510', borderColor: 'rgba(52, 211, 153, 0.2)' },
  writeReviewLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6 },
  starRatingRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  starIcon: { fontSize: 24 },
  reviewTextInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  reviewTextInputLight: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' },
  reviewTextInputDark: { backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#ffffff' },
  postReviewBtn: {
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  postReviewBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  noReviewsText: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginVertical: 10 },
  reviewsList: { marginTop: 8 },
  singleReview: { paddingVertical: 10, borderBottomWidth: 1 },
  singleReviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reviewerName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  reviewCommentText: { fontSize: 12, color: '#64748b', lineHeight: 16 },

  similarSection: { paddingHorizontal: 16, width: '100%' },
  similarBadgePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  similarBadgePillText: { color: '#fbbf24', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  similarSectionTitle: { fontSize: 20, fontWeight: '900', fontFamily: 'serif', color: '#0f172a', marginBottom: 14 },
  similarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' },
  similarCard: {
    width: '48%',
    marginBottom: 14,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  similarCardLight: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  similarCardDark: { backgroundColor: '#091510', borderColor: 'rgba(52, 211, 153, 0.2)' },
  cardTopAccent: { height: 3, width: '100%', backgroundColor: '#10b981' },
  similarImageWrapper: { width: '100%', height: 110, position: 'relative', overflow: 'hidden', backgroundColor: '#f1f5f9' },
  similarImage: { width: '100%', height: 110 },
  discountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountText: { color: '#000000', fontSize: 9, fontWeight: '900' },
  localOnlyBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(120, 53, 15, 0.9)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: '85%',
  },
  localOnlyText: { color: '#fef3c7', fontSize: 8, fontWeight: '800' },
  inCartBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inCartText: { color: '#ffffff', fontSize: 8, fontWeight: '800' },
  similarInfo: { padding: 10 },
  categoryTag: { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  similarName: { fontSize: 13, fontWeight: '800', fontFamily: 'serif', color: '#0f172a' },
  similarUnit: { fontSize: 10, color: '#64748b', marginTop: 2 },
  priceRow: { marginTop: 4 },
  price: { fontSize: 15, fontWeight: '900', color: '#10b981' },
  originalPrice: { fontSize: 10, color: '#94a3b8', textDecorationLine: 'line-through' },
  stepperAndBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  cartQtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 3,
    paddingVertical: 2,
    flex: 1,
    justifyContent: 'space-between',
  },
  cartQtyControlLight: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  cartQtyControlDark: { backgroundColor: '#0f172a', borderColor: '#1e293b' },
  stepBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  stepBtnText: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  stepQtyText: { fontSize: 11, fontWeight: '800', color: '#0f172a' },
  addBtn: { backgroundColor: '#059669', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  addBtnInCart: { backgroundColor: '#10b981' },
  addBtnText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },

  errorTitle: { fontSize: 18, fontWeight: '800', marginTop: 20 },
  textWhite: { color: '#ffffff' },
  textDark: { color: '#0f172a' },
  textMutedLight: { color: '#64748b' },
  textMutedDark: { color: '#94a3b8' },
});
