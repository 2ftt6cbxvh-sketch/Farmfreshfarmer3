import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/config';
import { useThemeStore } from '../../lib/theme';

export default function TabLayout() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: isDark ? '#64748b' : COLORS.textMuted,
        tabBarStyle: { 
          borderTopWidth: 1, 
          borderTopColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#e2e8f0',
          backgroundColor: isDark ? '#000000' : '#ffffff',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="basket"
        options={{
          title: 'Basket',
          tabBarIcon: ({ color, size }) => <Ionicons name="basket" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="webapp"
        options={{
          title: 'Web Live 🌐',
          tabBarIcon: ({ color, size }) => <Ionicons name="globe-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
