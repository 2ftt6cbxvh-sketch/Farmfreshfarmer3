import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, ActivityIndicator, LayoutAnimation, Modal, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { COLORS, BRAND } from '../../constants/config';
import { useAuth } from '../../lib/store';
import { useThemeStore } from '../../lib/theme';
import { api } from '../../lib/api';

export default function AccountScreen() {
  const { user, setUser, logout } = useAuth();
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();

  const glowAnim = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.45,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);

  useFocusEffect(
    useCallback(() => {
      api.get('/api/me').then(res => {
        if (res.data?.user) {
          setUser(res.data.user);
        }
      }).catch(() => {});
    }, [setUser])
  );

  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState(user?.phone || '');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [activeModal, setActiveModal] = useState<'terms' | 'privacy' | 'refund' | 'shipping' | 'contact' | null>(null);

  // Support Tickets State & Query
  const [showTicketsModal, setShowTicketsModal] = useState(false);
  const [newTicketConcern, setNewTicketConcern] = useState('');
  const [raisingTicket, setRaisingTicket] = useState(false);

  const { data: ticketsData, refetch: refetchTickets, isLoading: ticketsLoading } = useQuery<{ tickets: any[] }>({
    queryKey: ['my-support-tickets', user?.email],
    queryFn: () => api.get(`/api/support-tickets/my?email=${encodeURIComponent(user?.email || '')}`).then(r => r.data),
    enabled: !!user && showTicketsModal,
  });
  const myTickets = ticketsData?.tickets || [];

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
      Alert.alert('🎫 Ticket Submitted', res.data?.message || 'Support Ticket created successfully! Your Grievance Officer will address your concern shortly.');
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
  }>({
    queryKey: ['public-settings'],
    queryFn: () => api.get('/api/settings/public').then(r => r.data),
  });

  const phone = publicSettings?.contact_phone || BRAND.phone;
  const email = publicSettings?.contact_email || BRAND.email;
  const address = publicSettings?.contact_address || 'Vijayawada, Andhra Pradesh';
  const storeName = publicSettings?.store_name || BRAND.name;

  const handleToggleTheme = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    toggleTheme();
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
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

  const bg = isDark ? '#000000' : '#f8fafc';
  const cardBg = isDark ? '#0c121e' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : COLORS.text;
  const mutedColor = isDark ? '#94a3b8' : COLORS.textMuted;
  const borderCol = isDark ? 'rgba(16, 185, 129, 0.25)' : '#e2e8f0';
  const inputBg = isDark ? '#0f172a' : '#f8fafc';

  // ── Not logged in ───────────────────────────────────────────────────────
  if (!user) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.authPrompt}>
          <Text style={styles.authIcon}>👨‍🌾</Text>
          <Text style={[styles.authTitle, { color: textColor }]}>Welcome to {BRAND.name}</Text>
          <Text style={[styles.authText, { color: mutedColor }]}>
            Sign in to track orders, save delivery addresses, earn referral rewards, and manage your subscriptions.
          </Text>
          <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.signInBtnText}>Sign In / Register</Text>
          </TouchableOpacity>
          <View style={styles.actionCardGrid}>
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => router.push('/(tabs)/orders')}>
              <Text style={styles.actionCardIcon}>📦</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionCardTitle, { color: textColor }]}>Track Orders</Text>
                <Text style={[styles.actionCardSub, { color: mutedColor }]}>View live ETA & past orders</Text>
              </View>
              <Text style={styles.chevron}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => router.push('/(tabs)/referrals')}>
              <Text style={styles.actionCardIcon}>🎁</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionCardTitle, { color: textColor }]}>Earn Rewards</Text>
                <Text style={[styles.actionCardSub, { color: mutedColor }]}>Give ₹50, Get 10% Cash</Text>
              </View>
              <Text style={styles.chevron}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => router.push('/(tabs)/subscriptions')}>
              <Text style={styles.actionCardIcon}>🔄</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionCardTitle, { color: textColor }]}>Subscriptions</Text>
                <Text style={[styles.actionCardSub, { color: mutedColor }]}>Weekly organic deliveries</Text>
              </View>
              <Text style={styles.chevron}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => router.push('/(tabs)')}>
              <Text style={styles.actionCardIcon}>🏪</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionCardTitle, { color: textColor }]}>Explore Store</Text>
                <Text style={[styles.actionCardSub, { color: mutedColor }]}>Shop fresh fruits & sweets</Text>
              </View>
              <Text style={styles.chevron}>→</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: mutedColor }]}>Preferences</Text>
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={handleToggleTheme}>
            <Text style={{ fontSize: 20 }}>{isDark ? '🌙' : '☀️'}</Text>
            <Text style={[styles.menuItemText, { color: textColor }]}>Theme: {isDark ? 'Pitch Black OLED' : 'Light Mode'}</Text>
            <Text style={styles.chevron}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {activeModal && (
          <LegalViewerModal
            type={activeModal}
            onClose={() => setActiveModal(null)}
            isDark={isDark}
          />
        )}
      </ScrollView>
    );
  }

  const isAdmin = 
    Boolean(user.isPrimaryAdmin) || 
    Boolean(user.isSubAdmin) || 
    Boolean(user.role && user.role !== 'customer') ||
    (user.role ? ['admin', 'warehouse_admin', 'manager_admin', 'subadmin', 'custom_subadmin', 'customer_rep', 'local_grievance_officer', 'zonal_grievance_officer', 'chief_grievance_officer', 'delivery_partner', 'staff'].includes(user.role) : false) ||
    Boolean(Array.isArray(user.permissions) && user.permissions.length > 0);
  const phoneMissing = !user.phone;

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]}>
      {/* Profile header */}
      <View style={[styles.profileCard, { paddingTop: Math.max(insets.top + 16, 50) }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name ? user.name[0].toUpperCase() : 'F'}</Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        {/* User Role Badge & Glowing Stars */}
        {user && (() => {
          const isSuperAdmin = user.isPrimaryAdmin || user.email?.toLowerCase() === 'admin@farmfreshfarmer.com';
          const starCount = isSuperAdmin
            ? 6
            : Math.min(5, Math.max(1, typeof user.starRating === 'number' ? user.starRating : (Number(user.starRating) || 5)));

          if (isSuperAdmin) {
            return (
              <View style={{ marginVertical: 8, alignItems: 'center' }}>
                <Animated.View style={{ opacity: glowAnim, flexDirection: 'row', gap: 4, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(245, 158, 11, 0.18)', borderWidth: 1.5, borderColor: 'rgba(245, 158, 11, 0.5)', shadowColor: '#f59e0b', shadowRadius: 10, shadowOpacity: 0.5 }}>
                  {Array.from({ length: 6 }, (_, i) => (
                    <Text key={i} style={{ color: '#fbbf24', fontSize: 18, fontWeight: 'bold' }}>★</Text>
                  ))}
                </Animated.View>
                <Text style={{ color: '#fcd34d', fontWeight: '900', fontSize: 11, marginTop: 4 }}>👑 Super Admin (6 Gold Stars)</Text>
              </View>
            );
          }

          if (user.role !== 'customer') {
            return (
              <View style={{ marginVertical: 8, alignItems: 'center' }}>
                <Animated.View style={{ opacity: glowAnim, flexDirection: 'row', gap: 4, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(245, 158, 11, 0.18)', borderWidth: 1.5, borderColor: 'rgba(245, 158, 11, 0.45)', shadowColor: '#f59e0b', shadowRadius: 8, shadowOpacity: 0.4 }}>
                  {Array.from({ length: starCount }, (_, i) => (
                    <Text key={i} style={{ color: '#fbbf24', fontSize: 18, fontWeight: 'bold' }}>★</Text>
                  ))}
                </Animated.View>
                <Text style={{ color: '#6ee7b7', fontWeight: '800', fontSize: 11, marginTop: 4 }}>🛡️ Staff ({starCount} Gold Star{starCount !== 1 ? 's' : ''})</Text>
              </View>
            );
          }

          return (
            <View style={{ marginVertical: 6, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(59,130,246,0.15)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.35)' }}>
              <Text style={{ color: '#60a5fa', fontWeight: '900', fontSize: 14 }}>★ {user.customerStars || 0} Loyalty Star{(user.customerStars || 0) === 1 ? '' : 's'}</Text>
            </View>
          );
        })()}
        {user.email ? <Text style={styles.userEmail}>{user.email}</Text> : null}
        {user.phone ? <Text style={styles.userPhone}>📱 {user.phone}</Text> : (
          <Text style={[styles.userPhone, { color: '#fbbf24' }]}>⚠️ No phone number — add one below</Text>
        )}
      </View>

      {/* Phone missing banner */}
      {phoneMissing && !editingPhone && (
        <TouchableOpacity
          style={styles.warningBanner}
          onPress={() => { setEditingPhone(true); setNewPhone(''); }}
        >
          <Text style={styles.warningBannerText}>📱 Add your phone number to receive order updates →</Text>
        </TouchableOpacity>
      )}

      {/* Phone edit form */}
      {editingPhone && (
        <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: borderCol, margin: 16, marginTop: 0 }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>📱 Phone Number</Text>
          <TextInput
            style={[styles.phoneInput, { backgroundColor: inputBg, borderColor: borderCol, color: textColor }]}
            placeholder="10-digit mobile number"
            placeholderTextColor={mutedColor}
            value={newPhone}
            onChangeText={setNewPhone}
            keyboardType="phone-pad"
            maxLength={10}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={[styles.savePhoneBtn, { flex: 1 }]} onPress={handleSavePhone} disabled={phoneBusy}>
              {phoneBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.savePhoneBtnText}>Save Phone</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelPhoneBtn, { borderColor: borderCol }]} onPress={() => setEditingPhone(false)}>
              <Text style={[styles.cancelPhoneBtnText, { color: mutedColor }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* My Activity */}
      <View style={styles.menuSection}>
        <Text style={[styles.sectionTitle, { color: mutedColor }]}>My Activity</Text>
        <TouchableOpacity style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => router.push('/(tabs)/orders')}>
          <Text style={{ fontSize: 20 }}>📦</Text>
          <Text style={[styles.menuItemText, { color: textColor }]}>My Orders</Text>
          <Text style={styles.chevron}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => router.push('/tickets')}>
          <Text style={{ fontSize: 20 }}>🎫</Text>
          <Text style={[styles.menuItemText, { color: textColor }]}>My Support Tickets</Text>
          <Text style={styles.chevron}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => router.push('/(tabs)/referrals')}>
          <Text style={{ fontSize: 20 }}>🎁</Text>
          <Text style={[styles.menuItemText, { color: textColor }]}>Refer & Earn Rewards</Text>
          <Text style={styles.chevron}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => router.push('/(tabs)/subscriptions')}>
          <Text style={{ fontSize: 20 }}>🔄</Text>
          <Text style={[styles.menuItemText, { color: textColor }]}>My Subscriptions</Text>
          <Text style={styles.chevron}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Preferences */}
      <View style={styles.menuSection}>
        <Text style={[styles.sectionTitle, { color: mutedColor }]}>Preferences</Text>
        <TouchableOpacity style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={handleToggleTheme}>
          <Text style={{ fontSize: 20 }}>{isDark ? '🌙' : '☀️'}</Text>
          <Text style={[styles.menuItemText, { color: textColor }]}>Theme: {isDark ? 'Pitch Black OLED' : 'Light Mode'}</Text>
          <Text style={styles.chevron}>⚙️</Text>
        </TouchableOpacity>
        {!editingPhone && (
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => { setEditingPhone(true); setNewPhone(user.phone || ''); }}>
            <Text style={{ fontSize: 20 }}>📱</Text>
            <Text style={[styles.menuItemText, { color: textColor }]}>Edit Phone Number</Text>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Admin Section */}
      {isAdmin && (
        <View style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: mutedColor }]}>Admin</Text>
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: '#022c22', borderColor: '#065f46' }]} onPress={() => router.push('/admin')}>
            <Text style={{ fontSize: 20 }}>🛡️</Text>
            <Text style={[styles.menuItemText, { color: '#34d399' }]}>Admin Control Dashboard</Text>
            <Text style={[styles.chevron, { color: '#34d399' }]}>→</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Legal */}
      <View style={styles.menuSection}>
        <Text style={[styles.sectionTitle, { color: mutedColor }]}>Legal & Help</Text>
        {[
          { key: 'shipping', label: '🚚 Shipping & Delivery Policy' },
          { key: 'terms', label: '📋 Terms & Conditions' },
          { key: 'privacy', label: '🔒 Privacy Policy' },
          { key: 'refund', label: '↩️ Refund & Cancellation' },
          { key: 'contact', label: '📞 Contact Us & Support' },
        ].map(item => (
          <TouchableOpacity
            key={item.key}
            style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]}
            onPress={() => setActiveModal(item.key as any)}
          >
            <Text style={[styles.menuItemText, { color: textColor, flex: 1 }]}>{item.label}</Text>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contact Info Card */}
      <TouchableOpacity style={[styles.contactCard, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => setActiveModal('contact')}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>📞 Contact Us</Text>
        <Text style={[{ color: mutedColor, fontSize: 13, marginBottom: 4 }]}>📍 {address}</Text>
        <Text style={[{ color: mutedColor, fontSize: 13, marginBottom: 4 }]}>📱 {phone}</Text>
        <Text style={[{ color: mutedColor, fontSize: 13 }]}>✉️ {email}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5', borderColor: 'rgba(16, 185, 129, 0.3)', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 6 }} />
          <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '800' }}>App Build v8.6.8</Text>
        </View>
      </View>
      <Text style={[styles.footer, { color: mutedColor }]}>{storeName} v8.6.8 · {email}</Text>

      {/* Support Tickets Modal */}
      <Modal visible={showTicketsModal} transparent animationType="slide" onRequestClose={() => setShowTicketsModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: isDark ? '#0b1320' : '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 28, padding: 20, maxHeight: '85%', borderWidth: 1, borderColor: borderCol }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingTop: Math.max(insets.top, 10) }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: textColor }}>🎫 My Support Tickets</Text>
              <TouchableOpacity onPress={() => setShowTicketsModal(false)} style={{ padding: 6, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 12 }}>
                <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
              {/* Form to Raise Ticket */}
              <View style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: borderCol }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#10b981', marginBottom: 6 }}>+ Raise New Support Ticket</Text>
                <TextInput
                  style={{ backgroundColor: inputBg, color: textColor, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: borderCol, fontSize: 12, height: 70, marginBottom: 10 }}
                  placeholder="Describe your issue or grievance..."
                  placeholderTextColor={mutedColor}
                  multiline
                  value={newTicketConcern}
                  onChangeText={setNewTicketConcern}
                />
                <TouchableOpacity style={{ backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 10, alignItems: 'center' }} onPress={handleRaiseTicket} disabled={raisingTicket}>
                  {raisingTicket ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Submit Ticket to Grievance Team</Text>}
                </TouchableOpacity>
              </View>

              {/* Tickets List */}
              <Text style={{ fontSize: 13, fontWeight: '800', color: mutedColor, marginTop: 10 }}>Your Ticket History ({myTickets.length})</Text>
              {ticketsLoading ? (
                <ActivityIndicator size="small" color="#10b981" style={{ marginVertical: 16 }} />
              ) : myTickets.length === 0 ? (
                <Text style={{ color: mutedColor, fontSize: 12, textAlign: 'center', marginVertical: 16 }}>No support tickets raised yet.</Text>
              ) : (
                myTickets.map((t: any) => {
                  const statusColor = t.status === 'resolved' ? '#34d399' : t.status === 'in_progress' ? '#fbbf24' : '#60a5fa';
                  const statusBg = t.status === 'resolved' ? 'rgba(52, 211, 153, 0.15)' : t.status === 'in_progress' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(96, 165, 250, 0.15)';
                  return (
                    <View key={t.id || t.ticketId} style={{ backgroundColor: cardBg, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: borderCol, gap: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: textColor }}>{t.ticketId || `TCK-${t.id}`}</Text>
                        <View style={{ backgroundColor: statusBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                          <Text style={{ color: statusColor, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
                            {t.status === 'resolved' ? '🟢 Resolved' : t.status === 'in_progress' ? '🟡 In Progress' : '🔵 Open'}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: textColor, fontSize: 12, marginTop: 4 }}>{t.concern}</Text>
                      {t.adminNotes && (
                        <View style={{ backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5', padding: 8, borderRadius: 8, marginTop: 4 }}>
                          <Text style={{ color: '#10b981', fontSize: 11, fontWeight: 'bold' }}>Resolution Note:</Text>
                          <Text style={{ color: textColor, fontSize: 11 }}>{t.adminNotes}</Text>
                        </View>
                      )}
                      <Text style={{ color: mutedColor, fontSize: 10, marginTop: 2 }}>Raised: {new Date(t.createdAt).toLocaleDateString()}</Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Interactive Legal Policy Modal */}
      {activeModal && (
        <LegalViewerModal
          type={activeModal}
          onClose={() => setActiveModal(null)}
          isDark={isDark}
        />
      )}
    </ScrollView>
  );
}

function LegalViewerModal({ type, onClose, isDark }: { type: 'terms' | 'privacy' | 'refund' | 'shipping' | 'contact'; onClose: () => void; isDark: boolean }) {
  const bg = isDark ? '#090d16' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';
  const cardBg = isDark ? '#0f172a' : '#f1f5f9';
  const borderCol = isDark ? 'rgba(16, 185, 129, 0.3)' : '#cbd5e1';

  const { data: publicSettings } = useQuery<{
    contact_phone?: string;
    contact_email?: string;
    contact_address?: string;
    operating_hours?: string;
    return_window_hours?: string;
    shipping_policy_custom_notes?: string;
    store_name?: string;
  }>({
    queryKey: ['public-settings'],
    queryFn: () => api.get('/api/settings/public').then(r => r.data),
  });

  const phone = publicSettings?.contact_phone || BRAND.phone;
  const email = publicSettings?.contact_email || BRAND.email;
  const address = publicSettings?.contact_address || 'Vijayawada, Andhra Pradesh, India';
  const hours = publicSettings?.operating_hours || 'Monday to Sunday: 6:00 AM – 10:00 PM IST';
  const returnHours = publicSettings?.return_window_hours || '4';
  const customNotes = publicSettings?.shipping_policy_custom_notes;
  const storeName = publicSettings?.store_name || BRAND.name;

  const titles: Record<string, string> = {
    shipping: '🚚 Shipping & Delivery Policy',
    terms: '📋 Terms & Conditions',
    privacy: '🔒 Privacy Policy',
    refund: '↩️ Refund & Cancellation Policy',
    contact: '📞 Contact Us & Customer Support',
  };

  return (
    <Modal animationType="slide" transparent={false} visible={true} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bg, paddingTop: 48 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: borderCol }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: textColor }}>{titles[type]}</Text>
            <Text style={{ fontSize: 11, color: mutedColor, marginTop: 2 }}>Last updated: 07 July 2026 · {storeName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: cardBg, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: textColor }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={{ flex: 1, padding: 20 }}>
          {type === 'shipping' && (
            <View style={{ gap: 16, paddingBottom: 40 }}>
              <Text style={{ fontSize: 14, color: textColor, lineHeight: 22 }}>
                {storeName} operates a hyper-local instant farm-to-home delivery network alongside national express courier shipping and international air freight.
              </Text>

              <View style={{ backgroundColor: cardBg, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: borderCol }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.primary, marginBottom: 6 }}>1. Service Areas & Locations</Text>
                <Text style={{ fontSize: 13, color: textColor, lineHeight: 20 }}>
                  • <Text style={{ fontWeight: '700' }}>Local Instant Express Cities</Text>: 30-to-60 minute doorstep delivery across <Text style={{ fontWeight: '700', color: '#10b981' }}>Vijayawada, Guntur, Visakhapatnam, and Hyderabad</Text>.{"\n\n"}
                  • <Text style={{ fontWeight: '700' }}>Pan-India Domestic Express Courier</Text>: Servicing 19,000+ PIN codes across all states in India for homemade pickles, sweets, spices, ghee, and namkeens via BlueDart / DTDC / Delhivery (2–4 business days).{"\n\n"}
                  • <Text style={{ fontWeight: '700' }}>International Air Express</Text>: Worldwide shipping to USA, UK, Canada, UAE, Australia, Europe & worldwide via DHL / FedEx Express (4–7 business days).
                </Text>
              </View>

              <View style={{ backgroundColor: cardBg, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: borderCol }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.primary, marginBottom: 6 }}>2. Deliverable Radius & Local Hubs</Text>
                <Text style={{ fontSize: 13, color: textColor, lineHeight: 20 }}>
                  Fresh produce is dispatched directly from neighborhood dark store hubs operating on dynamic deliverable radiuses of <Text style={{ fontWeight: '700' }}>8 km to 25 km</Text>.{"\n\n"}
                  Real-time GPS location and 6-digit PIN code mapping auto-assigns your order to the nearest warehouse hub.
                </Text>
              </View>

              <View style={{ backgroundColor: cardBg, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: borderCol }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.primary, marginBottom: 6 }}>3. Estimated Delivery Timelines (ETAs)</Text>
                <Text style={{ fontSize: 13, color: textColor, lineHeight: 20 }}>
                  • Local Express: <Text style={{ fontWeight: '700' }}>30 to 60 Minutes</Text>{"\n"}
                  • Pan-India Courier: <Text style={{ fontWeight: '700' }}>2 to 4 Business Days</Text>{"\n"}
                  • International Air Cargo: <Text style={{ fontWeight: '700' }}>4 to 7 Business Days</Text>{"\n"}
                  • Weekly Subscriptions: Scheduled morning slots (7:00 AM – 10:00 AM)
                </Text>
              </View>

              <View style={{ backgroundColor: cardBg, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: borderCol }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.primary, marginBottom: 6 }}>4. Delivery Fee Structure</Text>
                <Text style={{ fontSize: 13, color: textColor, lineHeight: 20 }}>
                  • Local Base Delivery Fee: ₹30 – ₹50 per order (Vijayawada ₹30, Guntur ₹40, Vizag ₹45, Hyderabad ₹50).{"\n"}
                  • <Text style={{ fontWeight: '700', color: '#10b981' }}>FREE Delivery Threshold</Text>: FREE delivery on local orders above ₹499.{"\n"}
                  • Domestic Shipping Fee: Weight-tiered flat rate (Up to 1kg: ₹60 flat, 1kg–3kg: ₹90 flat, 3kg–5kg: ₹120 flat). FREE shipping on bulk orders above ₹1,499.{"\n"}
                  • International Shipping Fee: Real-time air cargo rate calculated at checkout based on weight and country.
                </Text>
              </View>

              {!!customNotes && (
                <View style={{ backgroundColor: '#fffbeb', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#fef3c7' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#b45309', marginBottom: 4 }}>5. Special Operational Notes</Text>
                  <Text style={{ fontSize: 13, color: '#92400e', lineHeight: 20 }}>{customNotes}</Text>
                </View>
              )}
            </View>
          )}

          {type === 'terms' && (
            <View style={{ gap: 16, paddingBottom: 40 }}>
              <Text style={{ fontSize: 14, color: textColor, lineHeight: 22 }}>
                Welcome to {storeName}. By placing an order or using our mobile application, you agree to these Terms & Conditions.
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: textColor }}>1. Products & Fresh Produce</Text>
              <Text style={{ fontSize: 13, color: mutedColor, lineHeight: 20 }}>
                We deliver fresh farm produce, fruits, vegetables, sweets, namkeen, and spices. Seasonal availability and minor natural variations in size and weight may occur.
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: textColor }}>2. Secure Online Payments</Text>
              <Text style={{ fontSize: 13, color: mutedColor, lineHeight: 20 }}>
                Online payments are processed securely via PhonePe / UPI / Cards / NetBanking. We do not store banking credentials on our servers.
              </Text>
            </View>
          )}

          {type === 'privacy' && (
            <View style={{ gap: 16, paddingBottom: 40 }}>
              <Text style={{ fontSize: 14, color: textColor, lineHeight: 22 }}>
                {storeName} respects your privacy and is committed to protecting your personal information.
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: textColor }}>1. Data Collection & Security</Text>
              <Text style={{ fontSize: 13, color: mutedColor, lineHeight: 20 }}>
                We collect your delivery address, phone number, and order details strictly to fulfill your orders and provide live ETA updates. Your data is encrypted and never sold to third parties.
              </Text>
            </View>
          )}

          {type === 'refund' && (
            <View style={{ gap: 16, paddingBottom: 40 }}>
              <Text style={{ fontSize: 14, color: textColor, lineHeight: 22 }}>
                Because fresh produce and homemade food items are perishable, returns are restricted to damaged or incorrect items reported within {returnHours} hours of delivery.
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: textColor }}>1. Reporting Issue Window</Text>
              <Text style={{ fontSize: 13, color: mutedColor, lineHeight: 20 }}>
                Damaged or wrong items must be reported with clear photo proof within {returnHours} hours of delivery to {email} or {phone}. Approved refunds are credited to the original payment method in 2–5 business days.
              </Text>
            </View>
          )}

          {type === 'contact' && (
            <View style={{ gap: 16, paddingBottom: 40 }}>
              <View style={{ backgroundColor: cardBg, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: borderCol, gap: 10 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: textColor }}>📍 Main Operational Hub</Text>
                <Text style={{ fontSize: 14, color: textColor }}>{storeName} Headquarters{"\n"}{address}</Text>

                <Text style={{ fontSize: 16, fontWeight: '800', color: textColor, marginTop: 10 }}>📱 Phone & WhatsApp Support</Text>
                <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: '700' }}>{phone}</Text>

                <Text style={{ fontSize: 16, fontWeight: '800', color: textColor, marginTop: 10 }}>✉️ Email Customer Service</Text>
                <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: '700' }}>{email}</Text>

                <Text style={{ fontSize: 16, fontWeight: '800', color: textColor, marginTop: 10 }}>⏱️ Customer Care Operating Hours</Text>
                <Text style={{ fontSize: 13, color: mutedColor }}>{hours}</Text>
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
  profileCard: { backgroundColor: COLORS.primaryDark, padding: 24, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#ffffff' },
  userName: { fontSize: 20, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  userEmail: { fontSize: 13, color: '#86efac', marginBottom: 2 },
  userPhone: { fontSize: 12, color: '#6ee7b7' },

  warningBanner: { backgroundColor: '#78350f', borderRadius: 0, padding: 12, borderBottomWidth: 1, borderColor: '#b45309' },
  warningBannerText: { color: '#fde68a', fontSize: 13, textAlign: 'center', fontWeight: '600' },

  actionCardGrid: { width: '100%', gap: 10, marginTop: 20 },
  actionCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, gap: 12 },
  actionCardIcon: { fontSize: 24 },
  actionCardTitle: { fontSize: 15, fontWeight: '700' },
  actionCardSub: { fontSize: 12, marginTop: 2 },

  sectionCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  phoneInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16, letterSpacing: 1 },
  savePhoneBtn: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 12, alignItems: 'center' },
  savePhoneBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  cancelPhoneBtn: { borderWidth: 1, borderRadius: 10, padding: 12, paddingHorizontal: 16, alignItems: 'center' },
  cancelPhoneBtnText: { fontWeight: '600', fontSize: 14 },

  menuSection: { padding: 16, paddingBottom: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1 },
  menuItemText: { fontSize: 15, fontWeight: '600', flex: 1 },
  chevron: { fontSize: 18, color: COLORS.textMuted },

  contactCard: { margin: 16, borderRadius: 16, padding: 16, borderWidth: 1 },

  logoutBtn: { margin: 16, marginTop: 8, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.error, padding: 14, alignItems: 'center' },
  logoutBtnText: { color: COLORS.error, fontSize: 15, fontWeight: '700' },
  footer: { textAlign: 'center', fontSize: 11, marginBottom: 32, paddingHorizontal: 16 },

  authPrompt: { alignItems: 'center', justifyContent: 'center', padding: 20, paddingTop: 40 },
  authIcon: { fontSize: 64, marginBottom: 16 },
  authTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  authText: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  signInBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, width: '100%', alignItems: 'center', marginBottom: 10 },
  signInBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
