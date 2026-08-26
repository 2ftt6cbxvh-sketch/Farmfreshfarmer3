import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  LayoutAnimation,
  Modal,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { COLORS, BRAND } from '../../constants/config';
import { useAuth } from '../../lib/store';
import { useThemeStore } from '../../lib/theme';
import { api } from '../../lib/api';

const { width } = Dimensions.get('window');

export default function AccountScreen() {
  const { user, setUser, logout } = useAuth();
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();

  const glowAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.5,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);

  useFocusEffect(
    useCallback(() => {
      api.get('/api/me')
        .then((res) => {
          if (res.data?.user) {
            setUser(res.data.user);
          }
        })
        .catch(() => {});
    }, [setUser])
  );

  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState(user?.phone || '');
  const [phoneBusy, setPhoneBusy] = useState(false);

  // Full Profile Edit Modal State
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editAddress, setEditAddress] = useState(user?.address || '');
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditPhone(user.phone || '');
      setEditAddress(user.address || '');
      setNewPhone(user.phone || '');
    }
  }, [user]);

  const [activeModal, setActiveModal] = useState<'terms' | 'privacy' | 'refund' | 'shipping' | 'contact' | null>(null);

  // Support Tickets State & Query
  const [showTicketsModal, setShowTicketsModal] = useState(false);
  const [newTicketConcern, setNewTicketConcern] = useState('');
  const [raisingTicket, setRaisingTicket] = useState(false);

  const { data: ticketsData, refetch: refetchTickets, isLoading: ticketsLoading } = useQuery<{ tickets: any[] }>({
    queryKey: ['my-support-tickets', user?.email],
    queryFn: () => api.get(`/api/support-tickets/my?email=${encodeURIComponent(user?.email || '')}`).then((r) => r.data),
    enabled: !!user && showTicketsModal,
  });
  const myTickets = ticketsData?.tickets || [];

  const { data: myOrdersData } = useQuery<{ orders: any[] }>({
    queryKey: ['my-orders-count', user?.email],
    queryFn: () => api.get('/api/orders/my').then((r) => r.data).catch(() => ({ orders: [] })),
    enabled: !!user,
  });
  const myOrdersCount = myOrdersData?.orders?.length || 0;

  const { data: referralSummary } = useQuery<{
    availableBalance: number;
    totalReferrals: number;
    successfulReferrals: number;
  }>({
    queryKey: ['referral-summary', user?.email],
    queryFn: () => api.get('/api/referral/summary').then((r) => r.data).catch(() => ({ availableBalance: 0, totalReferrals: 0, successfulReferrals: 0 })),
    enabled: !!user,
  });
  const availableRewardBalance = Number(referralSummary?.availableBalance ?? 0);

  const handleRaiseTicket = async () => {
    if (!newTicketConcern.trim()) {
      Alert.alert('Support Ticket', 'Please describe your concern before submitting.');
      return;
    }
    setRaisingTicket(true);
    try {
      const res = await api.post('/api/support-tickets', {
        customerName: user?.name || 'Customer',
        customerPhone: user?.phone || '',
        customerEmail: user?.email || '',
        concern: newTicketConcern.trim(),
      });
      setNewTicketConcern('');
      refetchTickets();
      Alert.alert(
        '🎫 Ticket Submitted',
        res.data?.message || 'Support Ticket created successfully! Our team will address your concern shortly.'
      );
    } catch (err: any) {
      Alert.alert('Ticket Error', err?.response?.data?.message || 'Could not submit support ticket.');
    } finally {
      setRaisingTicket(false);
    }
  };

  const { data: publicSettings } = useQuery<{
    contact_phone?: string;
    contact_email?: string;
    contact_address?: string;
    store_name?: string;
    operating_hours?: string;
  }>({
    queryKey: ['public-settings'],
    queryFn: () => api.get('/api/settings/public').then((r) => r.data).catch(() => ({})),
  });

  const handleToggleTheme = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    toggleTheme();
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of FarmFreshFarmer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const handleSavePhone = async () => {
    if (!/^[6-9][0-9]{9}$/.test(newPhone.trim())) {
      Alert.alert('Invalid Phone', 'Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setPhoneBusy(true);
    try {
      const res = await api.patch('/api/user/phone', { phone: newPhone.trim() });
      if (res.data?.user) {
        useAuth.getState().setUser(res.data.user);
      }
      setEditingPhone(false);
      Alert.alert('✅ Phone Updated', 'Your phone number has been saved successfully.');
    } catch (err: any) {
      Alert.alert('Update Failed', err?.response?.data?.message || 'Could not update phone number.');
    } finally {
      setPhoneBusy(false);
    }
  };

  const handleSaveFullProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name.');
      return;
    }
    if (editPhone.trim() && !/^[6-9][0-9]{9}$/.test(editPhone.replace(/\s/g, ''))) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setProfileSaving(true);
    try {
      const res = await api.patch('/api/user/profile', {
        name: editName.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim(),
      });
      if (res.data?.user) {
        useAuth.getState().setUser(res.data.user);
      }
      setShowEditProfileModal(false);
      Alert.alert('✅ Profile Updated', 'Your profile details have been saved successfully.');
    } catch (err: any) {
      Alert.alert('Update Failed', err?.response?.data?.message || 'Could not update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const bg = isDark ? '#060a08' : '#f8fafc';
  const cardBg = isDark ? '#0b1612' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';
  const borderCol = isDark ? 'rgba(16, 185, 129, 0.22)' : '#e2e8f0';
  const inputBg = isDark ? '#0f241c' : '#f1f5f9';

  const address = publicSettings?.contact_address || 'Main Harvest Hub, FarmFresh Street, AP, India';
  const phone = publicSettings?.contact_phone || '+91 9849679092';
  const email = publicSettings?.contact_email || 'support@farmfreshfarmer.com';
  const storeName = publicSettings?.store_name || 'FarmFreshFarmer';

  // ── Not Logged In View ───────────────────────────────────────────────────
  if (!user) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: bg }]} contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 40 }}>
        <View style={styles.authPromptCard}>
          <Text style={{ fontSize: 54, marginBottom: 12 }}>👨‍🌾</Text>
          <Text style={[styles.authTitle, { color: textColor }]}>Welcome to {BRAND.name}</Text>
          <Text style={[styles.authSubText, { color: mutedColor }]}>
            Sign in to track orders live, earn referral cash rewards, save addresses, and manage your weekly fresh harvest subscriptions.
          </Text>

          <TouchableOpacity style={styles.primaryAuthBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.primaryAuthBtnText}>Sign In / Create Account 🌿</Text>
          </TouchableOpacity>

          <View style={styles.guestQuickGrid}>
            <TouchableOpacity style={[styles.guestTile, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => router.push('/(tabs)/orders')}>
              <Text style={{ fontSize: 24 }}>📦</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.guestTileTitle, { color: textColor }]}>Track Orders</Text>
                <Text style={[styles.guestTileSub, { color: mutedColor }]}>Live ETA & order updates</Text>
              </View>
              <Text style={styles.chevron}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.guestTile, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => router.push('/(tabs)/referrals')}>
              <Text style={{ fontSize: 24 }}>🎁</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.guestTileTitle, { color: textColor }]}>Earn Rewards</Text>
                <Text style={[styles.guestTileSub, { color: mutedColor }]}>Give ₹50, Get 10% Cash</Text>
              </View>
              <Text style={styles.chevron}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.guestTile, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => router.push('/(tabs)/subscriptions')}>
              <Text style={{ fontSize: 24 }}>🔄</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.guestTileTitle, { color: textColor }]}>Subscriptions</Text>
                <Text style={[styles.guestTileSub, { color: mutedColor }]}>Weekly farm deliveries</Text>
              </View>
              <Text style={styles.chevron}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.guestTile, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => router.push('/(tabs)')}>
              <Text style={{ fontSize: 24 }}>🌿</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.guestTileTitle, { color: textColor }]}>Explore Store</Text>
                <Text style={[styles.guestTileSub, { color: mutedColor }]}>Shop fresh fruits & sweets</Text>
              </View>
              <Text style={styles.chevron}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Theme Switcher Tile */}
          <TouchableOpacity style={[styles.guestTile, { backgroundColor: cardBg, borderColor: borderCol, marginTop: 14 }]} onPress={handleToggleTheme}>
            <Text style={{ fontSize: 22 }}>{isDark ? '🌕' : '☀️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.guestTileTitle, { color: textColor }]}>App Theme</Text>
              <Text style={[styles.guestTileSub, { color: mutedColor }]}>{isDark ? 'Dark Emerald OLED' : 'Light Harvest Mode'}</Text>
            </View>
            <Text style={styles.chevron}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {activeModal && (
          <LegalViewerModal type={activeModal} onClose={() => setActiveModal(null)} isDark={isDark} />
        )}
      </ScrollView>
    );
  }

  // ── Logged In User View ──────────────────────────────────────────────────
  const isAdmin =
    Boolean(user.isPrimaryAdmin) ||
    Boolean(user.isSubAdmin) ||
    Boolean(user.role && user.role !== 'customer') ||
    (user.role
      ? [
          'admin',
          'warehouse_admin',
          'manager_admin',
          'subadmin',
          'custom_subadmin',
          'customer_rep',
          'local_grievance_officer',
          'zonal_grievance_officer',
          'chief_grievance_officer',
          'delivery_partner',
          'staff',
        ].includes(user.role)
      : false) ||
    Boolean(Array.isArray(user.permissions) && user.permissions.length > 0);

  const phoneMissing = !user.phone;

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
      {/* ── 1. Hero Profile Glass Banner ──────────────────────────────────── */}
      <View style={[styles.heroHeaderContainer, { paddingTop: Math.max(insets.top + 16, 48) }]}>
        {/* Glow Halo */}
        <Animated.View
          style={[
            styles.avatarGlowCircle,
            {
              opacity: glowAnim,
              transform: [{ scale: glowAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0.96, 1.05] }) }],
            },
          ]}
        />

        <View style={styles.avatarWrapper}>
          {(user as any).profilePhoto ? (
            <Image
              source={{ uri: (user as any).profilePhoto }}
              style={{ width: '100%', height: '100%', borderRadius: 38 }}
            />
          ) : (
            <Text style={styles.avatarInitial}>{user.name ? user.name[0].toUpperCase() : 'F'}</Text>
          )}
          <View style={styles.onlineDot} />
        </View>

        <Text style={styles.heroNameText}>{user.name}</Text>
        <Text style={styles.heroEmailText}>{user.email}</Text>

        {/* User Role Badge & Star Rating */}
        {(() => {
          const isSuperAdmin = user.isPrimaryAdmin || user.email?.toLowerCase() === 'admin@farmfreshfarmer.com';
          const userStarsVal = (user as any).starRating ?? (user as any).customerStars ?? 5;
          const starCount = isSuperAdmin
            ? 6
            : Math.min(5, Math.max(1, typeof userStarsVal === 'number' ? userStarsVal : Number(userStarsVal) || 5));

          if (isSuperAdmin) {
            return (
              <View style={styles.roleBadgeWrapper}>
                <View style={styles.superAdminStarsRow}>
                  {Array.from({ length: 6 }, (_, i) => (
                    <Text key={i} style={{ color: '#fbbf24', fontSize: 16 }}>★</Text>
                  ))}
                </View>
                <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '900', marginTop: 4 }}>🛡️ Master Admin Control</Text>
              </View>
            );
          }

          const isStaffRole = user.role && user.role !== 'customer';
          return (
            <View style={styles.customerStarsPill}>
              <Text style={{ color: '#34d399', fontWeight: '900', fontSize: 13 }}>
                ⭐ {starCount} {isStaffRole ? 'Staff Star Rating' : 'VIP Loyalty Stars'}
              </Text>
            </View>
          );
        })()}

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 12 }}>
          {/* Phone Pill */}
          <TouchableOpacity
            style={[styles.heroPhonePill, { marginTop: 0 }]}
            onPress={() => {
              setEditingPhone(true);
              setNewPhone(user.phone || '');
            }}
          >
            <Text style={styles.heroPhonePillText}>
              {user.phone ? `📱 ${user.phone}` : '⚠️ Add Phone'}
            </Text>
          </TouchableOpacity>

          {/* Edit Full Profile Button */}
          <TouchableOpacity
            style={styles.heroEditProfileBtn}
            onPress={() => setShowEditProfileModal(true)}
          >
            <Text style={{ color: '#064e3b', fontSize: 12, fontWeight: '800' }}>✏️ Edit Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 2. Quick Activity Metrics Bar ───────────────────────────────── */}
      <View style={styles.metricsBarGrid}>
        <TouchableOpacity
          style={[styles.metricTile, { backgroundColor: cardBg, borderColor: borderCol }]}
          onPress={() => router.push('/(tabs)/orders')}
        >
          <Text style={{ fontSize: 22 }}>📦</Text>
          <Text style={[styles.metricNumber, { color: textColor }]}>{myOrdersCount}</Text>
          <Text style={[styles.metricLabel, { color: mutedColor }]}>My Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.metricTile, { backgroundColor: cardBg, borderColor: borderCol }]}
          onPress={() => setShowTicketsModal(true)}
        >
          <Text style={{ fontSize: 22 }}>🎫</Text>
          <Text style={[styles.metricNumber, { color: textColor }]}>{myTickets.length}</Text>
          <Text style={[styles.metricLabel, { color: mutedColor }]}>Support Tickets</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.metricTile, { backgroundColor: cardBg, borderColor: borderCol }]}
          onPress={() => router.push('/(tabs)/referrals')}
        >
          <Text style={{ fontSize: 22 }}>🎁</Text>
          <Text style={[styles.metricNumber, { color: '#10b981' }]}>
            ₹{availableRewardBalance}
          </Text>
          <Text style={[styles.metricLabel, { color: mutedColor }]}>Cash Rewards</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.metricTile, { backgroundColor: cardBg, borderColor: borderCol }]}
          onPress={() => router.push('/(tabs)/subscriptions')}
        >
          <Text style={{ fontSize: 22 }}>🔄</Text>
          <Text style={[styles.metricNumber, { color: textColor }]}>Fresh</Text>
          <Text style={[styles.metricLabel, { color: mutedColor }]}>Subscriptions</Text>
        </TouchableOpacity>
      </View>

      {/* Phone Missing Alert Banner */}
      {phoneMissing && !editingPhone && (
        <TouchableOpacity
          style={styles.phoneWarningCard}
          onPress={() => {
            setEditingPhone(true);
            setNewPhone('');
          }}
        >
          <Text style={{ fontSize: 20 }}>📱</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fef3c7', fontWeight: '800', fontSize: 13 }}>Add Mobile Number</Text>
            <Text style={{ color: '#fcd34d', fontSize: 11, marginTop: 2 }}>
              Receive instant SMS dispatch tracking & WhatsApp delivery updates
            </Text>
          </View>
          <Text style={{ color: '#fef3c7', fontWeight: '900' }}>Add →</Text>
        </TouchableOpacity>
      )}

      {/* Phone Edit Form */}
      {editingPhone && (
        <View style={[styles.phoneEditBox, { backgroundColor: cardBg, borderColor: borderCol }]}>
          <Text style={[styles.boxTitle, { color: textColor }]}>📱 Update Registered Phone Number</Text>
          <TextInput
            style={[styles.phoneInput, { backgroundColor: inputBg, borderColor: borderCol, color: textColor }]}
            placeholder="10-digit Indian mobile number"
            placeholderTextColor={mutedColor}
            value={newPhone}
            onChangeText={setNewPhone}
            keyboardType="phone-pad"
            maxLength={10}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity style={styles.savePhoneBtn} onPress={handleSavePhone} disabled={phoneBusy}>
              {phoneBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.savePhoneBtnText}>Save Phone</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelPhoneBtn, { borderColor: borderCol }]} onPress={() => setEditingPhone(false)}>
              <Text style={[styles.cancelPhoneBtnText, { color: mutedColor }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── 3. Staff & Admin Special Dashboard Card ─────────────────────── */}
      {isAdmin && (
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionHeading, { color: mutedColor }]}>STAFF & ADMINISTRATIVE PORTAL</Text>
          <TouchableOpacity
            style={[styles.adminBannerTile, { backgroundColor: isDark ? '#1b1204' : '#fffbeb', borderColor: '#f59e0b' }]}
            onPress={() => router.push('/admin')}
          >
            <Text style={{ fontSize: 26 }}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#d97706', fontSize: 15, fontWeight: '900' }}>
                {user?.isPrimaryAdmin ? 'Master Admin Control Panel' : 'Sub-Admin Staff Dashboard'}
              </Text>
              <Text style={{ color: '#b45309', fontSize: 12, marginTop: 2 }}>
                {user?.isPrimaryAdmin
                  ? 'Manage products, orders, delivery rules & staff permissions'
                  : 'Manage sub-admin product reconsiderations, stock & orders'}
              </Text>
            </View>
            <Text style={{ color: '#d97706', fontSize: 18, fontWeight: '900' }}>→</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── 4. My Orders & Activity Section ─────────────────────────────── */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionHeading, { color: mutedColor }]}>MY HARVEST & ORDERS</Text>

        <TouchableOpacity
          style={[styles.menuRowTile, { backgroundColor: cardBg, borderColor: borderCol }]}
          onPress={() => router.push('/(tabs)/orders')}
        >
          <View style={styles.tileIconCircle}><Text style={{ fontSize: 18 }}>📦</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuRowTitle, { color: textColor }]}>My Orders & Order History</Text>
            <Text style={[styles.menuRowSub, { color: mutedColor }]}>Track live delivery ETA & past invoices</Text>
          </View>
          <Text style={styles.chevron}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuRowTile, { backgroundColor: cardBg, borderColor: borderCol }]}
          onPress={() => router.push('/(tabs)/subscriptions')}
        >
          <View style={styles.tileIconCircle}><Text style={{ fontSize: 18 }}>🌾</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuRowTitle, { color: textColor }]}>My Fresh Subscriptions</Text>
            <Text style={[styles.menuRowSub, { color: mutedColor }]}>Manage recurring fruit & vegetable baskets</Text>
          </View>
          <Text style={styles.chevron}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuRowTile, { backgroundColor: cardBg, borderColor: borderCol }]}
          onPress={() => setShowTicketsModal(true)}
        >
          <View style={styles.tileIconCircle}><Text style={{ fontSize: 18 }}>🎫</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuRowTitle, { color: textColor }]}>Customer Support Tickets</Text>
            <Text style={[styles.menuRowSub, { color: mutedColor }]}>Raise & track grievance officer responses</Text>
          </View>
          <Text style={styles.chevron}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuRowTile, { backgroundColor: cardBg, borderColor: borderCol }]}
          onPress={() => router.push('/(tabs)/referrals')}
        >
          <View style={styles.tileIconCircle}><Text style={{ fontSize: 18 }}>🎁</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuRowTitle, { color: textColor }]}>Refer & Earn Rewards</Text>
            <Text style={[styles.menuRowSub, { color: mutedColor }]}>Invite friends, give ₹50, earn cash bonuses</Text>
          </View>
          <Text style={styles.chevron}>→</Text>
        </TouchableOpacity>
      </View>

      {/* ── 5. App Preferences & Customization ────────────────────────────── */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionHeading, { color: mutedColor }]}>PREFERENCES & CUSTOMIZATION</Text>

        <TouchableOpacity
          style={[styles.menuRowTile, { backgroundColor: cardBg, borderColor: borderCol }]}
          onPress={handleToggleTheme}
        >
          <View style={styles.tileIconCircle}><Text style={{ fontSize: 18 }}>{isDark ? '🌕' : '☀️'}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuRowTitle, { color: textColor }]}>App Theme</Text>
            <Text style={[styles.menuRowSub, { color: mutedColor }]}>
              Current: {isDark ? 'Dark Emerald OLED' : 'Light Harvest Mode'}
            </Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#10b981' }}>Switch ⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* ── 6. Legal, Trust & Help Hub ──────────────────────────────────── */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionHeading, { color: mutedColor }]}>LEGAL & TRUST POLICIES</Text>

        {[
          { key: 'shipping', icon: '🚚', label: 'Shipping & Instant Delivery Policy' },
          { key: 'terms', icon: '📋', label: 'Terms & Conditions of Harvest' },
          { key: 'privacy', icon: '🔒', label: 'Privacy Policy & Data Rights' },
          { key: 'refund', icon: '↩️', label: 'Refund & Cancellation Policy' },
          { key: 'contact', icon: '📞', label: 'Contact Us & Head Office' },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.menuRowTile, { backgroundColor: cardBg, borderColor: borderCol }]}
            onPress={() => setActiveModal(item.key as any)}
          >
            <View style={styles.tileIconCircle}><Text style={{ fontSize: 16 }}>{item.icon}</Text></View>
            <Text style={[styles.menuRowTitle, { color: textColor, flex: 1 }]}>{item.label}</Text>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contact Head Office Tile */}
      <TouchableOpacity
        style={[styles.contactHeadOfficeCard, { backgroundColor: cardBg, borderColor: borderCol }]}
        onPress={() => setActiveModal('contact')}
      >
        <Text style={[styles.sectionHeading, { color: textColor, marginBottom: 8 }]}>📞 HEAD OFFICE CONTACT INFO</Text>
        <Text style={{ color: mutedColor, fontSize: 12, marginBottom: 4 }}>📍 {address}</Text>
        <Text style={{ color: mutedColor, fontSize: 12, marginBottom: 4 }}>📱 {phone}</Text>
        <Text style={{ color: mutedColor, fontSize: 12 }}>✉️ {email}</Text>
      </TouchableOpacity>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout}>
        <Text style={styles.signOutBtnText}>Sign Out of FarmFreshFarmer</Text>
      </TouchableOpacity>

      {/* App Build Version Pill */}
      <View style={styles.versionBadgeRow}>
        <View style={styles.versionBadgeInner}>
          <View style={styles.versionBadgeDot} />
          <Text style={styles.versionBadgeText}>App Build v9.2.0</Text>
        </View>
      </View>
      <Text style={[styles.footerText, { color: mutedColor }]}>{storeName} v9.2.0 · {email}</Text>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfileModal} transparent animationType="slide" onRequestClose={() => setShowEditProfileModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: isDark ? '#091510' : '#ffffff', borderColor: borderCol }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalHeaderTitle, { color: textColor }]}>👤 Edit Profile Details</Text>
              <TouchableOpacity onPress={() => setShowEditProfileModal(false)} style={[styles.modalCloseBtn, { backgroundColor: inputBg }]}>
                <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <View style={{ gap: 14, paddingVertical: 8 }}>
                <View>
                  <Text style={[styles.formLabel, { color: textColor, marginBottom: 6 }]}>Full Name</Text>
                  <TextInput
                    style={[styles.ticketInput, { backgroundColor: inputBg, borderColor: borderCol, color: textColor }]}
                    placeholder="Your Full Name"
                    placeholderTextColor={mutedColor}
                    value={editName}
                    onChangeText={setEditName}
                  />
                </View>

                <View>
                  <Text style={[styles.formLabel, { color: textColor, marginBottom: 6 }]}>Email Address (Read-only)</Text>
                  <TextInput
                    style={[styles.ticketInput, { backgroundColor: isDark ? '#08110d' : '#f1f5f9', borderColor: borderCol, color: mutedColor }]}
                    value={user?.email || ''}
                    editable={false}
                  />
                </View>

                <View>
                  <Text style={[styles.formLabel, { color: textColor, marginBottom: 6 }]}>Mobile Phone Number</Text>
                  <TextInput
                    style={[styles.ticketInput, { backgroundColor: inputBg, borderColor: borderCol, color: textColor }]}
                    placeholder="10-digit Indian Mobile Number"
                    placeholderTextColor={mutedColor}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>

                <View>
                  <Text style={[styles.formLabel, { color: textColor, marginBottom: 6 }]}>Delivery Street Address</Text>
                  <TextInput
                    style={[styles.ticketInput, { backgroundColor: inputBg, borderColor: borderCol, color: textColor, minHeight: 65 }]}
                    placeholder="Flat / House No, Street name, Area, City, Pincode"
                    placeholderTextColor={mutedColor}
                    value={editAddress}
                    onChangeText={setEditAddress}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitTicketBtn, { marginTop: 8 }]}
                  onPress={handleSaveFullProfile}
                  disabled={profileSaving}
                >
                  {profileSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitTicketBtnText}>Save Profile Changes 💾</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Support Tickets Modal */}
      <Modal visible={showTicketsModal} transparent animationType="slide" onRequestClose={() => setShowTicketsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: isDark ? '#091510' : '#ffffff', borderColor: borderCol }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalHeaderTitle, { color: textColor }]}>🎫 Customer Support Tickets</Text>
              <TouchableOpacity onPress={() => setShowTicketsModal(false)} style={[styles.modalCloseBtn, { backgroundColor: inputBg }]}>
                <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Submit Ticket Form */}
              <View style={[styles.ticketFormBox, { backgroundColor: inputBg, borderColor: borderCol }]}>
                <Text style={[styles.formLabel, { color: textColor }]}>Submit a New Support Concern</Text>
                <TextInput
                  style={[styles.ticketInput, { backgroundColor: cardBg, borderColor: borderCol, color: textColor }]}
                  placeholder="Describe your issue or order inquiry..."
                  placeholderTextColor={mutedColor}
                  value={newTicketConcern}
                  onChangeText={setNewTicketConcern}
                  multiline
                  numberOfLines={3}
                />
                <TouchableOpacity style={styles.submitTicketBtn} onPress={handleRaiseTicket} disabled={raisingTicket}>
                  {raisingTicket ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitTicketBtnText}>Submit Ticket 🚀</Text>}
                </TouchableOpacity>
              </View>

              {/* My Existing Tickets */}
              <Text style={[styles.sectionHeading, { color: mutedColor, marginTop: 14 }]}>MY SUBMITTED TICKETS ({myTickets.length})</Text>
              {ticketsLoading ? (
                <ActivityIndicator size="small" color="#10b981" style={{ marginVertical: 20 }} />
              ) : myTickets.length === 0 ? (
                <Text style={{ color: mutedColor, textAlign: 'center', marginVertical: 20, fontSize: 13 }}>No support tickets found.</Text>
              ) : (
                myTickets.map((t) => (
                  <View key={t.id} style={[styles.ticketCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#10b981' }}>Ticket #{t.ticketId || t.id}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: t.status === 'resolved' ? '#10b981' : t.status === 'in_progress' ? '#f59e0b' : '#3b82f6' }}>
                        {t.status === 'resolved' ? '🟢 Resolved' : t.status === 'in_progress' ? '🟡 In Progress' : '🔵 Open'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: textColor, marginBottom: 6 }}>{t.concern}</Text>
                    {t.adminResponse && (
                      <View style={[styles.responseBox, { backgroundColor: inputBg }]}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#10b981' }}>Response from Grievance Officer:</Text>
                        <Text style={{ fontSize: 12, color: textColor, marginTop: 2 }}>{t.adminResponse}</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Legal viewer Modal */}
      {activeModal && (
        <LegalViewerModal type={activeModal} onClose={() => setActiveModal(null)} isDark={isDark} />
      )}
    </ScrollView>
  );
}

// ─── Legal Viewer Modal Component ─────────────────────────────────────────────
function LegalViewerModal({ type, onClose, isDark }: { type: 'terms' | 'privacy' | 'refund' | 'shipping' | 'contact'; onClose: () => void; isDark: boolean }) {
  const insets = useSafeAreaInsets();
  const bg = isDark ? '#091510' : '#ffffff';
  const cardBg = isDark ? '#0c221a' : '#f8fafc';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';
  const borderCol = isDark ? 'rgba(52, 211, 153, 0.2)' : '#e2e8f0';

  const titleMap = {
    shipping: '🚚 Shipping & Delivery Policy',
    terms: '📋 Terms & Conditions',
    privacy: '🔒 Privacy Policy',
    refund: '↩️ Refund & Cancellation',
    contact: '📞 Contact Us & Support',
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Math.max(insets.top + 10, 44), paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: borderCol }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: textColor }}>{titleMap[type]}</Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 8, borderRadius: 20 }}>
            <Text style={{ fontSize: 18, color: textColor, fontWeight: '800' }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
          {type === 'shipping' && (
            <View style={{ gap: 14, paddingBottom: 40 }}>
              <Text style={{ fontSize: 14, color: textColor, lineHeight: 22 }}>
                At <Text style={{ fontWeight: '800', color: '#10b981' }}>FarmFreshFarmer</Text>, we ensure express delivery of farm fresh produce, homemade sweets, pickles, and spices.
              </Text>
              <View style={{ backgroundColor: cardBg, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: borderCol }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#10b981', marginBottom: 6 }}>1. Delivery Coverage</Text>
                <Text style={{ fontSize: 13, color: textColor, lineHeight: 20 }}>
                  • Local Express Cities: 30-to-60 minute doorstep delivery across Vijayawada, Guntur, Visakhapatnam, and Hyderabad.{"\n"}
                  • Pan-India Courier: 19,000+ PIN codes via BlueDart / DTDC (2–4 days).{"\n"}
                  • International Air Courier: Worldwide shipping via DHL / FedEx Express (4–7 days).
                </Text>
              </View>
            </View>
          )}

          {type === 'terms' && (
            <View style={{ gap: 14, paddingBottom: 40 }}>
              <Text style={{ fontSize: 14, color: textColor, lineHeight: 22 }}>
                By using our mobile application, you agree to these Terms & Conditions. All produce is sourced directly from certified organic farms.
              </Text>
            </View>
          )}

          {type === 'privacy' && (
            <View style={{ gap: 14, paddingBottom: 40 }}>
              <Text style={{ fontSize: 14, color: textColor, lineHeight: 22 }}>
                FarmFreshFarmer respects your data privacy. Personal information is encrypted and strictly used for order delivery.
              </Text>
            </View>
          )}

          {type === 'refund' && (
            <View style={{ gap: 14, paddingBottom: 40 }}>
              <Text style={{ fontSize: 14, color: textColor, lineHeight: 22 }}>
                For perishable items, reported issues with photo proof within 24 hours of delivery are eligible for instant replacement or refund.
              </Text>
            </View>
          )}

          {type === 'contact' && (
            <View style={{ gap: 14, paddingBottom: 40 }}>
              <View style={{ backgroundColor: cardBg, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: borderCol, gap: 10 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: textColor }}>📍 Main Operational Hub</Text>
                <Text style={{ fontSize: 14, color: textColor }}>FarmFreshFarmer Headquarters, AP, India</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: textColor, marginTop: 10 }}>📱 WhatsApp Support</Text>
                <Text style={{ fontSize: 14, color: '#10b981', fontWeight: '700' }}>+91 9849679092</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Auth Prompt Card for Guests
  authPromptCard: {
    padding: 24,
    alignItems: 'center',
  },
  authTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  authSubText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  primaryAuthBtn: {
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  primaryAuthBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  guestQuickGrid: {
    width: '100%',
    gap: 10,
  },
  guestTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  guestTileTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  guestTileSub: {
    fontSize: 12,
    marginTop: 2,
  },

  // Hero Profile Header
  heroHeaderContainer: {
    backgroundColor: '#062319',
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  avatarGlowCircle: {
    position: 'absolute',
    top: 40,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  avatarWrapper: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#34d399',
    position: 'relative',
    marginBottom: 10,
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#062319',
  },
  heroNameText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 2,
  },
  heroEmailText: {
    fontSize: 13,
    color: '#a7f3d0',
    marginBottom: 10,
  },
  roleBadgeWrapper: {
    alignItems: 'center',
    marginBottom: 10,
  },
  superAdminStarsRow: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  staffStarsRow: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  roleBadgeLabelSuper: {
    color: '#fcd34d',
    fontWeight: '900',
    fontSize: 11,
    marginTop: 4,
  },
  roleBadgeLabelStaff: {
    color: '#6ee7b7',
    fontWeight: '800',
    fontSize: 11,
    marginTop: 4,
  },
  customerStarsPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    marginBottom: 10,
  },
  heroPhonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroPhonePillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  heroEditProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34d399',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#6ee7b7',
  },

  // Activity Metrics Bar Grid
  metricsBarGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: -16,
    marginBottom: 14,
  },
  metricTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  metricNumber: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  // Phone Warning & Edit
  phoneWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#78350f',
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#b45309',
  },
  phoneEditBox: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  boxTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  phoneInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
  },
  savePhoneBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  savePhoneBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  cancelPhoneBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  cancelPhoneBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Sections & Rows
  sectionContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  adminBannerTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  menuRowTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  tileIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRowTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  menuRowSub: {
    fontSize: 11,
    marginTop: 2,
  },
  chevron: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  contactHeadOfficeCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  signOutBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#ef4444',
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '900',
  },
  versionBadgeRow: {
    alignItems: 'center',
    marginBottom: 6,
  },
  versionBadgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  versionBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  versionBadgeText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    marginBottom: 24,
    paddingHorizontal: 16,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContentCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 12,
  },
  ticketFormBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  ticketInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  submitTicketBtn: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  submitTicketBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
  },
  ticketCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  responseBox: {
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },
});
