import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Switch, Modal, Image } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useThemeStore } from '../../lib/theme';
import { COLORS } from '../../constants/config';

const PRESET_PRODUCT_IMAGES = [
  { label: '🥭 Mango', url: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=500&auto=format&fit=crop&q=80' },
  { label: '🍎 Pomegranate', url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop&q=80' },
  { label: '🍇 Grapes', url: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=500&auto=format&fit=crop&q=80' },
  { label: '🍌 Bananas', url: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=500&auto=format&fit=crop&q=80' },
  { label: '🌶️ Pickles', url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80' },
  { label: '🍯 Ghee / Sweets', url: 'https://images.unsplash.com/photo-1599785209707-a456fc1337cc?w=500&auto=format&fit=crop&q=80' },
  { label: '🥦 Vegetables', url: 'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?w=500&auto=format&fit=crop&q=80' },
];

const STAFF_ROLES = [
  { value: 'custom_subadmin', label: 'Custom Sub-Admin (Pick Menus)' },
  { value: 'warehouse_admin', label: 'Warehouse Admin' },
  { value: 'manager_admin', label: 'Manager Admin' },
  { value: 'delivery_partner', label: 'Delivery Partner / Rider' },
  { value: 'admin', label: 'Full Admin' },
];

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
    { id: 'warehouses', label: '🏢 Warehouses' },
    { id: 'products', label: '📦 Products' },
    { id: 'categories', label: '🏷️ Categories' },
    { id: 'inventory', label: '🌾 Inventory' },
    { id: 'orders', label: '🧾 Orders' },
    { id: 'delivery', label: '🚚 Pincodes' },
    { id: 'staff', label: '🛡️ Sub-Admins & Staff' },
    { id: 'customers', label: '👥 Customers' },
    { id: 'reviews', label: '⭐ Reviews' },
    { id: 'settings', label: '⚙️ Settings' }
  ];

  const [activeTab, setActiveTab] = useState(tabs[0].id);

  // Forms State
  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '', categoryId: '', image: '', unit: '1 Kg', discountPercent: '0' });
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [newCat, setNewCat] = useState({ name: '', slug: '' });
  const [newPincode, setNewPincode] = useState({ pincode: '', fee: '', etaMinutes: '' });
  const [newWarehouse, setNewWarehouse] = useState({ name: '', latitude: '', longitude: '', maxRadiusKm: '', averageSpeedKmph: '', active: true });

  // Sub-Admin / Staff Form State
  const [newStaff, setNewStaff] = useState({ name: '', email: '', phone: '', password: '', role: 'custom_subadmin', customTitle: '' });
  const [selectedPerms, setSelectedPerms] = useState<string[]>(['/admin', '/admin/orders']);

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    freeDeliveryThreshold: '500',
    supportPhone: '+919876543210',
    remoteLockdown: false,
    storeOpen: true,
  });

  // Data Queries
  const { data: orders, isLoading: ordersLoading } = useQuery({ queryKey: ['admin-orders'], queryFn: () => api.get('/api/admin/orders').then(r => r.data), enabled: activeTab === 'orders' || activeTab === 'dashboard' });
  const { data: products, isLoading: productsLoading } = useQuery({ queryKey: ['admin-products'], queryFn: () => api.get('/api/products').then(r => r.data), enabled: activeTab === 'inventory' || activeTab === 'products' || activeTab === 'dashboard' });
  const { data: categories } = useQuery({ queryKey: ['admin-cats'], queryFn: () => api.get('/api/categories').then(r => r.data.categories || r.data), enabled: activeTab === 'categories' || activeTab === 'products' });
  const { data: pincodes } = useQuery({ queryKey: ['admin-pincodes'], queryFn: () => api.get('/api/admin/delivery').then(r => r.data), enabled: activeTab === 'delivery' });
  const { data: users } = useQuery({ queryKey: ['admin-users'], queryFn: () => api.get('/api/admin/users').then(r => r.data), enabled: activeTab === 'customers' });
  const { data: reviews } = useQuery({ queryKey: ['admin-reviews'], queryFn: () => api.get('/api/admin/reviews').then(r => r.data), enabled: activeTab === 'reviews' });
  const { data: warehouses, isLoading: warehousesLoading } = useQuery({ queryKey: ['admin-warehouses'], queryFn: () => api.get('/api/admin/warehouses').then(r => r.data), enabled: activeTab === 'warehouses' });
  const { data: staffData, isLoading: staffLoading } = useQuery({ queryKey: ['admin-staff'], queryFn: () => api.get('/api/admin/staff').then(r => r.data), enabled: activeTab === 'staff' });

  const staffList = staffData?.staff || staffData || [];

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setNewProduct({ name: '', price: '', stock: '', categoryId: '', image: '', unit: '1 Kg', discountPercent: '0' });
      Alert.alert('Success', '✨ Product Added with Image');
    }
  });

  const updateProduct = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => api.patch(`/api/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setEditingProduct(null);
      Alert.alert('Success', '✨ Product & Image Updated');
    }
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

  const addWarehouse = useMutation({
    mutationFn: (data: any) => api.post('/api/admin/warehouses', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-warehouses'] }); setNewWarehouse({ name: '', latitude: '', longitude: '', maxRadiusKm: '', averageSpeedKmph: '', active: true }); Alert.alert('Success', 'Warehouse Added'); }
  });

  const deleteWarehouse = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/warehouses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-warehouses'] })
  });

  const addStaffMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/admin/staff', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
      setNewStaff({ name: '', email: '', phone: '', password: '', role: 'custom_subadmin', customTitle: '' });
      Alert.alert('Success', '🛡️ Sub-Admin / Staff Member Credentials & Permissions Saved');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Could not add sub-admin');
    }
  });

  const deleteStaffMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/staff/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-staff'] })
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (settings: any) => api.post('/api/admin/settings', settings),
    onSuccess: () => Alert.alert('Success', '⚙️ Platform Settings Saved')
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

        {activeTab === 'warehouses' && (
          <View style={styles.tabContent}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>Add New Warehouse</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Name" value={newWarehouse.name} onChangeText={(t) => setNewWarehouse(prev => ({...prev, name: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Latitude" value={newWarehouse.latitude} onChangeText={(t) => setNewWarehouse(prev => ({...prev, latitude: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Longitude" value={newWarehouse.longitude} onChangeText={(t) => setNewWarehouse(prev => ({...prev, longitude: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Max Radius Km" keyboardType="numeric" value={newWarehouse.maxRadiusKm} onChangeText={(t) => setNewWarehouse(prev => ({...prev, maxRadiusKm: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Avg Speed Kmph" keyboardType="numeric" value={newWarehouse.averageSpeedKmph} onChangeText={(t) => setNewWarehouse(prev => ({...prev, averageSpeedKmph: t}))} />
              <TouchableOpacity style={styles.actionBtn} onPress={() => addWarehouse.mutate({ name: newWarehouse.name, latitude: newWarehouse.latitude, longitude: newWarehouse.longitude, maxRadiusKm: newWarehouse.maxRadiusKm, averageSpeedKmph: newWarehouse.averageSpeedKmph, active: newWarehouse.active })}>
                <Text style={styles.actionBtnText}>Add Warehouse</Text>
              </TouchableOpacity>
            </View>
            {warehousesLoading ? <ActivityIndicator size="large" color="#10b981" /> : (warehouses || []).map((w: any) => (
              <View key={w.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View>
                  <Text style={[styles.cardTitle, { color: textColor, fontSize: 16 }]}>{w.name}</Text>
                  <Text style={{ color: mutedColor }}>Lat: {w.latitude} • Lng: {w.longitude} • Radius: {w.maxRadiusKm || '30'}km • Speed: {w.averageSpeedKmph}kmph</Text>
                  <Text style={{ color: w.active ? '#10b981' : '#ef4444' }}>{w.active ? 'Active' : 'Inactive'}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteWarehouse.mutate(w.id)}>
                  <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}
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

        {/* ── 📦 PRODUCTS TAB (WITH IMAGE UPLOADER & PRESETS) ───────────────────── */}
        {activeTab === 'products' && (
          <View style={styles.tabContent}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>Add New Product</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Product Name *" value={newProduct.name} onChangeText={(t) => setNewProduct(prev => ({...prev, name: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Price (₹) *" keyboardType="numeric" value={newProduct.price} onChangeText={(t) => setNewProduct(prev => ({...prev, price: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Initial Stock *" keyboardType="numeric" value={newProduct.stock} onChangeText={(t) => setNewProduct(prev => ({...prev, stock: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Unit (e.g. 1 Kg, 500 Grams)" value={newProduct.unit} onChangeText={(t) => setNewProduct(prev => ({...prev, unit: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Category ID (optional)" keyboardType="numeric" value={newProduct.categoryId} onChangeText={(t) => setNewProduct(prev => ({...prev, categoryId: t}))} />
              
              {/* IMAGE URL INPUT + PRESETS */}
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: mutedColor, marginTop: 4 }}>🖼️ Product Image URL:</Text>
              <TextInput
                style={[styles.input, { color: textColor, borderColor: borderCol }]}
                placeholderTextColor={mutedColor}
                placeholder="https://example.com/product-image.jpg"
                value={newProduct.image}
                onChangeText={(t) => setNewProduct(prev => ({...prev, image: t}))}
              />
              
              <Text style={{ fontSize: 11, fontWeight: '600', color: mutedColor }}>Quick Preset Image Picker:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {PRESET_PRODUCT_IMAGES.map((preset, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={{ backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}
                    onPress={() => setNewProduct(prev => ({ ...prev, image: preset.url }))}
                  >
                    <Text style={{ color: '#10b981', fontSize: 11, fontWeight: 'bold' }}>{preset.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {newProduct.image ? (
                <View style={{ alignItems: 'center', marginTop: 8 }}>
                  <Image source={{ uri: newProduct.image }} style={{ width: 100, height: 100, borderRadius: 12, borderWidth: 1, borderColor: '#10b981' }} />
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => addProduct.mutate({
                  name: newProduct.name,
                  price: newProduct.price,
                  stock: parseInt(newProduct.stock || '0'),
                  categoryId: parseInt(newProduct.categoryId || '1'),
                  unit: newProduct.unit || '1 Kg',
                  discountPercent: newProduct.discountPercent || '0',
                  image: newProduct.image,
                })}
              >
                <Text style={styles.actionBtnText}>Add Product 📦</Text>
              </TouchableOpacity>
            </View>

            {(products || []).map((product: any) => (
              <View key={product.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                {product.image ? (
                  <Image source={{ uri: product.image }} style={{ width: 64, height: 64, borderRadius: 12 }} />
                ) : (
                  <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 24 }}>🌱</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: textColor, fontSize: 16 }]}>{product.name}</Text>
                  <Text style={{ color: mutedColor }}>₹{product.price} • {product.unit} • Stock: {product.stock}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => setEditingProduct(product)}>
                    <Text style={{ color: '#3b82f6', fontWeight: 'bold' }}>✏️ Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteProduct.mutate(product.id)}>
                    <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {editingProduct && (
              <Modal visible transparent animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}>
                  <ScrollView contentContainerStyle={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
                    <Text style={[styles.cardTitle, { color: textColor }]}>Edit Product & Image</Text>
                    <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholder="Name" value={editingProduct.name} onChangeText={t => setEditingProduct({...editingProduct, name: t})} />
                    <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholder="Price" keyboardType="numeric" value={editingProduct.price?.toString()} onChangeText={t => setEditingProduct({...editingProduct, price: t})} />
                    <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholder="Discount %" keyboardType="numeric" value={editingProduct.discountPercent?.toString()} onChangeText={t => setEditingProduct({...editingProduct, discountPercent: t})} />
                    <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholder="Stock" keyboardType="numeric" value={editingProduct.stock?.toString()} onChangeText={t => setEditingProduct({...editingProduct, stock: t})} />
                    <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholder="Unit" value={editingProduct.unit} onChangeText={t => setEditingProduct({...editingProduct, unit: t})} />
                    <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholder="Category ID" keyboardType="numeric" value={editingProduct.categoryId?.toString()} onChangeText={t => setEditingProduct({...editingProduct, categoryId: t})} />
                    
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: mutedColor, marginTop: 4 }}>🖼️ Product Image URL:</Text>
                    <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholder="Image URL" value={editingProduct.image} onChangeText={t => setEditingProduct({...editingProduct, image: t})} />

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {PRESET_PRODUCT_IMAGES.map((preset, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={{ backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}
                          onPress={() => setEditingProduct({ ...editingProduct, image: preset.url })}
                        >
                          <Text style={{ color: '#10b981', fontSize: 11, fontWeight: 'bold' }}>{preset.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => updateProduct.mutate({
                      id: editingProduct.id,
                      data: {
                        name: editingProduct.name,
                        price: editingProduct.price,
                        discountPercent: editingProduct.discountPercent?.toString() || '0',
                        stock: parseInt(editingProduct.stock),
                        unit: editingProduct.unit,
                        categoryId: parseInt(editingProduct.categoryId),
                        image: editingProduct.image,
                      }
                    })}>
                      <Text style={styles.actionBtnText}>💾 Save Product Changes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setEditingProduct(null)}>
                      <Text style={{ color: mutedColor, fontWeight: 'bold' }}>Cancel</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </Modal>
            )}
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

        {/* ── 🛡️ SUB-ADMINS & STAFF MANAGEMENT TAB (MATCHING WEB) ────────────────── */}
        {activeTab === 'staff' && (
          <View style={styles.tabContent}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>➕ Add Sub-Admin / Staff Member</Text>
              <Text style={{ fontSize: 12, color: mutedColor, marginBottom: 8 }}>
                Grant custom sub-admin permissions or create warehouse admins & riders.
              </Text>
              
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Staff Full Name *" value={newStaff.name} onChangeText={(t) => setNewStaff(prev => ({ ...prev, name: t }))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Email Address *" keyboardType="email-address" autoCapitalize="none" value={newStaff.email} onChangeText={(t) => setNewStaff(prev => ({ ...prev, email: t }))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Phone Number *" keyboardType="phone-pad" value={newStaff.phone} onChangeText={(t) => setNewStaff(prev => ({ ...prev, phone: t }))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Initial Password *" secureTextEntry value={newStaff.password} onChangeText={(t) => setNewStaff(prev => ({ ...prev, password: t }))} />
              
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: mutedColor, marginTop: 4 }}>Select Role:</Text>
              <View style={{ gap: 6 }}>
                {STAFF_ROLES.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    style={{
                      padding: 10, borderRadius: 10, borderWidth: 1,
                      backgroundColor: newStaff.role === r.value ? 'rgba(16,185,129,0.2)' : 'transparent',
                      borderColor: newStaff.role === r.value ? '#10b981' : borderCol
                    }}
                    onPress={() => setNewStaff(prev => ({ ...prev, role: r.value }))}
                  >
                    <Text style={{ color: newStaff.role === r.value ? '#10b981' : textColor, fontWeight: 'bold', fontSize: 13 }}>
                      {newStaff.role === r.value ? '✓ ' : ''}{r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => addStaffMutation.mutate({
                  name: newStaff.name,
                  email: newStaff.email,
                  phone: newStaff.phone,
                  password: newStaff.password,
                  role: newStaff.role,
                  customTitle: newStaff.customTitle || 'Sub-Admin',
                  permissions: selectedPerms,
                })}
              >
                <Text style={styles.actionBtnText}>Save Sub-Admin Credentials 🛡️</Text>
              </TouchableOpacity>
            </View>

            {staffLoading ? (
              <ActivityIndicator size="large" color="#10b981" />
            ) : (
              (staffList || []).map((s: any) => (
                <View key={s.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: textColor, fontSize: 16 }]}>🛡️ {s.name || s.username}</Text>
                    <Text style={{ color: mutedColor, fontSize: 12 }}>{s.email} • {s.phone || 'No phone'}</Text>
                    <View style={{ backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 }}>
                      <Text style={{ color: '#10b981', fontSize: 11, fontWeight: 'bold' }}>ROLE: {s.role}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => deleteStaffMutation.mutate(s.id)}>
                    <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Revoke</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'customers' && (
          <View style={styles.tabContent}>
            {(users || []).map((u: any) => (
              <View key={u.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <Text style={[styles.cardTitle, { color: textColor, fontSize: 16 }]}>{u.name || u.username}</Text>
                <Text style={{ color: mutedColor }}>Email: {u.email} • Role: {u.role}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── ⭐ REVIEWS MANAGEMENT TAB (MATCHING WEB) ─────────────────────────── */}
        {activeTab === 'reviews' && (
          <View style={styles.tabContent}>
            <Text style={[styles.cardTitle, { color: textColor }]}>Customer Ratings & Reviews</Text>
            {(reviews || []).map((r: any) => (
              <View key={r.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.cardTitle, { color: textColor, fontSize: 15 }]}>
                    {r.userName || r.customerName || 'Verified Buyer'}
                  </Text>
                  <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: 'bold' }}>{'★'.repeat(r.rating || 5)}</Text>
                </View>
                <Text style={{ color: textColor, fontSize: 14 }}>{r.comment || r.reviewText || 'No written text'}</Text>
                <Text style={{ color: mutedColor, fontSize: 11 }}>Product ID: {r.productId} • Status: {r.status || 'Approved'}</Text>
                <TouchableOpacity style={{ marginTop: 6 }} onPress={() => deleteReview.mutate(r.id)}>
                  <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Delete Review</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ── ⚙️ SETTINGS & PLATFORM CONTROLS TAB (MATCHING WEB) ──────────────── */}
        {activeTab === 'settings' && (
          <View style={styles.tabContent}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>Store & Platform Controls</Text>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 14 }}>Store Status (Open/Close)</Text>
                  <Text style={{ color: mutedColor, fontSize: 12 }}>Accept new orders across app and web</Text>
                </View>
                <Switch
                  value={settingsForm.storeOpen}
                  onValueChange={(v) => setSettingsForm(prev => ({ ...prev, storeOpen: v }))}
                  trackColor={{ false: '#ef4444', true: '#10b981' }}
                />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 14 }}>Emergency Platform Lockdown</Text>
                  <Text style={{ color: mutedColor, fontSize: 12 }}>Block non-admin API routes immediately</Text>
                </View>
                <Switch
                  value={settingsForm.remoteLockdown}
                  onValueChange={(v) => setSettingsForm(prev => ({ ...prev, remoteLockdown: v }))}
                  trackColor={{ false: '#334155', true: '#ef4444' }}
                />
              </View>

              <Text style={{ fontSize: 12, fontWeight: 'bold', color: mutedColor, marginTop: 8 }}>Free Delivery Order Threshold (₹):</Text>
              <TextInput
                style={[styles.input, { color: textColor, borderColor: borderCol }]}
                keyboardType="numeric"
                value={settingsForm.freeDeliveryThreshold}
                onChangeText={(t) => setSettingsForm(prev => ({ ...prev, freeDeliveryThreshold: t }))}
              />

              <Text style={{ fontSize: 12, fontWeight: 'bold', color: mutedColor }}>WhatsApp Support Contact Number:</Text>
              <TextInput
                style={[styles.input, { color: textColor, borderColor: borderCol }]}
                keyboardType="phone-pad"
                value={settingsForm.supportPhone}
                onChangeText={(t) => setSettingsForm(prev => ({ ...prev, supportPhone: t }))}
              />

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => saveSettingsMutation.mutate(settingsForm)}
              >
                <Text style={styles.actionBtnText}>Save Platform Settings ⚙️</Text>
              </TouchableOpacity>
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
