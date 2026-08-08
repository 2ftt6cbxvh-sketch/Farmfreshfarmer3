import { useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
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

  const [authMethods, setAuthMethods] = useState<{ emailEnabled: boolean; googleEnabled: boolean }>({ emailEnabled: true, googleEnabled: true });

  useEffect(() => {
    api.get('/api/auth/methods')
      .then((res) => {
        if (res.data) setAuthMethods({ emailEnabled: res.data.emailEnabled !== false, googleEnabled: res.data.googleEnabled !== false });
      })
      .catch(() => {});
  }, []);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '983416661519-lcur2retdisotv1mlksj7ck24fjtrpje.apps.googleusercontent.com',
    androidClientId: '983416661519-lcur2retdisotv1mlksj7ck24fjtrpje.apps.googleusercontent.com',
    webClientId: '983416661519-lcur2retdisotv1mlksj7ck24fjtrpje.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    redirectUri: AuthSession.makeRedirectUri({ scheme: 'farmfreshfarmer' }),
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token, access_token } = response.params || {};
      const auth = response.authentication;
      handleGoogleSignInActual(id_token || auth?.idToken || '', access_token || auth?.accessToken);
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

  const handleGoogleSignInActual = async (idToken?: string, accessToken?: string) => {
    setIsLoading(true);
    try {
      const payload: any = { platform: 'mobile' };
      if (idToken) payload.idToken = idToken;
      if (accessToken) payload.accessToken = accessToken;
      const res = await api.post('/api/auth/google', payload);
      if (res.data?.accessToken) await tokenStorage.saveAccessToken(res.data.accessToken);
      if (res.data?.refreshToken) await tokenStorage.saveRefreshToken(res.data.refreshToken);
      setUser(res.data.user || res.data);
      Alert.alert('Success', `Welcome back, ${res.data.user?.name || 'Customer'}! 🎉`);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Google Sign-In Failed', err?.response?.data?.message || 'Could not sign in with Google. Please use Email OTP or Password login.');
    } finally {
      setIsLoading(false);
    }
  };

  const bg = isDark ? '#000000' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#0f172a';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top + 10, 24) }]} keyboardShouldPersistTaps="handled">
        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backButton, isDark ? styles.backButtonDark : styles.backButtonLight, { marginTop: insets.top + 10 }]}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={[styles.backButtonText, isDark ? styles.textWhite : styles.textDark]}>← Back to Store</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.logo, { color: isDark ? '#34d399' : '#059669' }]}>🌿 {BRAND.name}</Text>
          <Text style={[styles.tagline, { color: mutedColor }]}>{BRAND.tagline}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={[styles.title, { color: textColor }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: mutedColor }]}>Sign in to your account</Text>

          {authMethods.googleEnabled && (
            <TouchableOpacity
              style={[styles.socialButton, isDark ? styles.socialButtonDark : styles.socialButtonLight]}
              onPress={() => promptAsync()}
              disabled={!request || isLoading}
            >
              <Text style={[styles.socialButtonText, isDark ? styles.textDark : styles.textDark]}>Continue with Google</Text>
            </TouchableOpacity>
          )}

          {!authMethods.emailEnabled && (
            <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.4)', borderRadius: 12, padding: 14, marginVertical: 10, alignItems: 'center' }}>
              <Text style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: 13, textAlign: 'center' }}>⚠️ Email & OTP Login Currently Disabled</Text>
              <Text style={{ color: mutedColor, fontSize: 11, textAlign: 'center', marginTop: 4 }}>Please log in using Google Sign-In above.</Text>
            </View>
          )}

          {authMethods.emailEnabled && (
            <>
              <View style={styles.methodSelector}>
                <TouchableOpacity
                  onPress={() => setMethod('otp')}
                  style={[styles.methodBtn, isDark ? styles.methodBtnDark : styles.methodBtnLight, method === 'otp' && styles.methodBtnActive]}
                >
                  <Text style={[styles.methodBtnText, method === 'otp' ? styles.methodBtnTextActive : (isDark ? styles.textMutedDark : styles.textMutedLight)]}>
                    Email OTP
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMethod('password')}
                  style={[styles.methodBtn, isDark ? styles.methodBtnDark : styles.methodBtnLight, method === 'password' && styles.methodBtnActive]}
                >
                  <Text style={[styles.methodBtnText, method === 'password' ? styles.methodBtnTextActive : (isDark ? styles.textMutedDark : styles.textMutedLight)]}>
                    Password
                  </Text>
                </TouchableOpacity>
              </View>

              {method === 'otp' ? (
                <View style={styles.formSpace}>
                  <TextInput
                    style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                    placeholder="Email address"
                    placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  {!otpSent ? (
                    <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleSendOtp} disabled={isLoading}>
                      {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Send Verification OTP 📩</Text>}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.formSpace}>
                      <TextInput
                        style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                        placeholder="Enter 6-digit OTP"
                        placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                        value={otpCode}
                        onChangeText={setOtpCode}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                      <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleVerifyOtp} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Verify & Sign In 🔑</Text>}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.formSpace}>
                  <TextInput
                    style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                    placeholder="Email address"
                    placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                    placeholder="Password"
                    placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                  <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleLogin} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Sign In</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {authMethods.emailEnabled && (
            <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.link}>
              <Text style={[styles.linkText, { color: mutedColor }]}>Don't have an account? <Text style={[styles.linkBold, { color: isDark ? '#34d399' : '#059669' }]}>Register</Text></Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  backButton: { alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, borderWidth: 1, marginBottom: 20 },
  backButtonDark: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' },
  backButtonLight: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  backButtonText: { fontWeight: '700', fontSize: 14 },
  textWhite: { color: '#ffffff' },
  textDark: { color: '#0f172a' },
  textMutedDark: { color: '#94a3b8' },
  textMutedLight: { color: '#64748b' },
  header: { alignItems: 'center', marginBottom: 30 },
  logo: { fontSize: 28, fontWeight: '800', fontFamily: 'serif', marginBottom: 4 },
  tagline: { fontSize: 14 },
  form: { gap: 12 },
  title: { fontSize: 24, fontWeight: '800', fontFamily: 'serif', marginBottom: 2 },
  subtitle: { fontSize: 14, marginBottom: 12 },
  methodSelector: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  methodBtn: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  methodBtnDark: { backgroundColor: '#111827', borderColor: '#1f2937' },
  methodBtnLight: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  methodBtnActive: { backgroundColor: '#059669', borderColor: '#059669' },
  methodBtnText: { fontWeight: 'bold' },
  methodBtnTextActive: { color: '#ffffff' },
  formSpace: { gap: 12 },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 15 },
  inputDark: { backgroundColor: '#111827', borderColor: '#374151', color: '#ffffff' },
  inputLight: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1', color: '#0f172a' },
  button: { backgroundColor: '#059669', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  socialButton: { padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10, borderWidth: 1 },
  socialButtonDark: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  socialButtonLight: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  socialButtonText: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  link: { alignItems: 'center', marginTop: 12 },
  linkText: { fontSize: 14 },
  linkBold: { fontWeight: '700' },
});
