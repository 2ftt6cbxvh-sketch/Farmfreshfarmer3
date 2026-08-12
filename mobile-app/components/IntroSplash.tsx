import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Image, Animated, TouchableOpacity, AccessibilityInfo } from 'react-native';

let hasSeenMobileIntro = false;

export function IntroSplash() {
  const [visible, setVisible] = useState(() => {
    if (hasSeenMobileIntro) return false;
    return true;
  });

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const sproutScale = useRef(new Animated.Value(0.4)).current;
  const sproutTranslate = useRef(new Animated.Value(24)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  const textOpacityAnim = useRef(new Animated.Value(0)).current;
  const textTranslateAnim = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    if (!visible) return;

    // Check OS accessibility reduce-motion setting
    AccessibilityInfo.isReduceMotionEnabled().then((isReduced) => {
      if (isReduced) {
        hasSeenMobileIntro = true;
        setVisible(false);
      }
    }).catch(() => {});

    // Sprout & Growth Motion (Phase 1 & 2)
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(sproutScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(sproutTranslate, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.8, duration: 600, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();

    // Text Unfold (Phase 3)
    Animated.sequence([
      Animated.delay(350),
      Animated.parallel([
        Animated.timing(textOpacityAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Auto-finish after 1.8s
    const timer = setTimeout(() => {
      handleExit();
    }, 1800);

    return () => clearTimeout(timer);
  }, [visible]);

  const handleExit = () => {
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 400,
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
        {/* Soft Radial Emerald Sprout Glow */}
        <Animated.View style={[styles.emeraldGlow, { opacity: glowOpacity }]} />

        <View style={styles.content}>
          {/* Sprouting Emblem */}
          <Animated.View
            style={[
              styles.iconWrapper,
              {
                transform: [{ scale: sproutScale }, { translateY: sproutTranslate }],
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
              🌾 Organic · Farm to Home Delivery
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
    justify.content: 'center',
  },
  emeraldGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconWrapper: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
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
    fontSize: 27,
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
    marginTop: 26,
    letterSpacing: 1.5,
  },
});
