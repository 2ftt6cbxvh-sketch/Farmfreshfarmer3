import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../lib/theme';
import { useCartStore } from '../../lib/cart';
import { useAuth } from '../../lib/store';
import { getMobileStarTheme } from '../../lib/starTheme';

export default function TabLayout() {
  const { theme } = useThemeStore();
  const { user } = useAuth();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const cartItems = useCartStore((s) => s.items) || [];
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  const isSuperAdminUser = Boolean(user?.isPrimaryAdmin || user?.email?.toLowerCase() === 'admin@farmfreshfarmer.com' || (user as any)?.id === 1);
  const isStaffUser = Boolean(!isSuperAdminUser && user && user.role !== 'customer');
  const userStars = isSuperAdminUser
    ? 6
    : isStaffUser
    ? Math.max(0, Math.min(6, Number(user?.starRating) ?? 5))
    : Math.max(0, Math.min(5, Number(user?.customerStars) || 0));

  const tierTheme = getMobileStarTheme(user ? userStars : 0);

  const ACTIVE = tierTheme.color;
  const INACTIVE = isDark ? '#94a3b8' : '#6b7280';
  const BG = isDark ? '#0a0a0a' : '#ffffff';
  const BORDER = isDark ? tierTheme.border : '#e5e7eb';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: BORDER,
          backgroundColor: BG,
          height: Platform.OS === 'android' ? 62 : 56 + insets.bottom,
          paddingBottom: Platform.OS === 'android' ? 8 : insets.bottom,
          paddingTop: 6,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="basket"
        options={{
          title: 'Basket',
          tabBarIcon: ({ color, size }) => (
            <View style={{ position: 'relative' }}>
              <Ionicons name="basket-outline" size={size} color={color} />
              {cartCount > 0 && (
                <View style={[styles.badge]}>
                  <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="referrals"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="gift-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: 'Subscribe',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="refresh-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#10b981',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
});
