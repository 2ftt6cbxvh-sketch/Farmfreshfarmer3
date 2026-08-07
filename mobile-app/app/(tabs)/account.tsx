import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, LayoutAnimation } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { COLORS, BRAND } from '../../constants/config';
import { useAuth } from '../../lib/store';
import { useThemeStore } from '../../lib/theme';

export default function AccountScreen() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();

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

  const bg = isDark ? '#000000' : '#f8fafc';
  const cardBg = isDark ? '#0c121e' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : COLORS.text;
  const mutedColor = isDark ? '#94a3b8' : COLORS.textMuted;
  const borderCol = isDark ? 'rgba(16, 185, 129, 0.25)' : '#e2e8f0';

  if (!user) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.authPrompt}>
          <Text style={styles.authIcon}>👨🌾</Text>
          <Text style={[styles.authTitle, { color: textColor }]}>Welcome to {BRAND.name}</Text>
          <Text style={[styles.authText, { color: mutedColor }]}>
            Sign in to track orders, save delivery addresses, and manage your fresh harvest.
          </Text>
          <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.signInBtnText}>Sign In / Register</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.profileCard, { paddingTop: Math.max(insets.top + 16, 50) }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name ? user.name[0].toUpperCase() : 'F'}</Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        {user.email ? <Text style={styles.userEmail}>{user.email}</Text> : null}
        {user.phone ? <Text style={styles.userPhone}>📱 {user.phone}</Text> : null}
      </View>

      <View style={styles.menuSection}>
        <Text style={[styles.sectionTitle, { color: mutedColor }]}>Preferences</Text>
        <TouchableOpacity style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => router.push('/(tabs)/orders')}>
          <Text style={[styles.menuItemText, { color: textColor }]}>📦 My Orders</Text>
          <Text style={styles.chevron}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={handleToggleTheme}>
          <Text style={[styles.menuItemText, { color: textColor }]}>Theme: {isDark ? '🌙 Pitch Black OLED' : '☀️ Light Mode'}</Text>
          <Text style={styles.chevron}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {user.role === 'admin' && (
        <View style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: mutedColor }]}>Admin</Text>
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => router.push('/admin')}>
            <Text style={[styles.menuItemText, { color: textColor }]}>🛡️ Admin Control Dashboard</Text>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={[styles.footer, { color: mutedColor }]}>{BRAND.name} v1.0 · {BRAND.email}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileCard: { backgroundColor: COLORS.primaryDark, padding: 24, alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#ffffff' },
  userName: { fontSize: 20, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  userEmail: { fontSize: 13, color: '#86efac' },
  userPhone: { fontSize: 12, color: '#6ee7b7', marginTop: 2 },
  menuSection: { padding: 16, paddingBottom: 0 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1 },
  menuItemText: { fontSize: 15, fontWeight: '500' },
  chevron: { fontSize: 18 },
  logoutBtn: { margin: 16, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.error, padding: 14, alignItems: 'center' },
  logoutBtnText: { color: COLORS.error, fontSize: 15, fontWeight: '700' },
  footer: { textAlign: 'center', fontSize: 11, marginBottom: 32 },
  authPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 80 },
  authIcon: { fontSize: 64, marginBottom: 16 },
  authTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  authText: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  signInBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, width: '100%', alignItems: 'center', marginBottom: 10 },
  signInBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
