import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { LakshmiAiBot } from '../components/LaxshmiAiBot';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function AppContent() {
  const [lockdownActive, setLockdownActive] = useState(false);
  const [lockdownReason, setLockdownReason] = useState('');

  useEffect(() => {
    const checkLockdown = async () => {
      try {
        const res = await api.get('/api/delivery/status');
        if (res.status === 423 || res.data?.lockdown?.active) {
          setLockdownActive(true);
          setLockdownReason(res.data?.reason || res.data?.lockdown?.reason || 'Unauthorised activity detected');
        } else {
          setLockdownActive(false);
        }
      } catch (err: any) {
        if (err.response?.status === 423) {
          setLockdownActive(true);
          setLockdownReason(err.response?.data?.reason || 'Unauthorised activity detected');
        }
      }
    };
    checkLockdown();
    const interval = setInterval(checkLockdown, 5000);
    return () => clearInterval(interval);
  }, []);

  const isSuperAdminUser = (() => {
    try {
      const user = JSON.parse((typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null) || 'null');
      const token = (typeof localStorage !== 'undefined' ? (localStorage.getItem('admin_token') || localStorage.getItem('token')) : null);
      return !!(token && user && (user.email === 'admin@farmfreshfarmer.com' || user.role === 'superadmin'));
    } catch {
      return false;
    }
  })();

  if (lockdownActive && !isSuperAdminUser) {
    return (
      <View style={styles.lockdownContainer}>
        <StatusBar style="light" />
        <View style={styles.lockdownCard}>
          <Text style={styles.sirenIcon}>🚨</Text>
          <Text style={styles.lockdownTitle}>PLATFORM REMOTE LOCKDOWN ACTIVE</Text>
          <Text style={styles.lockdownSubtitle}>FarmFreshFarmer security controller has activated emergency lockdown.</Text>
          
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>REASON:</Text>
            <Text style={styles.reasonText}>{lockdownReason}</Text>
          </View>

          <Text style={styles.legalNotice}>
            🔒 All customer and Sub-admin API routes returning 423 (Locked) except Chief Admin. Unauthorized access attempts are monitored and recorded under IT Act 2000 & BNS 2023.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="checkout" options={{ headerShown: false }} />
      </Stack>
      <LakshmiAiBot />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  lockdownContainer: {
    flex: 1,
    backgroundColor: '#06060c',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lockdownCard: {
    width: '100%',
    backgroundColor: '#111118',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1.5,
    borderColor: '#ef4444',
    alignItems: 'center',
  },
  sirenIcon: { fontSize: 48, marginBottom: 12 },
  lockdownTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ef4444',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  lockdownSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
  },
  reasonBox: {
    width: '100%',
    backgroundColor: '#1c1014',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    marginBottom: 20,
  },
  reasonLabel: { fontSize: 10, fontWeight: 'bold', color: '#f87171', marginBottom: 4 },
  reasonText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  legalNotice: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
  },
});
