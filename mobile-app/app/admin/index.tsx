import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Switch } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useThemeStore } from '../../lib/theme';
import { COLORS } from '../../constants/config';

export default function AdminDashboardScreen() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const queryClient = useQueryClient();
  
  const bg = isDark ? '#000000' : '#f8fafc';
  const cardBg = isDark ? '#0c121e' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : COLORS.text;
  const mutedColor = isDark ? '#94a3b8' : COLORS.textMuted;
  const borderCol = isDark ? 'rgba(16, 185, 129, 0.25)' : '#e2e8f0';

  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'products', label: '📦 Products' },
    { id: 'categories', label: '🏷️ Categories' },
    { id: 'inventory', label: '🌾 Inventory' },
    { id: 'orders', label: '🧾 Orders' },
    { id: 'delivery', label: '🚚 Pincodes' },
    { id: 'customers', label: '👥 Customers' },
    { id: 'reviews', label: '⭐ Reviews' },
    { id: 'settings', label: '⚙️ Settings' }
  ];

  const [activeTab, setActiveTab] = useState(tabs[0].id);

  // Forms State
  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '', categoryId: '' });
  const [newCat, setNewCat] = useState({ name: '', slug: '' });
  const [newPincode, setNewPincode] = useState({ pincode: '', fee: '', etaMinutes: '' });

  // Data Queries
  const { data: orders, isLoading: ordersLoading } = useQuery({ queryKey: ['admin-orders'], queryFn: () => api.get('/api/admin/orders').then(r => r.data), enabled: activeTab === 'orders' || activeTab === 'dashboard' });
  const { data: products, isLoading: productsLoading } = useQuery({ queryKey: ['admin-products'], queryFn: () => api.get('/api/products').then(r => r.data), enabled: activeTab === 'inventory' || activeTab === 'products' || activeTab === 'dashboard' });
  const { data: categories } = useQuery({ queryKey: ['admin-cats'], queryFn: () => api.get('/api/categories').then(r => r.data.categories || r.data), enabled: activeTab === 'categories' });
  const { data: pincodes } = useQuery({ queryKey: ['admin-pincodes'], queryFn: () => api.get('/api/admin/delivery').then(r => r.data), enabled: activeTab === 'delivery' });
  const { data: users } = useQuery({ queryKey: ['admin-users'], queryFn: () => api.get('/api/admin/users').then(r => r.data), enabled: activeTab === 'customers' });
  const { data: reviews } = useQuery({ queryKey: ['admin-reviews'], queryFn: () => api.get('/api/admin/reviews').then(r => r.data), enabled: activeTab === 'reviews' });

  // Mutations
  const updateOrderStatus = useMutation({
    mutationFn: ({ id, status }: { id: number, status: string }) => api.patch(`/api/orders/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
  });

  const adjustStock = useMutation({
    mutationFn: ({ id, changeQty }: { id: number, changeQty: number }) => api.post(`/api/admin/inventory/${id}/adjust`, { changeQty }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] })
  });

  const addProduct = useMutation({
    mutationFn: (data: any) => api.post('/api/products', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-products'] }); setNewProduct({ name: '', price: '', stock: '', categoryId: '' }); Alert.alert('Success', 'Product Added'); }
  });

  const deleteProduct = useMutation({
    mutationFn: (id: number) => api.delete(`/api/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] })
  });

  const addCategory = useMutation({
    mutationFn: (data: any) => api.post('/api/categories', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-cats'] }); setNewCat({ name: '', slug: '' }); Alert.alert('Success', 'Category Added'); }
  });

  const addPincode = useMutation({
    mutationFn: (data: any) => api.post('/api/admin/delivery', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-pincodes'] }); setNewPincode({ pincode: '', fee: '', etaMinutes: '' }); Alert.alert('Success', 'Pincode Added'); }
  });

  const deleteReview = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/reviews/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reviews'] })
  });

  const statuses = ['placed', 'packed', 'out_for_delivery', 'delivered'];
  const statusLabels: Record<string, string> = { 'placed': 'Placed', 'packed': 'Packed', 'out_for_delivery': 'Out for delivery', 'delivered': 'Delivered' };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.navBar, { borderBottomColor: borderCol }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: textColor }]}>Admin Control</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((tab) => (
            <TouchableOpacity key={tab.id} style={[styles.tab, activeTab === tab.id && styles.tabActive]} onPress={() => setActiveTab(tab.id)}>
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'dashboard' && (
          <View style={styles.tabContent}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>Revenue total</Text>
              <Text style={[styles.stockText, { color: textColor }]}>₹{(orders || []).reduce((acc: number, o: any) => acc + (o.total || 0), 0)}</Text>
            </View>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>Active orders count</Text>
              <Text style={[styles.stockText, { color: textColor }]}>{(orders || []).filter((o: any) => o.status !== 'delivered').length}</Text>
            </View>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>Products count</Text>
              <Text style={[styles.stockText, { color: textColor }]}>{(products || []).length}</Text>
            </View>
          </View>
        )}

        {activeTab === 'orders' && (
          <View style={styles.tabContent}>
            {ordersLoading ? <ActivityIndicator size="large" color="#10b981" /> : (orders || []).map((order: any) => (
              <View key={order.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <Text style={[styles.cardTitle, { color: textColor }]}>Order #{order.id}</Text>
                <Text style={[styles.cardSubtitle, { color: mutedColor }]}>{order.customerName || 'Guest'} • ₹{order.total}</Text>
                <View style={styles.statusBadge}><Text style={styles.statusText}>{statusLabels[order.status] || order.status}</Text></View>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => {
                    const nextIdx = statuses.indexOf(order.status) + 1;
                    if (nextIdx < statuses.length) updateOrderStatus.mutate({ id: order.id, status: statuses[nextIdx] });
                  }}>
                    <Text style={styles.actionBtnText}>Advance Status →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'inventory' && (
          <View style={styles.tabContent}>
            {productsLoading ? <ActivityIndicator size="large" color="#10b981" /> : (products || []).map((product: any) => (
              <View key={product.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <Text style={[styles.cardTitle, { color: textColor }]}>{product.name}</Text>
                <Text style={[styles.stockText, { color: product.stock < 20 ? '#ef4444' : textColor }]}>
                  {product.stock} units remaining {product.stock < 20 && '⚠️'}
                </Text>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.outlineBtn} onPress={() => adjustStock.mutate({ id: product.id, changeQty: -10 })}><Text style={[styles.outlineBtnText, { color: textColor }]}>-10</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.outlineBtn} onPress={() => adjustStock.mutate({ id: product.id, changeQty: 10 })}><Text style={[styles.outlineBtnText, { color: textColor }]}>+10</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'products' && (
          <View style={styles.tabContent}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>Add New Product</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Product Name" value={newProduct.name} onChangeText={(t) => setNewProduct(prev => ({...prev, name: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Price" keyboardType="numeric" value={newProduct.price} onChangeText={(t) => setNewProduct(prev => ({...prev, price: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Initial Stock" keyboardType="numeric" value={newProduct.stock} onChangeText={(t) => setNewProduct(prev => ({...prev, stock: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Category ID" keyboardType="numeric" value={newProduct.categoryId} onChangeText={(t) => setNewProduct(prev => ({...prev, categoryId: t}))} />
              <TouchableOpacity style={styles.actionBtn} onPress={() => addProduct.mutate({ name: newProduct.name, price: newProduct.price, stock: parseInt(newProduct.stock), categoryId: parseInt(newProduct.categoryId), unit: '1 Kg', discountPercent: '0' })}>
                <Text style={styles.actionBtnText}>Add Product</Text>
              </TouchableOpacity>
            </View>
            {(products || []).map((product: any) => (
              <View key={product.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View>
                  <Text style={[styles.cardTitle, { color: textColor, fontSize: 16 }]}>{product.name}</Text>
                  <Text style={{ color: mutedColor }}>₹{product.price} • Stock: {product.stock}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteProduct.mutate(product.id)}>
                  <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'categories' && (
          <View style={styles.tabContent}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>Add Category</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Category Name" value={newCat.name} onChangeText={(t) => setNewCat(prev => ({...prev, name: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Slug (e.g. fresh-fruits)" value={newCat.slug} onChangeText={(t) => setNewCat(prev => ({...prev, slug: t}))} />
              <TouchableOpacity style={styles.actionBtn} onPress={() => addCategory.mutate({ name: newCat.name, slug: newCat.slug })}>
                <Text style={styles.actionBtnText}>Add Category</Text>
              </TouchableOpacity>
            </View>
            {(categories || []).map((cat: any) => (
              <View key={cat.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <Text style={[styles.cardTitle, { color: textColor, fontSize: 16 }]}>{cat.name}</Text>
                <Text style={{ color: mutedColor }}>/{cat.slug}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'delivery' && (
          <View style={styles.tabContent}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>Add Serviceable Pincode</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Pincode" keyboardType="numeric" value={newPincode.pincode} onChangeText={(t) => setNewPincode(prev => ({...prev, pincode: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Delivery Fee" keyboardType="numeric" value={newPincode.fee} onChangeText={(t) => setNewPincode(prev => ({...prev, fee: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="ETA (minutes)" keyboardType="numeric" value={newPincode.etaMinutes} onChangeText={(t) => setNewPincode(prev => ({...prev, etaMinutes: t}))} />
              <TouchableOpacity style={styles.actionBtn} onPress={() => addPincode.mutate({ pincode: newPincode.pincode, fee: parseInt(newPincode.fee||'0'), etaMinutes: parseInt(newPincode.etaMinutes||'30') })}>
                <Text style={styles.actionBtnText}>Add Pincode</Text>
              </TouchableOpacity>
            </View>
            {(pincodes || []).map((p: any) => (
              <View key={p.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <Text style={[styles.cardTitle, { color: textColor, fontSize: 16 }]}>PIN: {p.pincode}</Text>
                <Text style={{ color: mutedColor }}>Fee: ₹{p.fee} • ETA: {p.etaMinutes}m</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'customers' && (
          <View style={styles.tabContent}>
            {(users || []).map((u: any) => (
              <View key={u.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <Text style={[styles.cardTitle, { color: textColor, fontSize: 16 }]}>{u.username}</Text>
                <Text style={{ color: mutedColor }}>Role: {u.role}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'reviews' && (
          <View style={styles.tabContent}>
            {(reviews || []).map((r: any) => (
              <View key={r.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <Text style={[styles.cardTitle, { color: textColor, fontSize: 16 }]}>Product ID: {r.productId}</Text>
                <Text style={{ color: '#f59e0b' }}>{'★'.repeat(r.rating)}</Text>
                <Text style={{ color: textColor }}>{r.comment}</Text>
                <TouchableOpacity style={{ marginTop: 8 }} onPress={() => deleteReview.mutate(r.id)}>
                  <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Delete Review</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'settings' && (
          <View style={styles.tabContent}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <View>
                <Text style={[styles.cardTitle, { color: textColor }]}>Store Lockdown</Text>
                <Text style={{ color: mutedColor, fontSize: 12, marginTop: 4 }}>Disable all new orders</Text>
              </View>
              <Switch value={false} onValueChange={(v) => Alert.alert('Lockdown', 'Lockdown toggled (Mock)')} />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  backBtnText: { color: '#10b981', fontWeight: 'bold', fontSize: 13 },
  navTitle: { fontSize: 18, fontWeight: '700' },
  tabsContainer: { borderBottomWidth: 1, borderBottomColor: 'rgba(16, 185, 129, 0.25)' },
  tabs: { paddingHorizontal: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#10b981' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  tabTextActive: { color: '#10b981', fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  tabContent: { gap: 16, paddingBottom: 40 },
  card: { padding: 20, borderRadius: 16, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 20, fontWeight: '800' },
  cardSubtitle: { fontSize: 14 },
  statusBadge: { backgroundColor: 'rgba(59, 130, 246, 0.15)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'flex-start' },
  statusText: { color: '#3b82f6', fontWeight: '700', fontSize: 16 },
  actionBtn: { backgroundColor: '#10b981', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  stockText: { fontSize: 24, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  outlineBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', padding: 12, borderRadius: 12, alignItems: 'center' },
  outlineBtnText: { fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14 },
});
