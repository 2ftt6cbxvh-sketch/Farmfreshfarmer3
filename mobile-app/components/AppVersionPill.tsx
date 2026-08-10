import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const APP_VERSION = 'v7.9.0';

export function AppVersionPill() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.pillContainer, { bottom: Math.max(insets.bottom + 6, 12) }]} pointerEvents="none">
      <View style={styles.pillBox}>
        <View style={styles.greenDot} />
        <Text style={styles.versionText}>{APP_VERSION}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pillContainer: {
    position: 'absolute',
    left: 14,
    zIndex: 40,
  },
  pillBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 5,
  },
  versionText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
