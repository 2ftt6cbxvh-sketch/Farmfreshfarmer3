import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, ActivityIndicator, LayoutAnimation } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { COLORS, BRAND } from '../../constants/config';
import { useAuth } from '../../lib/store';
import { useThemeStore } from '../../lib/theme';
import { api } from '../../lib/api';

export default function AccountScreen() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();

  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState(user?.phone || '');
  const [phoneBusy, setPhoneBusy] = useState(false);

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
      </ScrollView>
    );
  }

  const isAdmin = user.role === 'admin' || user.role === 'manager_admin' || user.isPrimaryAdmin;
  const phoneMissing = !user.phone;

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]}>
      {/* Profile header */}
      <View style={[styles.profileCard, { paddingTop: Math.max(insets.top + 16, 50) }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name ? user.name[0].toUpperCase() : 'F'}</Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
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
          { label: '📋 Terms & Conditions', path: '/legal/terms' },
          { label: '🔒 Privacy Policy', path: '/legal/privacy' },
          { label: '↩️ Refund & Cancellation', path: '/legal/refund' },
          { label: '🚚 Shipping & Delivery', path: '/legal/shipping' },
        ].map(item => (
          <View key={item.label} style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <Text style={[styles.menuItemText, { color: textColor, flex: 1 }]}>{item.label}</Text>
            <Text style={styles.chevron}>→</Text>
          </View>
        ))}
      </View>

      {/* Contact Info */}
      <View style={[styles.contactCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>📞 Contact Us</Text>
        <Text style={[{ color: mutedColor, fontSize: 13, marginBottom: 4 }]}>📍 Vijayawada, Andhra Pradesh</Text>
        <Text style={[{ color: mutedColor, fontSize: 13, marginBottom: 4 }]}>📱 {BRAND.phone}</Text>
        <Text style={[{ color: mutedColor, fontSize: 13 }]}>✉️ {BRAND.email}</Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={[styles.footer, { color: mutedColor }]}>{BRAND.name} v4.6.0 · {BRAND.email}</Text>
    </ScrollView>
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

  authPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 80 },
  authIcon: { fontSize: 64, marginBottom: 16 },
  authTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  authText: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  signInBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, width: '100%', alignItems: 'center', marginBottom: 10 },
  signInBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
