import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useAuth as useStoreAuth } from '../../lib/store';
import { tokenStorage } from '../../lib/storage';
import { useThemeStore } from '../../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, BRAND } from '../../constants/config';
import { api } from '../../lib/api';

export default function RegisterScreen() {
  const { register } = useAuth();
  const { setUser } = useStoreAuth();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/google', { idToken: 'demo_google_id_token', platform: 'mobile' });
      if (res.data?.accessToken) await tokenStorage.saveAccessToken(res.data.accessToken);
      if (res.data?.refreshToken) await tokenStorage.saveRefreshToken(res.data.refreshToken);
      setUser(res.data.user || res.data);
      Alert.alert('Success', `Welcome back, ${res.data.user?.name || 'Customer'}! 🎉`);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', 'Google Sign-In failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name || !email || !password) { Alert.alert('Error', 'Please fill all required fields'); return; }
    if (password.length < 8) { Alert.alert('Error', 'Password must be at least 8 characters'); return; }
    setIsLoading(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), password, phone || undefined);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Registration Failed', e.response?.data?.message || 'Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, isDark && styles.containerDark]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]} keyboardShouldPersistTaps="handled">
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={[styles.backButtonText, isDark && styles.textWhite]}>← Back to Store</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.logo}>🌿 {BRAND.name}</Text>
          <Text style={styles.tagline}>Create your account</Text>
        </View>
        <View style={styles.form}>
          <Text style={[styles.title, { color: isDark ? '#ffffff' : '#0f172a' }]}>Join FarmFreshFarmer</Text>
          <TextInput style={styles.input} placeholder="Full Name *" placeholderTextColor={COLORS.textMuted} value={name} onChangeText={setName} autoCapitalize="words" />
          <TextInput style={styles.input} placeholder="Email address *" placeholderTextColor={COLORS.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Phone number" placeholderTextColor={COLORS.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextInput style={styles.input} placeholder="Password (min 8 chars) *" placeholderTextColor={COLORS.textMuted} value={password} onChangeText={setPassword} secureTextEntry />
          <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignIn} disabled={isLoading}>
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleRegister} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Create Account</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.link}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign In</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  containerDark: { backgroundColor: '#000000' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  backButton: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', marginBottom: 20 },
  backButtonText: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  textWhite: { color: '#ffffff' },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 26, fontWeight: '800', color: COLORS.primaryDark, marginBottom: 4 },
  tagline: { fontSize: 14, color: COLORS.textMuted },
  form: { gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  input: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text, backgroundColor: '#f8fafc' },
  button: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  socialButton: { backgroundColor: '#fff', padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#ccc' },
  socialButtonText: { fontSize: 15, fontWeight: 'bold', color: '#000' },
  link: { alignItems: 'center', marginTop: 8 },
  linkText: { color: COLORS.textMuted, fontSize: 14 },
  linkBold: { color: COLORS.primary, fontWeight: '700' },
});
