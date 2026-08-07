import { useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/store';
import { tokenStorage } from '../../lib/storage';
import { useThemeStore } from '../../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, BRAND } from '../../constants/config';
import { api } from '../../lib/api';

export default function LoginScreen() {
  const { login, setUser } = useAuth();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [method, setMethod] = useState<'password' | 'otp'>('otp');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: '983416661519-hd22kfa2kc02hnh5plea83bckfej3o95.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleSignInActual(id_token);
    }
  }, [response]);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Please enter email and password'); return; }
    setIsLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login Failed', err.response?.data?.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!email) { Alert.alert('Error', 'Please enter your email'); return; }
    setIsLoading(true);
    try {
      await api.post('/api/auth/otp/send', { email: email.trim().toLowerCase() });
      setOtpSent(true);
      Alert.alert('OTP Sent', 'Check your email inbox.');
    } catch (err: any) {
      Alert.alert('Error', 'Could not send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) { Alert.alert('Error', 'Please enter the 6-digit OTP'); return; }
    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/otp/verify', { email: email.trim().toLowerCase(), code: otpCode.trim() });
      if (res.data?.accessToken) await tokenStorage.saveAccessToken(res.data.accessToken);
      if (res.data?.refreshToken) await tokenStorage.saveRefreshToken(res.data.refreshToken);
      setUser(res.data.user || res.data);
      Alert.alert('Success', `Welcome back, ${res.data.user?.name || 'Customer'}! 🎉`);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', 'Invalid or expired OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignInActual = async (idToken: string) => {
    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/google', { idToken, platform: 'mobile' });
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

  return (
    <KeyboardAvoidingView style={[styles.container, isDark && styles.containerDark]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top + 10, 24) }]} keyboardShouldPersistTaps="handled">
        {/* Back Button */}
        <TouchableOpacity style={[styles.backButton, { marginTop: insets.top + 10 }]} onPress={() => router.replace('/(tabs)')}>
          <Text style={[styles.backButtonText, isDark && styles.textWhite]}>← Back to Store</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🌿 {BRAND.name}</Text>
          <Text style={styles.tagline}>{BRAND.tagline}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          <TouchableOpacity style={styles.socialButton} onPress={() => promptAsync()} disabled={!request || isLoading}>
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.methodSelector}>
            <TouchableOpacity onPress={() => setMethod('otp')} style={[styles.methodBtn, method === 'otp' && styles.methodBtnActive]}>
              <Text style={[styles.methodBtnText, method === 'otp' && styles.methodBtnTextActive]}>Email OTP</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMethod('password')} style={[styles.methodBtn, method === 'password' && styles.methodBtnActive]}>
              <Text style={[styles.methodBtnText, method === 'password' && styles.methodBtnTextActive]}>Password</Text>
            </TouchableOpacity>
          </View>

          {method === 'otp' ? (
            <View style={styles.formSpace}>
              <TextInput style={styles.input} placeholder="Email address" placeholderTextColor="#666" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              {!otpSent ? (
                <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleSendOtp} disabled={isLoading}>
                  {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Send Verification OTP 📩</Text>}
                </TouchableOpacity>
              ) : (
                <View style={styles.formSpace}>
                  <TextInput style={styles.input} placeholder="Enter 6-digit OTP" placeholderTextColor="#666" value={otpCode} onChangeText={setOtpCode} keyboardType="number-pad" maxLength={6} />
                  <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleVerifyOtp} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Verify & Sign In 🔑</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.formSpace}>
              <TextInput style={styles.input} placeholder="Email address" placeholderTextColor="#666" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#666" value={password} onChangeText={setPassword} secureTextEntry />
              <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleLogin} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Sign In</Text>}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.link}>
            <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Register</Text></Text>
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
  backButton: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', marginBottom: 20 },
  backButtonText: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  textWhite: { color: '#ffffff' },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 28, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  tagline: { fontSize: 14, color: '#888' },
  form: { gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 8 },
  methodSelector: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  methodBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#222', alignItems: 'center' },
  methodBtnActive: { backgroundColor: COLORS.primary },
  methodBtnText: { color: '#888', fontWeight: 'bold' },
  methodBtnTextActive: { color: '#fff' },
  formSpace: { gap: 12 },
  input: { borderWidth: 1.5, borderColor: '#333', borderRadius: 12, padding: 14, fontSize: 15, color: '#fff', backgroundColor: '#111' },
  button: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  socialButton: { backgroundColor: '#fff', padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  socialButtonText: { fontSize: 15, fontWeight: 'bold', color: '#000' },
  link: { alignItems: 'center', marginTop: 8 },
  linkText: { color: '#888', fontSize: 14 },
  linkBold: { color: COLORS.primary, fontWeight: '700' },
});
