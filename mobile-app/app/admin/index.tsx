import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Switch, Modal, Image } from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
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
  { value: 'admin', label: 'Super Admin' },
];

const ALL_MENU_PERMISSIONS = [
  { href: '/admin', label: 'Dashboard Overview' },
  { href: '/admin/products', label: 'Products Management' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/inventory', label: 'Inventory Stock' },
  { href: '/admin/orders', label: 'Orders & Fulfillment' },
  { href: '/admin/subscriptions', label: 'Subscriptions' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/reviews', label: 'Reviews & Ratings' },
  { href: '/admin/coupons', label: 'Coupons & Promos' },
  { href: '/admin/discounts', label: 'Discounts' },
  { href: '/admin/referrals', label: 'Referrals' },
  { href: '/admin/warehouses', label: 'Warehouses Hubs' },
  { href: '/admin/delivery', label: 'Delivery & Pincodes' },
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
  const [newStaff, setNewStaff] = useState({ name: '', email: '', phone: '', password: '', role: 'custom_subadmin', customTitle: 'Sub-Admin' });
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>(['/admin', '/admin/orders']);

  // Super Admin Password State
  const [currentSuperAdminPass, setCurrentSuperAdminPass] = useState('');
  const [newSuperAdminPass, setNewSuperAdminPass] = useState('');
  const [totpSuperAdminCode, setTotpSuperAdminCode] = useState('');

  // Business Settings State (Matching Web screenshots)
  const [settings, setSettings] = useState<Record<string, any>>({
    enable_first_order_discount: 'true',
    first_order_discount_percent: '10',
    enable_referral_program: 'true',
    referral_discount_percent: '10',
    referrer_reward_percent: '5',
    max_referral_reward_cap_percent: '30',
    subscription_delivery_days: 'Both Saturday & Sunday',
    charge_standard_delivery_fee: 'false',
    standard_delivery_fee: '40',
    free_delivery_threshold: '500',
    enable_per_city_delivery_charges: 'false',
    allow_cod: 'true',
    store_name: 'FarmFreshFarmer',
    store_city: 'Visakhapatnam',
    site_custom_text: 'Fresh from local farms, delivered straight to your doorstep.',
    telegram_chat_id: '1927711332',
    telegram_bot_token: '',
    smtp_host: 'smtp.titan.email',
    smtp_port: '465',
    subadmin_discount_percent: '100',
    subadmin_max_discount_cap: '500',
    subadmin_monthly_purchases: '4',
    partner_discount_percent: '20',
    partner_max_discount_cap: '300',
    partner_monthly_purchases: '6',
    hero_pill_badge: "Vijayawada's #1 Instant Organic Farm Delivery",
    promise_pill_badge: 'Vijayawada Farm to Fork',
    hero_headline: 'Fresh from local farms, delivered straight to your doorstep.',
    promise_title: 'Our Farm-to-Home Promise',
    promise_description: 'Connecting households directly with local organic farms.',
    email_otp_enabled: 'true',
    google_oauth_enabled: 'true',
    resend_api_key: '',
    smtp_username: '',
    smtp_password: '',
  });

  // Fetch Settings on mount
  useEffect(() => {
    api.get('/api/settings').then(res => {
      if (res.data) setSettings(prev => ({ ...prev, ...res.data }));
    }).catch(() => {});
  }, []);

  // Device Image Picker Function
  const handlePickImageFromGallery = async (setImageFn: (url: string) => void) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow photo gallery permissions to upload product images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]?.base64) {
        const dataUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setImageFn(dataUri);
        Alert.alert('Success 🖼️', 'Device image loaded & ready to save!');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open image picker.');
    }
  };

  // Data Queries
  const { data: rawOrders, isLoading: ordersLoading } = useQuery({ queryKey: ['admin-orders'], queryFn: () => api.get('/api/admin/orders').then(r => r.data), enabled: activeTab === 'orders' || activeTab === 'dashboard' });
  const { data: rawProducts, isLoading: productsLoading } = useQuery({ queryKey: ['admin-products'], queryFn: () => api.get('/api/products').then(r => r.data), enabled: activeTab === 'inventory' || activeTab === 'products' || activeTab === 'dashboard' });
  const { data: rawCategories } = useQuery({ queryKey: ['admin-cats'], queryFn: () => api.get('/api/categories').then(r => r.data), enabled: activeTab === 'categories' || activeTab === 'products' });
  const { data: rawPincodes } = useQuery({ queryKey: ['admin-pincodes'], queryFn: () => api.get('/api/admin/delivery').then(r => r.data), enabled: activeTab === 'delivery' });
  const { data: rawUsers } = useQuery({ queryKey: ['admin-users'], queryFn: () => api.get('/api/admin/users').then(r => r.data), enabled: activeTab === 'customers' });
  const { data: rawReviews } = useQuery({ queryKey: ['admin-reviews'], queryFn: () => api.get('/api/admin/reviews').then(r => r.data), enabled: activeTab === 'reviews' });
  const { data: rawWarehouses, isLoading: warehousesLoading } = useQuery({ queryKey: ['admin-warehouses'], queryFn: () => api.get('/api/admin/warehouses').then(r => r.data), enabled: activeTab === 'warehouses' });
  const { data: rawStaffData, isLoading: staffLoading } = useQuery({ queryKey: ['admin-staff'], queryFn: () => api.get('/api/admin/staff').then(r => r.data), enabled: activeTab === 'staff' });

  // Safe Array Extractions (Prevents TypeError: map is not a function)
  const orders: any[] = Array.isArray(rawOrders) ? rawOrders : (rawOrders?.orders || []);
  const products: any[] = Array.isArray(rawProducts) ? rawProducts : (rawProducts?.products || []);
  const categories: any[] = Array.isArray(rawCategories) ? rawCategories : (rawCategories?.categories || []);
  const pincodes: any[] = Array.isArray(rawPincodes) ? rawPincodes : (rawPincodes?.pincodes || rawPincodes?.delivery || []);
  const users: any[] = Array.isArray(rawUsers) ? rawUsers : (rawUsers?.users || rawUsers?.customers || []);
  const reviews: any[] = Array.isArray(rawReviews) ? rawReviews : (rawReviews?.reviews || []);
  const warehouses: any[] = Array.isArray(rawWarehouses) ? rawWarehouses : (rawWarehouses?.warehouses || []);
  const staffList: any[] = Array.isArray(rawStaffData) ? rawStaffData : (rawStaffData?.staff || []);

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
      setNewStaff({ name: '', email: '', phone: '', password: '', role: 'custom_subadmin', customTitle: 'Sub-Admin' });
      Alert.alert('Success', '🛡️ Sub-Admin Credentials & Permissions Saved');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'Could not add sub-admin')
  });

  const updateStaffMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => api.patch(`/api/admin/staff/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
      setEditingStaff(null);
      Alert.alert('Success', '✨ Sub-Admin Credentials & Permissions Updated!');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'Could not update sub-admin')
  });

  const deleteStaffMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/staff/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-staff'] }),
    onError: (err: any) => Alert.alert('Revoke Protected', err.response?.data?.message || 'Super Admin cannot be revoked.')
  });

  const updateSuperAdminPasswordMutation = useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string; totpCode: string }) =>
      api.post('/api/admin/update-password', payload),
    onSuccess: () => {
      setCurrentSuperAdminPass('');
      setNewSuperAdminPass('');
      setTotpSuperAdminCode('');
      Alert.alert('🔑 Password Updated!', 'Super Admin password updated successfully following Current Password & 2FA TOTP verification.');
    },
    onError: (err: any) => Alert.alert('Security Validation Failed', err.response?.data?.message || 'Failed to update password')
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (settingsPayload: any) => api.post('/api/admin/settings', settingsPayload),
    onSuccess: () => Alert.alert('Success ⚙️', 'All Business & Platform Settings Saved Globally')
  });

  const togglePerm = (href: string, currentList: string[], setFn: (list: string[]) => void) => {
    if (currentList.includes(href)) {
      setFn(currentList.filter(p => p !== href));
    } else {
      setFn([...currentList, href]);
    }
  };

  const statuses = ['placed', 'packed', 'out_for_delivery', 'delivered'];
  const statusLabels: Record<string, string> = { 'placed': 'Placed', 'packed': 'Packed', 'out_for_delivery': 'Out for delivery', 'delivered': 'Delivered' };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.navBar, { borderBottomColor: borderCol }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: textColor }]}>Super Admin Control</Text>
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
        {/* ── 📊 DASHBOARD OVERVIEW ────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <View style={styles.tabContent}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>Revenue total</Text>
              <Text style={[styles.stockText, { color: textColor }]}>₹{orders.reduce((acc: number, o: any) => acc + (o.total || 0), 0)}</Text>
            </View>

            {/* SUPER ADMIN PASSWORD UPDATE SECURITY CARD */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>🔐 Super Admin Password Update</Text>
              <Text style={{ fontSize: 12, color: mutedColor }}>
                Requires Current Super Admin Password AND live 6-Digit Authenticator TOTP 2FA code.
              </Text>

              <Text style={{ fontSize: 12, fontWeight: 'bold', color: mutedColor, marginTop: 4 }}>Current (Old) Password *</Text>
              <TextInput
                style={[styles.input, { color: textColor, borderColor: borderCol }]}
                placeholder="Enter Current Super Admin Password"
                placeholderTextColor={mutedColor}
                secureTextEntry
                value={currentSuperAdminPass}
                onChangeText={setCurrentSuperAdminPass}
              />

              <Text style={{ fontSize: 12, fontWeight: 'bold', color: mutedColor, marginTop: 4 }}>New Password (min 6 chars) *</Text>
              <TextInput
                style={[styles.input, { color: textColor, borderColor: borderCol }]}
                placeholder="Enter New Super Admin Password"
                placeholderTextColor={mutedColor}
                secureTextEntry
                value={newSuperAdminPass}
                onChangeText={setNewSuperAdminPass}
              />

              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#10b981', marginTop: 4 }}>🔑 6-Digit Authenticator TOTP 2FA Code *</Text>
              <TextInput
                style={[styles.input, { color: '#10b981', borderColor: '#10b981', fontWeight: '900', letterSpacing: 3, textAlign: 'center', fontSize: 18 }]}
                placeholder="123456"
                placeholderTextColor={mutedColor}
                keyboardType="number-pad"
                maxLength={6}
                value={totpSuperAdminCode}
                onChangeText={setTotpSuperAdminCode}
              />

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  if (!currentSuperAdminPass) { Alert.alert('Validation Error', 'Please enter your Current Super Admin Password'); return; }
                  if (newSuperAdminPass.length < 6) { Alert.alert('Validation Error', 'New password must be at least 6 characters'); return; }
                  if (totpSuperAdminCode.length < 6) { Alert.alert('Validation Error', 'Please enter your 6-digit Authenticator TOTP code'); return; }
                  updateSuperAdminPasswordMutation.mutate({
                    currentPassword: currentSuperAdminPass,
                    newPassword: newSuperAdminPass,
                    totpCode: totpSuperAdminCode,
                  });
                }}
              >
                <Text style={styles.actionBtnText}>Verify TOTP & Update Password 🔑</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>Active orders count</Text>
              <Text style={[styles.stockText, { color: textColor }]}>{orders.filter((o: any) => o.status !== 'delivered').length}</Text>
            </View>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>Products count</Text>
              <Text style={[styles.stockText, { color: textColor }]}>{products.length}</Text>
            </View>
          </View>
        )}

        {/* ── 🏢 WAREHOUSES TAB ──────────────────────────────────────────────── */}
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
            {warehousesLoading ? <ActivityIndicator size="large" color="#10b981" /> : warehouses.map((w: any) => (
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

        {/* ── 🧾 ORDERS TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'orders' && (
          <View style={styles.tabContent}>
            {ordersLoading ? <ActivityIndicator size="large" color="#10b981" /> : orders.map((order: any) => (
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

        {/* ── 🌾 INVENTORY TAB ──────────────────────────────────────────────── */}
        {activeTab === 'inventory' && (
          <View style={styles.tabContent}>
            {productsLoading ? <ActivityIndicator size="large" color="#10b981" /> : products.map((product: any) => (
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

        {/* ── 📦 PRODUCTS TAB (WITH FUNCTIONAL DEVICE IMAGE UPLOADER) ──────────── */}
        {activeTab === 'products' && (
          <View style={styles.tabContent}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>Add New Product</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Product Name *" value={newProduct.name} onChangeText={(t) => setNewProduct(prev => ({...prev, name: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Price (₹) *" keyboardType="numeric" value={newProduct.price} onChangeText={(t) => setNewProduct(prev => ({...prev, price: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Initial Stock *" keyboardType="numeric" value={newProduct.stock} onChangeText={(t) => setNewProduct(prev => ({...prev, stock: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Unit (e.g. 1 Kg, 500 Grams)" value={newProduct.unit} onChangeText={(t) => setNewProduct(prev => ({...prev, unit: t}))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Category ID (optional)" keyboardType="numeric" value={newProduct.categoryId} onChangeText={(t) => setNewProduct(prev => ({...prev, categoryId: t}))} />
              
              {/* FUNCTIONAL DEVICE IMAGE UPLOADER + PRESETS */}
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: mutedColor, marginTop: 4 }}>🖼️ Product Image Source:</Text>
              
              <TouchableOpacity
                style={{ backgroundColor: '#10b981', padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 8 }}
                onPress={() => handlePickImageFromGallery((url) => setNewProduct(prev => ({ ...prev, image: url })))}
              >
                <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>📷 Upload Image from Device Gallery</Text>
              </TouchableOpacity>

              <TextInput
                style={[styles.input, { color: textColor, borderColor: borderCol }]}
                placeholderTextColor={mutedColor}
                placeholder="Or paste image URL (https://...)"
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

            {products.map((product: any) => (
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
                    
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: mutedColor, marginTop: 4 }}>🖼️ Product Image Source:</Text>
                    <TouchableOpacity
                      style={{ backgroundColor: '#10b981', padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 8 }}
                      onPress={() => handlePickImageFromGallery((url) => setEditingProduct({ ...editingProduct, image: url }))}
                    >
                      <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>📷 Upload New Image from Device</Text>
                    </TouchableOpacity>

                    <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholder="Image URL" value={editingProduct.image} onChangeText={t => setEditingProduct({...editingProduct, image: t})} />

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

        {/* ── 🏷️ CATEGORIES TAB ──────────────────────────────────────────────── */}
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
            {categories.map((cat: any) => (
              <View key={cat.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <Text style={[styles.cardTitle, { color: textColor, fontSize: 16 }]}>{cat.name}</Text>
                <Text style={{ color: mutedColor }}>/{cat.slug}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── 🚚 PINCODES TAB ───────────────────────────────────────────────── */}
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
            {pincodes.map((p: any) => (
              <View key={p.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <Text style={[styles.cardTitle, { color: textColor, fontSize: 16 }]}>PIN: {p.pincode}</Text>
                <Text style={{ color: mutedColor }}>Fee: ₹{p.fee} • ETA: {p.etaMinutes}m</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── 🛡️ SUB-ADMINS & STAFF MANAGEMENT TAB ──────────────────────────── */}
        {activeTab === 'staff' && (
          <View style={styles.tabContent}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>➕ Add Sub-Admin / Staff Member</Text>
              
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Staff Full Name *" value={newStaff.name} onChangeText={(t) => setNewStaff(prev => ({ ...prev, name: t }))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Email Address *" keyboardType="email-address" autoCapitalize="none" value={newStaff.email} onChangeText={(t) => setNewStaff(prev => ({ ...prev, email: t }))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Phone Number *" keyboardType="phone-pad" value={newStaff.phone} onChangeText={(t) => setNewStaff(prev => ({ ...prev, phone: t }))} />
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholderTextColor={mutedColor} placeholder="Initial Password *" secureTextEntry value={newStaff.password} onChangeText={(t) => setNewStaff(prev => ({ ...prev, password: t }))} />
              
              {/* CUSTOM SUB-ADMIN TITLE INPUT BOX */}
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: mutedColor, marginTop: 4 }}>Custom Sub-Admin Title / Designation:</Text>
              <TextInput
                style={[styles.input, { color: textColor, borderColor: borderCol }]}
                placeholderTextColor={mutedColor}
                placeholder="e.g. Inventory Manager, Regional Orders Supervisor"
                value={newStaff.customTitle}
                onChangeText={(t) => setNewStaff(prev => ({ ...prev, customTitle: t }))}
              />

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

              <Text style={{ fontSize: 12, fontWeight: 'bold', color: mutedColor, marginTop: 8 }}>Grant Granular Menu Permissions:</Text>
              <View style={{ gap: 6 }}>
                {ALL_MENU_PERMISSIONS.map((perm) => (
                  <TouchableOpacity
                    key={perm.href}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    onPress={() => togglePerm(perm.href, selectedPerms, setSelectedPerms)}
                  >
                    <Text style={{ color: selectedPerms.includes(perm.href) ? '#10b981' : mutedColor, fontSize: 14 }}>
                      {selectedPerms.includes(perm.href) ? '☑️' : '⏹️'}
                    </Text>
                    <Text style={{ color: selectedPerms.includes(perm.href) ? textColor : mutedColor, fontSize: 13 }}>{perm.label}</Text>
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
              staffList.map((s: any) => {
                const isSuperAdmin = s.isPrimaryAdmin || s.role === 'admin' || s.email?.toLowerCase() === 'admin@farmfreshfarmer.com';
                return (
                  <View key={s.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: textColor, fontSize: 16 }]}>
                          {isSuperAdmin ? '👑 Super Admin' : `🛡️ ${s.name}`}
                        </Text>
                        {s.customTitle ? <Text style={{ color: '#10b981', fontSize: 12, fontWeight: 'bold' }}>Title: {s.customTitle}</Text> : null}
                        <Text style={{ color: mutedColor, fontSize: 12 }}>{s.email} • {s.phone || 'No phone'}</Text>
                        <View style={{ backgroundColor: isSuperAdmin ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 }}>
                          <Text style={{ color: isSuperAdmin ? '#f59e0b' : '#10b981', fontSize: 11, fontWeight: 'bold' }}>ROLE: {s.role.toUpperCase()}</Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {!isSuperAdmin && (
                          <TouchableOpacity onPress={() => setEditingStaff(s)}>
                            <Text style={{ color: '#3b82f6', fontWeight: 'bold' }}>✏️ Edit</Text>
                          </TouchableOpacity>
                        )}

                        {isSuperAdmin ? (
                          <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: 'bold' }}>🔒 Super Admin (Protected)</Text>
                        ) : (
                          <TouchableOpacity onPress={() => deleteStaffMutation.mutate(s.id)}>
                            <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Revoke Access</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            )}

            {/* EDIT SUB-ADMIN CREDENTIALS & PERMISSIONS MODAL */}
            {editingStaff && (
              <Modal visible transparent animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 }}>
                  <ScrollView contentContainerStyle={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
                    <Text style={[styles.cardTitle, { color: textColor }]}>Edit Sub-Admin Credentials</Text>
                    
                    <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholder="Full Name" value={editingStaff.name} onChangeText={t => setEditingStaff({...editingStaff, name: t})} />
                    <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholder="Phone Number" keyboardType="phone-pad" value={editingStaff.phone} onChangeText={t => setEditingStaff({...editingStaff, phone: t})} />
                    <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholder="New Password (optional)" secureTextEntry onChangeText={t => setEditingStaff({...editingStaff, password: t})} />
                    <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} placeholder="Custom Sub-Admin Title" value={editingStaff.customTitle} onChangeText={t => setEditingStaff({...editingStaff, customTitle: t})} />

                    <TouchableOpacity style={styles.actionBtn} onPress={() => updateStaffMutation.mutate({
                      id: editingStaff.id,
                      data: {
                        name: editingStaff.name,
                        phone: editingStaff.phone,
                        customTitle: editingStaff.customTitle,
                        password: editingStaff.password,
                        role: editingStaff.role,
                        permissions: editingStaff.permissions || [],
                      }
                    })}>
                      <Text style={styles.actionBtnText}>💾 Update Credentials</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setEditingStaff(null)}>
                      <Text style={{ color: mutedColor, fontWeight: 'bold' }}>Cancel</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </Modal>
            )}
          </View>
        )}

        {activeTab === 'customers' && (
          <View style={styles.tabContent}>
            {users.map((u: any) => (
              <View key={u.id} style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <Text style={[styles.cardTitle, { color: textColor, fontSize: 16 }]}>{u.name || u.username}</Text>
                <Text style={{ color: mutedColor }}>Email: {u.email} • Role: {u.role}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── ⭐ REVIEWS MANAGEMENT TAB ──────────────────────────────────────── */}
        {activeTab === 'reviews' && (
          <View style={styles.tabContent}>
            <Text style={[styles.cardTitle, { color: textColor }]}>Customer Ratings & Reviews</Text>
            {reviews.map((r: any) => (
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

        {/* ── ⚙️ BUSINESS SETTINGS (PERFECT MATCH TO WEB SCREENSHOTS) ─────────── */}
        {activeTab === 'settings' && (
          <View style={styles.tabContent}>
            {/* % DISCOUNTS */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor, fontSize: 18 }]}>% Discounts</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: textColor, fontWeight: 'bold' }}>Enable first-order discount</Text>
                <Switch
                  value={settings.enable_first_order_discount === 'true'}
                  onValueChange={(v) => setSettings(prev => ({ ...prev, enable_first_order_discount: String(v) }))}
                  trackColor={{ false: '#ef4444', true: '#10b981' }}
                />
              </View>
              <Text style={{ fontSize: 12, color: mutedColor }}>First order discount %</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} keyboardType="numeric" value={settings.first_order_discount_percent} onChangeText={t => setSettings(p => ({ ...p, first_order_discount_percent: t }))} />
            </View>

            {/* 🎁 REFERRALS */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor, fontSize: 18 }]}>🎁 Referrals</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: textColor, fontWeight: 'bold' }}>Enable referral program</Text>
                <Switch
                  value={settings.enable_referral_program === 'true'}
                  onValueChange={(v) => setSettings(prev => ({ ...prev, enable_referral_program: String(v) }))}
                  trackColor={{ false: '#ef4444', true: '#10b981' }}
                />
              </View>
              <Text style={{ fontSize: 12, color: mutedColor }}>New customer referral discount %</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} keyboardType="numeric" value={settings.referral_discount_percent} onChangeText={t => setSettings(p => ({ ...p, referral_discount_percent: t }))} />
              
              <Text style={{ fontSize: 12, color: mutedColor }}>Referrer reward %</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} keyboardType="numeric" value={settings.referrer_reward_percent} onChangeText={t => setSettings(p => ({ ...p, referrer_reward_percent: t }))} />
              
              <Text style={{ fontSize: 12, color: mutedColor }}>Max referral reward cap % per order</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} keyboardType="numeric" value={settings.max_referral_reward_cap_percent} onChangeText={t => setSettings(p => ({ ...p, max_referral_reward_cap_percent: t }))} />
            </View>

            {/* 🚚 DELIVERY & PER-CITY CHARGES */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor, fontSize: 18 }]}>🚚 Delivery Configuration</Text>
              <Text style={{ fontSize: 12, color: mutedColor }}>Subscription delivery days</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} value={settings.subscription_delivery_days} onChangeText={t => setSettings(p => ({ ...p, subscription_delivery_days: t }))} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: textColor, fontWeight: 'bold' }}>Charge a standard delivery fee</Text>
                <Switch
                  value={settings.charge_standard_delivery_fee === 'true'}
                  onValueChange={(v) => setSettings(prev => ({ ...prev, charge_standard_delivery_fee: String(v) }))}
                  trackColor={{ false: '#ef4444', true: '#10b981' }}
                />
              </View>

              <Text style={{ fontSize: 12, color: mutedColor }}>Standard delivery fee (₹)</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} keyboardType="numeric" value={settings.standard_delivery_fee} onChangeText={t => setSettings(p => ({ ...p, standard_delivery_fee: t }))} />

              <Text style={{ fontSize: 12, color: mutedColor }}>Standard delivery free above (₹)</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} keyboardType="numeric" value={settings.free_delivery_threshold} onChangeText={t => setSettings(p => ({ ...p, free_delivery_threshold: t }))} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <Text style={{ color: textColor, fontWeight: 'bold' }}>Enable per-city delivery charges</Text>
                <Switch
                  value={settings.enable_per_city_delivery_charges === 'true'}
                  onValueChange={(v) => setSettings(prev => ({ ...prev, enable_per_city_delivery_charges: String(v) }))}
                  trackColor={{ false: '#ef4444', true: '#10b981' }}
                />
              </View>
            </View>

            {/* 💳 PAYMENTS & STORE INFO */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor, fontSize: 18 }]}>💳 Payments & Store Info</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: textColor, fontWeight: 'bold' }}>Allow Cash on Delivery at checkout</Text>
                <Switch
                  value={settings.allow_cod === 'true'}
                  onValueChange={(v) => setSettings(prev => ({ ...prev, allow_cod: String(v) }))}
                  trackColor={{ false: '#ef4444', true: '#10b981' }}
                />
              </View>

              <Text style={{ fontSize: 12, color: mutedColor }}>Store Name</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} value={settings.store_name} onChangeText={t => setSettings(p => ({ ...p, store_name: t }))} />

              <Text style={{ fontSize: 12, color: mutedColor }}>Store City</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} value={settings.store_city} onChangeText={t => setSettings(p => ({ ...p, store_city: t }))} />

              <Text style={{ fontSize: 12, color: mutedColor }}>Telegram Chat ID</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} value={settings.telegram_chat_id} onChangeText={t => setSettings(p => ({ ...p, telegram_chat_id: t }))} />
            </View>

            {/* 🎁 EMPLOYEE & DELIVERY PARTNER PERK DISCOUNTS */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor, fontSize: 18 }]}>🎁 Employee & Partner Perks</Text>
              <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 14 }}>🛡️ Sub-Admin Staff Discounts</Text>
              <Text style={{ fontSize: 12, color: mutedColor }}>Discount Percentage (%)</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} keyboardType="numeric" value={settings.subadmin_discount_percent} onChangeText={t => setSettings(p => ({ ...p, subadmin_discount_percent: t }))} />
              
              <Text style={{ fontSize: 12, color: mutedColor }}>Max Discount Cap per Order (₹)</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} keyboardType="numeric" value={settings.subadmin_max_discount_cap} onChangeText={t => setSettings(p => ({ ...p, subadmin_max_discount_cap: t }))} />

              <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 14, marginTop: 8 }}>🚚 Delivery Partner Perks</Text>
              <Text style={{ fontSize: 12, color: mutedColor }}>Discount Percentage (%)</Text>
              <TextInput style={[styles.input, { color: textColor, borderColor: borderCol }]} keyboardType="numeric" value={settings.partner_discount_percent} onChangeText={t => setSettings(p => ({ ...p, partner_discount_percent: t }))} />
            </View>

            {/* 🔒 CUSTOMER LOGIN & AUTH CONTROLS */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor, fontSize: 18 }]}>🔒 Customer Authentication Controls</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: textColor, fontWeight: 'bold' }}>Email & 6-Digit OTP Login</Text>
                <Switch
                  value={settings.email_otp_enabled === 'true'}
                  onValueChange={(v) => setSettings(prev => ({ ...prev, email_otp_enabled: String(v) }))}
                  trackColor={{ false: '#ef4444', true: '#10b981' }}
                />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <Text style={{ color: textColor, fontWeight: 'bold' }}>Google One-Tap & OAuth Login</Text>
                <Switch
                  value={settings.google_oauth_enabled === 'true'}
                  onValueChange={(v) => setSettings(prev => ({ ...prev, google_oauth_enabled: String(v) }))}
                  trackColor={{ false: '#ef4444', true: '#10b981' }}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => saveSettingsMutation.mutate(settings)}
            >
              <Text style={styles.actionBtnText}>Save All Business Settings ⚙️</Text>
            </TouchableOpacity>
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
