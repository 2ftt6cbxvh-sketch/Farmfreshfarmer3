import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Image, Animated, TouchableOpacity, AccessibilityInfo } from 'react-native';

let hasSeenMobileIntro = false;

export function IntroSplash() {
  const [visible, setVisible] = useState(() => {
    if (hasSeenMobileIntro) return false;
    return true;
  });

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const translateAnim = useRef(new Animated.Value(14)).current;
  const textOpacityAnim = useRef(new Animated.Value(0)).current;
  const textTranslateAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (!visible) return;

    // Check OS accessibility reduce-motion setting
    AccessibilityInfo.isReduceMotionEnabled().then((isReduced) => {
      if (isReduced) {
        hasSeenMobileIntro = true;
        setVisible(false);
      }
    }).catch(() => {});

    // Entrance Animation (Emblem)
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();

    // Entrance Animation (Text & Tagline)
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.timing(textOpacityAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Auto-finish after 1.5s
    const timer = setTimeout(() => {
      handleExit();
    }, 1450);

    return () => clearTimeout(timer);
  }, [visible]);

  const handleExit = () => {
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      hasSeenMobileIntro = true;
      setVisible(false);
    });
  };

  if (!visible) return null;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handleExit}
      style={StyleSheet.absoluteFillObject}
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        {/* Soft Radial Emerald Glow */}
        <View style={styles.emeraldGlow} />

        <View style={styles.content}>
          {/* Emblem */}
          <Animated.View
            style={[
              styles.iconWrapper,
              {
                transform: [{ scale: scaleAnim }, { translateY: translateAnim }],
              },
            ]}
          >
            <Image
              source={require('../assets/icon.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Text & Tagline */}
          <Animated.View
            style={[
              styles.textContainer,
              {
                opacity: textOpacityAnim,
                transform: [{ translateY: textTranslateAnim }],
              },
            ]}
          >
            <Text style={styles.brandTitle}>
              FarmFresh<Text style={styles.brandEmerald}>Farmer</Text>
            </Text>
            <Text style={styles.tagline}>
              🌿 Fresh Harvest · Direct To Your Doorstep
            </Text>
          </Animated.View>

          {/* Skip Hint */}
          <Text style={styles.skipHint}>TAP ANYWHERE TO SKIP</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#06060c',
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emeraldGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconWrapper: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    alignItems: 'center',
  },
  brandTitle: {
    fontFamily: 'System',
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  brandEmerald: {
    color: '#10b981',
  },
  tagline: {
    fontSize: 12,
    fontWeight: '800',
    color: '#34d399',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  skipHint: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 24,
    letterSpacing: 1.5,
  },
});
