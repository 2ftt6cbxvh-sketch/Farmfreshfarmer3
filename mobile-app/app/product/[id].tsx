import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/config';
import type { Product } from '../../lib/types';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: () => api.get(`/api/products/${id}`).then((r) => r.data),
  });

  if (isLoading) return <ActivityIndicator color={COLORS.primary} style={{ flex: 1, marginTop: 80 }} />;
  if (!product) return <View style={styles.container}><Text style={styles.errorText}>Product not found</Text></View>;

  const price = parseFloat(product.price);
  const discount = parseFloat(product.discountPercent);
  const effectivePrice = discount > 0 ? price * (1 - discount / 100) : price;

  return (
    <ScrollView style={styles.container}>
      {product.image ? (
        <Image source={{ uri: product.image }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}><Text style={{ fontSize: 80 }}>🌱</Text></View>
      )}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{product.name}</Text>
          <View style={styles.dietBadge}>
            <Text style={styles.dietDot}>{product.dietTag === 'nonveg' ? '🔴' : '🟢'}</Text>
          </View>
        </View>
        <Text style={styles.unit}>{product.unit}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{effectivePrice.toFixed(0)}</Text>
          {discount > 0 && <>
            <Text style={styles.originalPrice}>₹{price.toFixed(0)}</Text>
            <View style={styles.discountBadge}><Text style={styles.discountText}>{Math.round(discount)}% OFF</Text></View>
          </>}
        </View>
        {product.description ? <Text style={styles.description}>{product.description}</Text> : null}
        <TouchableOpacity style={[styles.addButton, product.stock === 0 && styles.addButtonDisabled]} disabled={product.stock === 0}>
          <Text style={styles.addButtonText}>{product.stock === 0 ? 'Out of Stock' : 'Add to Basket'}</Text>
        </TouchableOpacity>
        {product.stock > 0 && product.stock <= (product.lowStockThreshold || 10) && (
          <Text style={styles.lowStock}>Only {product.stock} left!</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  image: { width: '100%', height: 280 },
  imagePlaceholder: { backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: 22, fontWeight: '800', color: COLORS.text, flex: 1, marginRight: 8 },
  dietBadge: { padding: 4 },
  dietDot: { fontSize: 20 },
  unit: { fontSize: 14, color: COLORS.textMuted, marginTop: 4, marginBottom: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  price: { fontSize: 28, fontWeight: '900', color: COLORS.primary },
  originalPrice: { fontSize: 18, color: COLORS.textMuted, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: '#fef2f2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#fee2e2' },
  discountText: { color: COLORS.error, fontSize: 12, fontWeight: '700' },
  description: { fontSize: 14, color: COLORS.textMuted, lineHeight: 22, marginBottom: 20 },
  addButton: { backgroundColor: COLORS.primary, borderRadius: 14, padding: 18, alignItems: 'center' },
  addButtonDisabled: { backgroundColor: COLORS.textMuted },
  addButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  lowStock: { textAlign: 'center', color: COLORS.error, fontSize: 12, fontWeight: '600', marginTop: 8 },
  errorText: { textAlign: 'center', marginTop: 40, color: COLORS.textMuted, fontSize: 16 },
});
