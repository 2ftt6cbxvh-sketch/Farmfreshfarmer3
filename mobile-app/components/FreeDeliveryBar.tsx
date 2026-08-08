import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

interface FreeDeliveryBarProps {
  subtotal: number;
  threshold: number;
  isDark: boolean;
  style?: any;
}

export function AnimatedFreeDeliveryBar({ subtotal, threshold, isDark, style }: FreeDeliveryBarProps) {
  const anim = useRef(new Animated.Value(subtotal > 0 ? 1 : 0)).current; // 0 = hidden, 1 = shown
  const isFreeDelivery = subtotal >= threshold;
  const remaining = Math.ceil(threshold - subtotal);
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));

  useEffect(() => {
    if (subtotal > 0) {
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: false,
        friction: 8,
        tension: 50,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }, [subtotal > 0]);

  const heightAnim = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 36],
  });

  const opacityAnim = anim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0, 1],
  });

  const scaleAnim = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        isDark ? styles.darkBg : styles.lightBg,
        {
          maxHeight: heightAnim,
          opacity: opacityAnim,
          transform: [{ scaleY: scaleAnim }],
        },
        style,
      ]}
    >
      <Text style={[styles.text, isFreeDelivery ? styles.textGreen : (isDark ? styles.textMutedDark : styles.textMutedLight)]} numberOfLines={1}>
        {isFreeDelivery
          ? '🎉 Free delivery unlocked!'
          : `🚚 Add ₹${remaining} more for free delivery`}
      </Text>
      <View style={[styles.track, isDark ? styles.trackDark : styles.trackLight]}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.badgeText}>₹{threshold}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
    gap: 10,
    overflow: 'hidden',
  },
  lightBg: { backgroundColor: '#ffffff', borderBottomColor: '#f1f5f9' },
  darkBg: { backgroundColor: '#050505', borderBottomColor: 'rgba(16,185,129,0.15)' },
  text: { fontSize: 11, fontWeight: '500', flex: 1 },
  textGreen: { color: '#10b981', fontWeight: '700' },
  textMutedLight: { color: '#64748b' },
  textMutedDark: { color: '#94a3b8' },
  track: { flex: 2, height: 4, borderRadius: 2, overflow: 'hidden' },
  trackLight: { backgroundColor: '#f1f5f9' },
  trackDark: { backgroundColor: 'rgba(16,185,129,0.15)' },
  fill: { height: '100%', backgroundColor: '#10b981', borderRadius: 2 },
  badgeText: { fontSize: 10, fontWeight: '600', color: '#10b981' },
});
