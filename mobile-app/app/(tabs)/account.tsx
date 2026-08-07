import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, BRAND } from '../../constants/config';
import { useThemeStore } from '../../lib/theme';

export default function AccountScreen() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.authPrompt}>
          <Text style={styles.authIcon}>👤</Text>
          <Text style={styles.authTitle}>Sign in to your account</Text>
          <Text style={styles.authText}>Manage orders, subscriptions, and more</Text>
          <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.registerBtn} onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.registerBtnText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || '?'}</Text>
        </View>
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        {user?.phone && <Text style={styles.userPhone}>{user.phone}</Text>}
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>My Account</Text>
        {[
          { label: '📦 My Orders', onPress: () => router.push('/(tabs)/orders') },
          { label: '🔄 Subscriptions', onPress: () => {} },
          { label: '💰 Referral Rewards', onPress: () => {} },
          { label: '📍 Delivery Addresses', onPress: () => {} },
        ].map((item) => (
          <TouchableOpacity key={item.label} style={styles.menuItem} onPress={item.onPress}>
            <Text style={styles.menuItemText}>{item.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Support</Text>
        {[
          { label: '📞 Contact Us', onPress: () => {} },
          { label: '⚖️ Terms & Privacy', onPress: () => {} },
        ].map((item) => (
          <TouchableOpacity key={item.label} style={styles.menuItem} onPress={item.onPress}>
            <Text style={styles.menuItemText}>{item.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>{BRAND.name} v1.0 · {BRAND.email}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? '#000000' : '#f8fafc' },
  profileCard: { backgroundColor: COLORS.primaryDark, padding: 24, alignItems: 'center', paddingTop: 40 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#ffffff' },
  userName: { fontSize: 20, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  userEmail: { fontSize: 13, color: '#86efac' },
  userPhone: { fontSize: 12, color: '#6ee7b7', marginTop: 2 },
  menuSection: { padding: 16, paddingBottom: 0 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: isDark ? '#f8fafc' : COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDark ? '#0c121e' : '#ffffff', padding: 16, borderRadius: 12, marginBottom: 8 },
  menuItemText: { fontSize: 15, color: isDark ? '#f8fafc' : COLORS.text, fontWeight: '500' },
  chevron: { fontSize: 18, color: isDark ? '#f8fafc' : COLORS.textMuted },
  logoutBtn: { margin: 16, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.error, padding: 14, alignItems: 'center' },
  logoutBtnText: { color: COLORS.error, fontSize: 15, fontWeight: '700' },
  footer: { textAlign: 'center', color: isDark ? '#f8fafc' : COLORS.textMuted, fontSize: 11, marginBottom: 32 },
  authPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 80 },
  authIcon: { fontSize: 64, marginBottom: 16 },
  authTitle: { fontSize: 22, fontWeight: '800', color: isDark ? '#f8fafc' : COLORS.text, marginBottom: 8, textAlign: 'center' },
  authText: { fontSize: 14, color: isDark ? '#f8fafc' : COLORS.textMuted, textAlign: 'center', marginBottom: 24 },
  signInBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, width: '100%', alignItems: 'center', marginBottom: 10 },
  signInBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  registerBtn: { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 12, padding: 14, width: '100%', alignItems: 'center' },
  registerBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
});
