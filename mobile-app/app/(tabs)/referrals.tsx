import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, RefreshControl, Share, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { COLORS, BRAND } from '../../constants/config';
import { useAuth } from '../../lib/store';
import { useThemeStore } from '../../lib/theme';

interface ReferralSummary {
  code: string;
  totalReferrals: number;
  successfulReferrals: number;
  totalEarned: number;
  availableBalance: number;
  referrals: Array<{ id: number; referredUserId: number; status: string; createdAt: string }>;
  rewards: Array<{ id: number; amount: number; rewardPercent: number; status: string; createdAt: string }>;
}

export default function ReferralsScreen() {
  const { user } = useAuth();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch } = useQuery<ReferralSummary>({
    queryKey: ['referral-summary'],
    queryFn: () => api.get('/api/referral/summary').then(r => r.data),
    enabled: !!user,
    staleTime: 30000,
  });

  const bg = isDark ? '#000000' : '#f8fafc';
  const cardBg = isDark ? '#0c121e' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : COLORS.text;
  const mutedColor = isDark ? '#94a3b8' : COLORS.textMuted;
  const borderCol = isDark ? 'rgba(16, 185, 129, 0.25)' : '#e2e8f0';

  const handleShareCode = async () => {
    if (!data?.code) return;
    const shareMsg = `Use my FarmFreshFarmer referral code ${data.code} for 10% OFF your first order! ${BRAND.website}`;
    try {
      await Share.share({ message: shareMsg, title: 'FarmFreshFarmer Referral Code' });
    } catch {
      Alert.alert('Referral Code', shareMsg);
    }
  };

  if (!user) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.authPrompt}>
          <Text style={styles.authIcon}>🎁</Text>
          <Text style={[styles.authTitle, { color: textColor }]}>Refer & Earn Rewards</Text>
          <Text style={[styles.authText, { color: mutedColor }]}>Log in to get your unique referral code and start earning cash rewards!</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginBtnText}>Sign In to Get Referral Code</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[{ color: mutedColor, marginTop: 12 }]}>Loading referral data...</Text>
      </View>
    );
  }

  const statusColor = (s: string) => {
    if (s === 'completed' || s === 'available') return '#10b981';
    if (s === 'pending') return '#f59e0b';
    return COLORS.textMuted;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: bg }]}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
    >
      <View style={{ paddingTop: Math.max(insets.top + 10, 40), padding: 16 }}>
        <Text style={[styles.pageTitle, { color: textColor }]}>🎁 Refer & Earn</Text>
        <Text style={[{ color: mutedColor, fontSize: 14, marginBottom: 20 }]}>Share your code and earn cash rewards for every friend who orders!</Text>

        {data?.code && (
          <TouchableOpacity
            style={[styles.codeCard, { backgroundColor: isDark ? '#022c22' : '#f0fdf4', borderColor: isDark ? '#065f46' : '#bbf7d0' }]}
            onPress={handleShareCode}
            activeOpacity={0.85}
          >
            <Text style={[{ color: mutedColor, fontSize: 11, marginBottom: 6, textAlign: 'center', letterSpacing: 1, fontWeight: '700' }]}>YOUR REFERRAL CODE</Text>
            <Text style={styles.codeText}>{data.code}</Text>
            <View style={styles.copyBtnRow}>
              <Text style={styles.copyBtnText}>📋 Tap to Share Code</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.kpiGrid}>
          {[
            { value: String(data?.totalReferrals || 0), label: '👥 Total Referrals' },
            { value: String(data?.successfulReferrals || 0), label: '✅ Successful' },
            { value: `₹${(data?.totalEarned || 0).toFixed(0)}`, label: '💰 Total Earned' },
            { value: `₹${(data?.availableBalance || 0).toFixed(0)}`, label: '👛 Available' },
          ].map(k => (
            <View key={k.label} style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.kpiValue, { color: k.label.includes('Available') ? COLORS.primary : textColor }]}>{k.value}</Text>
              <Text style={[styles.kpiLabel, { color: mutedColor }]}>{k.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.howCard, { backgroundColor: isDark ? '#0c121e' : '#fffbeb', borderColor: isDark ? '#78350f' : '#fde68a' }]}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#fde68a' : '#92400e' }]}>💡 How It Works</Text>
          {[
            { icon: '🤝', text: 'Your friend gets 10% OFF their first order' },
            { icon: '💵', text: 'You earn 5% cash reward for every qualifying order they place' },
            { icon: '🎯', text: 'Rewards capped at 30% max per order' },
            { icon: '👛', text: 'Use reward balance at checkout for instant discounts' },
          ].map(h => (
            <View key={h.icon} style={styles.howRow}>
              <Text style={styles.howIcon}>{h.icon}</Text>
              <Text style={[styles.howText, { color: textColor }]}>{h.text}</Text>
            </View>
          ))}
        </View>

        {data?.referrals && data.referrals.length > 0 && (
          <View style={[styles.tableCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>👥 My Referrals</Text>
            {data.referrals.slice(0, 10).map(ref => (
              <View key={ref.id} style={[styles.tableRow, { borderBottomColor: borderCol }]}>
                <Text style={[{ color: textColor, fontSize: 13, flex: 2 }]}>User #{ref.referredUserId}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(ref.status) + '25', flex: 1.5, alignItems: 'center' }]}>
                  <Text style={[{ color: statusColor(ref.status), fontSize: 10, fontWeight: '800' }]}>{ref.status}</Text>
                </View>
                <Text style={[{ color: mutedColor, fontSize: 11, flex: 1.5, textAlign: 'right' }]}>
                  {new Date(ref.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            ))}
          </View>
        )}

        {data?.rewards && data.rewards.length > 0 && (
          <View style={[styles.tableCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>💰 My Rewards</Text>
            {data.rewards.slice(0, 10).map(rew => (
              <View key={rew.id} style={[styles.tableRow, { borderBottomColor: borderCol }]}>
                <Text style={[{ color: COLORS.primary, fontWeight: '800', fontSize: 14, flex: 1 }]}>₹{parseFloat(String(rew.amount)).toFixed(0)}</Text>
                <Text style={[{ color: mutedColor, fontSize: 12, flex: 0.8, textAlign: 'center' }]}>{rew.rewardPercent}%</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(rew.status) + '25', flex: 1.2, alignItems: 'center' }]}>
                  <Text style={[{ color: statusColor(rew.status), fontSize: 10, fontWeight: '800' }]}>{rew.status}</Text>
                </View>
                <Text style={[{ color: mutedColor, fontSize: 11, flex: 1.2, textAlign: 'right' }]}>
                  {new Date(rew.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            ))}
          </View>
        )}

        {(!data?.referrals?.length && !data?.rewards?.length) && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>🚀</Text>
            <Text style={[{ color: textColor, fontWeight: '700', fontSize: 16, marginTop: 12 }]}>No referrals yet</Text>
            <Text style={[{ color: mutedColor, textAlign: 'center', marginTop: 6, fontSize: 13 }]}>Share your code above and start earning!</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageTitle: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  authPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 80 },
  authIcon: { fontSize: 64, marginBottom: 16 },
  authTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  authText: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  loginBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, width: '100%', alignItems: 'center' },
  loginBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  codeCard: { borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 2, marginBottom: 16, shadowColor: '#10b981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 6 },
  codeText: { fontSize: 30, fontWeight: '900', color: COLORS.primary, letterSpacing: 6, marginBottom: 14 },
  copyBtnRow: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  copyBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, minWidth: '45%', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  kpiValue: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  kpiLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  howCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1.5 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  howIcon: { fontSize: 18, marginTop: 1 },
  howText: { flex: 1, fontSize: 13, lineHeight: 20 },
  tableCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
});
