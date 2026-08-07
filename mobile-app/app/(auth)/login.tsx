import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/store';
import { COLORS, BRAND } from '../../constants/config';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (demoEmail?: string, demoPass?: string) => {
    const e = demoEmail || email;
    const p = demoPass || password;
    if (!e || !p) { Alert.alert('Error', 'Please enter email and password'); return; }
    setIsLoading(true);
    try {
      await login(e.trim().toLowerCase(), p);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login Failed', err.response?.data?.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🌿 {BRAND.name}</Text>
          <Text style={styles.tagline}>{BRAND.tagline}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={() => handleLogin()}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.demoButtonsContainer}>
            <Text style={styles.demoTitle}>Quick Demo Login:</Text>
            <View style={styles.demoRow}>
              <TouchableOpacity style={styles.demoButton} onPress={() => handleLogin('customer@example.com', 'password')}>
                <Text style={styles.demoButtonText}>👨🌾 Customer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.demoButton} onPress={() => handleLogin('admin', 'admin123')}>
                <Text style={styles.demoButtonText}>🛡️ Admin</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.link}>
            <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Register</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 28, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  tagline: { fontSize: 14, color: '#888' },
  form: { gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: '#333', borderRadius: 12,
    padding: 14, fontSize: 15, color: '#fff', backgroundColor: '#111',
  },
  button: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  link: { alignItems: 'center', marginTop: 8 },
  linkText: { color: '#888', fontSize: 14 },
  linkBold: { color: COLORS.primary, fontWeight: '700' },
  demoButtonsContainer: { marginTop: 24, alignItems: 'center', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#222' },
  demoTitle: { color: '#888', fontSize: 14, marginBottom: 12 },
  demoRow: { flexDirection: 'row', gap: 12 },
  demoButton: { backgroundColor: '#222', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  demoButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
