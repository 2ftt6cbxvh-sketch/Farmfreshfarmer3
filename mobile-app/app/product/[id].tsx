import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, resolveImgUrl } from '../../lib/api';
import { COLORS } from '../../constants/config';
import type { Product } from '../../lib/types';
import { useThemeStore } from '../../lib/theme';
import { useCartStore } from '../../lib/cart';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';
  const queryClient = useQueryClient();
  const addItem = useCartStore((state) => state.addItem);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: () => api.get(`/api/products/${id}`).then((r) => r.data),
  });

  const { data: reviews } = useQuery({
    queryKey: ['reviews', id],
    queryFn: () => api.get(`/api/reviews?productId=${id}`).then((r) => r.data),
  });

  const { data: allProducts } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.get('/api/products').then((r) => r.data),
  });

  const submitReview = useMutation({
    mutationFn: () => api.post(`/api/reviews`, { productId: Number(id), rating: reviewRating, comment: reviewComment }),
    onSuccess: () => {
      Alert.alert('Success', 'Review submitted successfully!');
      setReviewComment('');
      queryClient.invalidateQueries({ queryKey: ['reviews', id] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to submit review. Are you logged in?');
    }
  });

  if (isLoading) return (
    <View style={[styles.container, isDark && styles.containerDark, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={COLORS.primary} size="large" />
    </View>
  );

  if (!product) return (
    <View style={[styles.container, isDark && styles.containerDark, { padding: 20 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>
      <Text style={[styles.errorText, isDark && styles.textDark]}>Product not found</Text>
    </View>
  );

  const price = parseFloat(product.price);
  const discount = parseFloat(product.discountPercent);
  const effectivePrice = discount > 0 ? price * (1 - discount / 100) : price;

  const bg = isDark ? '#000000' : '#ffffff';
  const cardBg = isDark ? '#0c121e' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';
  const borderCol = isDark ? 'rgba(16, 185, 129, 0.3)' : '#e2e8f0';

  const similarProducts = allProducts?.filter(p => p.categoryId === product.categoryId && p.id !== product.id).slice(0, 5) || [];

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
    <ScrollView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.navBar, { borderBottomColor: borderCol }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back to Harvest</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.themeToggleBtn} onPress={toggleTheme}>
          <Text style={{ fontSize: 16 }}>{isDark ? '🌙' : '☀️'}</Text>
        </TouchableOpacity>
      </View>

      {product.image ? (
        <Image source={{ uri: resolveImgUrl(product.image) }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}><Text style={{ fontSize: 80 }}>🌱</Text></View>
      )}

      <View style={[styles.content, { backgroundColor: cardBg, borderColor: borderCol }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.name, { color: textColor }]}>{product.name}</Text>
          <View style={styles.dietBadge}>
            <Text style={styles.dietDot}>{product.dietTag === 'nonveg' ? '🔴' : '🟢'}</Text>
          </View>
        </View>
        <Text style={[styles.unit, { color: mutedColor }]}>{product.unit}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{effectivePrice.toFixed(0)}</Text>
          {discount > 0 && <>
            <Text style={[styles.originalPrice, { color: mutedColor }]}>₹{price.toFixed(0)}</Text>
            <View style={styles.discountBadge}><Text style={styles.discountText}>{Math.round(discount)}% OFF</Text></View>
          </>}
        </View>
        {product.description ? <Text style={[styles.description, { color: mutedColor }]}>{product.description}</Text> : null}

        <TouchableOpacity 
          style={[styles.addButton, product.stock === 0 && styles.addButtonDisabled]} 
          disabled={product.stock === 0}
          onPress={() => {
            addItem(product);
            Alert.alert('Success', 'Added to Basket! 🎉');
          }}
        >
          <Text style={styles.addButtonText}>{product.stock === 0 ? 'Out of Stock' : 'Add to Basket'}</Text>
        </TouchableOpacity>
        {product.stock > 0 && product.stock <= (product.lowStockThreshold || 10) && (
          <Text style={styles.lowStock}>Only {product.stock} left!</Text>
        )}

        <View style={styles.sectionMargin}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Similar Organic Products</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {similarProducts.map((p) => (
              <TouchableOpacity key={p.id} onPress={() => router.push(`/product/${p.id}`)} style={[styles.productCard, { backgroundColor: bg, borderColor: borderCol }]}>
                {p.image ? (
                  <Image source={{ uri: resolveImgUrl(p.image) }} style={styles.productImgReal} resizeMode="cover" />
                ) : (
                  <View style={styles.productImgPlaceholder}><Text style={{fontSize:40}}>🍎</Text></View>
                )}
                {parseFloat(p.discountPercent) > 0 && (
                  <View style={styles.discountPill}><Text style={styles.discountPillText}>{Math.round(parseFloat(p.discountPercent))}% OFF</Text></View>
                )}
                <Text style={[styles.productName, { color: textColor }]} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.productPrice}>₹{(parseFloat(p.price) * (1 - parseFloat(p.discountPercent)/100)).toFixed(0)}</Text>
                <TouchableOpacity 
                  style={styles.smallAddBtn}
                  onPress={() => {
                    addItem(p);
                    Alert.alert('Success', 'Added to Basket! 🎉');
                  }}
                >
                  <Text style={styles.smallAddBtnText}>Add</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionMargin}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Customer Reviews</Text>
          
          <View style={[styles.reviewForm, { backgroundColor: bg, borderColor: borderCol }]}>
            <Text style={[styles.reviewFormTitle, { color: textColor }]}>Write a Review</Text>
            <View style={styles.starsRow}>
              {[1,2,3,4,5].map(s => (
                <TouchableOpacity key={s} onPress={() => setReviewRating(s)}>
                  <Text style={[styles.star, { color: s <= reviewRating ? '#f59e0b' : mutedColor }]}>{s <= reviewRating ? '★' : '☆'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput 
              style={[styles.reviewInput, { color: textColor, borderColor: borderCol, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc' }]} 
              placeholder="What did you like or dislike?"
              placeholderTextColor={mutedColor}
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
            />
            <TouchableOpacity style={styles.submitReviewBtn} onPress={() => submitReview.mutate()} disabled={submitReview.isPending}>
              <Text style={styles.submitReviewBtnText}>{submitReview.isPending ? 'Submitting...' : 'Submit Review'}</Text>
            </TouchableOpacity>
          </View>

          {(reviews || []).map((rev: any) => (
            <View key={rev.id} style={[styles.reviewItem, { borderBottomColor: borderCol }]}>
              <View style={styles.reviewHeader}>
                <Text style={[styles.reviewerName, { color: textColor }]}>{rev.userName || 'Verified Buyer'}</Text>
                <Text style={styles.reviewStars}>{'★'.repeat(rev.rating)}</Text>
              </View>
              {rev.comment ? <Text style={[styles.reviewText, { color: mutedColor }]}>{rev.comment}</Text> : null}
            </View>
          ))}
          {(!reviews || reviews.length === 0) && (
            <Text style={{ color: mutedColor }}>No reviews yet. Be the first to review!</Text>
          )}
        </View>

        <View style={[styles.glassFooter, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,1)' }]}>
          <Text style={[styles.footerText, { color: textColor }]}>Farm Fresh • Instant Delivery</Text>
          <Text style={[styles.footerText, { color: mutedColor, fontSize: 12, marginTop: 4 }]}>Homemade • No Preservatives</Text>
        </View>

        <View style={{ height: 80 }} />
      </View>
    </ScrollView>
    <View style={[styles.bottomBar, { backgroundColor: cardBg, borderTopColor: borderCol }]}>
      <TouchableOpacity style={styles.bottomTab} onPress={() => router.push('/(tabs)')}>
        <Text style={styles.bottomTabIcon}>🏠</Text>
        <Text style={[styles.bottomTabText, { color: textColor }]}>Shop</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.bottomTab} onPress={() => router.push('/(tabs)/basket')}>
        <Text style={styles.bottomTabIcon}>🧺</Text>
        <Text style={[styles.bottomTabText, { color: textColor }]}>Basket</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.bottomTab} onPress={() => router.push('/(tabs)/orders')}>
        <Text style={styles.bottomTabIcon}>🧾</Text>
        <Text style={[styles.bottomTabText, { color: textColor }]}>Orders</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.bottomTab} onPress={() => router.push('/(tabs)/account')}>
        <Text style={styles.bottomTabIcon}>👤</Text>
        <Text style={[styles.bottomTabText, { color: textColor }]}>Account</Text>
      </TouchableOpacity>
    </View>
  </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDark: { backgroundColor: '#000000' },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  backBtnText: { color: '#10b981', fontWeight: 'bold', fontSize: 13 },
  themeToggleBtn: { backgroundColor: 'rgba(255,255,255,0.1)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: 300 },
  imagePlaceholder: { backgroundColor: '#092615', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, borderWidth: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: 24, fontWeight: '800', flex: 1, marginRight: 8 },
  dietBadge: { padding: 4 },
  dietDot: { fontSize: 20 },
  unit: { fontSize: 14, marginTop: 4, marginBottom: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  price: { fontSize: 30, fontWeight: '900', color: '#10b981' },
  originalPrice: { fontSize: 18, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  discountText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
  description: { fontSize: 14, lineHeight: 22, marginBottom: 20 },
  addButton: { backgroundColor: '#10b981', borderRadius: 16, padding: 18, alignItems: 'center', shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  addButtonDisabled: { backgroundColor: '#64748b' },
  addButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  lowStock: { textAlign: 'center', color: '#ef4444', fontSize: 12, fontWeight: '600', marginTop: 8 },
  textDark: { color: '#f8fafc' },
  errorText: { textAlign: 'center', marginTop: 40, fontSize: 16 },
  sectionMargin: { marginTop: 32 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  horizontalScroll: { overflow: 'visible' },
  productCard: { width: 140, padding: 12, borderRadius: 16, borderWidth: 1, marginRight: 16, position: 'relative' },
  productImgPlaceholder: { backgroundColor: 'rgba(16,185,129,0.1)', height: 100, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  productImgReal: { width: '100%', height: 100, borderRadius: 12, marginBottom: 12 },
  discountPill: { position: 'absolute', top: 8, left: 8, backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, zIndex: 1 },
  discountPillText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  productName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  productPrice: { fontSize: 16, fontWeight: '800', color: '#10b981', marginBottom: 12 },
  smallAddBtn: { backgroundColor: '#10b981', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  smallAddBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  reviewForm: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  reviewFormTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  star: { fontSize: 32 },
  reviewInput: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 80, marginBottom: 16, textAlignVertical: 'top' },
  submitReviewBtn: { backgroundColor: '#10b981', padding: 12, borderRadius: 12, alignItems: 'center' },
  submitReviewBtnText: { color: '#fff', fontWeight: '700' },
  reviewItem: { paddingVertical: 16, borderBottomWidth: 1 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  reviewerName: { fontWeight: '700', fontSize: 15 },
  reviewStars: { fontSize: 14, color: '#f59e0b' },
  reviewText: { fontSize: 14, lineHeight: 20 },
  glassFooter: { marginTop: 40, padding: 24, borderRadius: 24, alignItems: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8 },
  footerText: { fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 12, paddingBottom: 24, borderTopWidth: 1, position: 'absolute', bottom: 0, width: '100%' },
  bottomTab: { alignItems: 'center' },
  bottomTabIcon: { fontSize: 24, marginBottom: 4 },
  bottomTabText: { fontSize: 10, fontWeight: '700' },
});
