import { useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, Modal,
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

  // Staff & Partner Modals
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [staffEmail, setStaffEmail] = useState('admin@farmfreshfarmer.com');
  const [staffPassword, setStaffPassword] = useState('');

  // TOTP 2FA Challenge Modal State for Primary Admin
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [pendingAdminUser, setPendingAdminUser] = useState<any>(null);

  const [authMethods, setAuthMethods] = useState<{ emailEnabled: boolean; googleEnabled: boolean }>({ emailEnabled: true, googleEnabled: true });

  useEffect(() => {
    api.get('/api/auth/methods')
      .then((res) => {
        if (res.data) setAuthMethods({ emailEnabled: res.data.emailEnabled !== false, googleEnabled: res.data.googleEnabled !== false });
      })
      .catch(() => {});
  }, []);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '983416661519-hd22kfa2kc02hnh5plea83bckfej3o95.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    redirectUri: 'https://auth.expo.io/@ganeshvarma/farmfreshfarmer',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token, access_token } = response.params || {};
      const auth = response.authentication;
      handleGoogleSignInActual(id_token || auth?.idToken || '', access_token || auth?.accessToken);
    } else if (response?.type === 'error') {
      Alert.alert('Google Sign-In Error', response.error?.message || 'Could not complete Google Sign-In.');
    }
  }, [response]);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Please enter email and password'); return; }
    setIsLoading(true);
    try {
      const user = await login(email.trim().toLowerCase(), password);
      
      // Check if user is Admin / Staff needing TOTP
      if (user.role === 'admin' || user.email?.toLowerCase() === 'admin@farmfreshfarmer.com') {
        setPendingAdminUser(user);
        setShowTotpModal(true);
        setIsLoading(false);
        return;
      }

      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login Failed', err.response?.data?.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStaffLoginSubmit = async () => {
    if (!staffEmail || !staffPassword) { Alert.alert('Error', 'Please enter staff email and password'); return; }
    setIsLoading(true);
    try {
      const user = await login(staffEmail.trim().toLowerCase(), staffPassword);
      setShowStaffModal(false);

      // Require TOTP for Admin account
      if (user.role === 'admin' || user.email?.toLowerCase() === 'admin@farmfreshfarmer.com' || user.isPrimaryAdmin) {
        setPendingAdminUser(user);
        setShowTotpModal(true);
        setIsLoading(false);
        return;
      }

      // Route based on staff role
      if (user?.role && ['admin', 'warehouse_admin', 'manager_admin', 'subadmin'].includes(user.role)) {
        Alert.alert('Welcome Back', `Staff Sign-in successful (${user.role})`);
        router.replace('/admin');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Staff Login Failed', err.response?.data?.message || 'Invalid staff credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyTotpChallenge = async () => {
    if (!totpCode || totpCode.trim().length < 6) {
      Alert.alert('TOTP Error', 'Please enter the 6-digit Authenticator code');
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.post('/api/admin/mfa/challenge', { code: totpCode.trim() });
      if (res.data?.verified) {
        setShowTotpModal(false);
        Alert.alert('🔑 TOTP Verified!', 'Primary Admin identity verified successfully.');
        router.replace('/admin');
      } else {
        Alert.alert('2FA Failed', 'Invalid 6-digit TOTP code. Check Apple Passwords or Authenticator App.');
      }
    } catch (err: any) {
      Alert.alert('TOTP Error', err.response?.data?.message || 'Invalid TOTP code. Please check your Authenticator app.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePartnerLoginSubmit = async () => {
    if (!staffEmail || !staffPassword) { Alert.alert('Error', 'Please enter partner email and password'); return; }
    setIsLoading(true);
    try {
      const user = await login(staffEmail.trim().toLowerCase(), staffPassword);
      setShowPartnerModal(false);
      if (user.role === 'delivery_partner') {
        Alert.alert('Welcome Partner! 🚚', 'Delivery Partner Sign-in successful.');
        router.replace('/(tabs)');
      } else {
        Alert.alert('Notice', 'Account logged in. Not registered as a delivery partner.');
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Partner Sign-In Failed', err.response?.data?.message || 'Invalid credentials');
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

          {/* ── STAFF & PARTNER PORTAL ACCESS BUTTONS ──────────────────────────────── */}
          <View style={styles.portalDivider}>
            <View style={[styles.dividerLine, isDark ? styles.dividerLineDark : styles.dividerLineLight]} />
            <Text style={[styles.dividerText, { color: mutedColor }]}>STAFF & PARTNER ACCESS</Text>
            <View style={[styles.dividerLine, isDark ? styles.dividerLineDark : styles.dividerLineLight]} />
          </View>

          <View style={styles.portalRow}>
            <TouchableOpacity
              style={[styles.portalBtn, isDark ? styles.portalBtnDark : styles.portalBtnLight]}
              onPress={() => { setStaffEmail('admin@farmfreshfarmer.com'); setShowStaffModal(true); }}
            >
              <Text style={{ fontSize: 16 }}>🛡️</Text>
              <Text style={[styles.portalBtnText, isDark ? styles.textWhite : styles.textDark]}>Admin / Staff</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.portalBtn, isDark ? styles.portalBtnDark : styles.portalBtnLight]}
              onPress={() => { setStaffEmail(''); setShowPartnerModal(true); }}
            >
              <Text style={{ fontSize: 16 }}>🚚</Text>
              <Text style={[styles.portalBtnText, isDark ? styles.textWhite : styles.textDark]}>Delivery Partner</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ── 🔑 PRIMARY ADMIN TOTP 2FA MODAL ────────────────────────────────────── */}
      <Modal visible={showTotpModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark ? styles.modalCardDark : styles.modalCardLight]}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🔒</Text>
            <Text style={[styles.modalTitle, isDark ? styles.textWhite : styles.textDark]}>Primary Admin 2FA TOTP</Text>
            <Text style={[styles.modalSub, isDark ? styles.textMutedDark : styles.textMutedLight]}>
              Enter the live 6-digit verification code from your Apple Passwords or Authenticator App.
            </Text>

            <TextInput
              style={[styles.totpInput, isDark ? styles.totpInputDark : styles.totpInputLight]}
              placeholder="123456"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              value={totpCode}
              onChangeText={setTotpCode}
              keyboardType="number-pad"
              maxLength={6}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTotpModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, isLoading && styles.buttonDisabled]} onPress={handleVerifyTotpChallenge} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Verify 2FA 🔑</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 🛡️ STAFF / ADMIN LOGIN MODAL ────────────────────────────────────── */}
      <Modal visible={showStaffModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark ? styles.modalCardDark : styles.modalCardLight]}>
            <Text style={{ fontSize: 32, marginBottom: 4 }}>🛡️</Text>
            <Text style={[styles.modalTitle, isDark ? styles.textWhite : styles.textDark]}>Staff / Admin Sign-in</Text>
            <Text style={[styles.modalSub, isDark ? styles.textMutedDark : styles.textMutedLight]}>
              Enter your authorized staff credentials to access admin controls.
            </Text>

            <View style={styles.formSpaceModal}>
              <TextInput
                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                placeholder="Staff Email"
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                value={staffEmail}
                onChangeText={setStaffEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                placeholder="Password"
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                value={staffPassword}
                onChangeText={setStaffPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowStaffModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, isLoading && styles.buttonDisabled]} onPress={handleStaffLoginSubmit} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Sign In 🛡️</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 🚚 DELIVERY PARTNER LOGIN MODAL ─────────────────────────────────── */}
      <Modal visible={showPartnerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark ? styles.modalCardDark : styles.modalCardLight]}>
            <Text style={{ fontSize: 32, marginBottom: 4 }}>🚚</Text>
            <Text style={[styles.modalTitle, isDark ? styles.textWhite : styles.textDark]}>Delivery Partner Portal</Text>
            <Text style={[styles.modalSub, isDark ? styles.textMutedDark : styles.textMutedLight]}>
              Sign in with your delivery partner phone/email credentials.
            </Text>

            <View style={styles.formSpaceModal}>
              <TextInput
                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                placeholder="Partner Email / Phone"
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                value={staffEmail}
                onChangeText={setStaffEmail}
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                placeholder="Password"
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                value={staffPassword}
                onChangeText={setStaffPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPartnerModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, isLoading && styles.buttonDisabled]} onPress={handlePartnerLoginSubmit} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Partner Sign-In 🚚</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  header: { alignItems: 'center', marginBottom: 24 },
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
  formSpaceModal: { gap: 12, width: '100%', marginVertical: 16 },
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
  link: { alignItems: 'center', marginTop: 8 },
  linkText: { fontSize: 14 },
  linkBold: { fontWeight: '800' },

  // Portal divider & buttons
  portalDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 14, gap: 10 },
  dividerLine: { flex: 1, height: 1 },
  dividerLineDark: { backgroundColor: 'rgba(255,255,255,0.15)' },
  dividerLineLight: { backgroundColor: '#e2e8f0' },
  dividerText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  portalRow: { flexDirection: 'row', gap: 10 },
  portalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  portalBtnDark: { backgroundColor: '#091510', borderColor: 'rgba(52, 211, 153, 0.25)' },
  portalBtnLight: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  portalBtnText: { fontSize: 12, fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', borderRadius: 28, padding: 24, alignItems: 'center', borderWidth: 1 },
  modalCardDark: { backgroundColor: '#0b1320', borderColor: 'rgba(52, 211, 153, 0.3)' },
  modalCardLight: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  modalTitle: { fontSize: 20, fontWeight: '800', fontFamily: 'serif' },
  modalSub: { fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 16 },
  totpInput: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    fontSize: 24,
    textAlign: 'center',
    marginVertical: 18,
    fontWeight: '900',
    letterSpacing: 4,
  },
  totpInputDark: { backgroundColor: '#111827', color: '#10b981', borderColor: '#10b981' },
  totpInputLight: { backgroundColor: '#f8fafc', color: '#059669', borderColor: '#059669' },
  modalBtnRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  cancelBtnText: { color: '#ef4444', fontWeight: '800', fontSize: 13 },
  submitBtn: { flex: 1.5, backgroundColor: '#059669', padding: 14, borderRadius: 14, alignItems: 'center' },
  submitBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
});
