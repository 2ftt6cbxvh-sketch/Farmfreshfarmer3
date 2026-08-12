import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Image, Animated, TouchableOpacity, AccessibilityInfo } from 'react-native';

let hasSeenMobileIntro = false;

export function IntroSplash() {
  const [visible, setVisible] = useState(() => {
    if (hasSeenMobileIntro) return false;
    return true;
  });

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const translateAnim = useRef(new Animated.Value(12)).current;
  const textOpacityAnim = useRef(new Animated.Value(0)).current;
  const textTranslateAnim = useRef(new Animated.Value(8)).current;
  const shimmerAnim = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (!visible) return;

    // Check OS accessibility reduce-motion setting
    AccessibilityInfo.isReduceMotionEnabled().then((isReduced) => {
      if (isReduced) {
        hasSeenMobileIntro = true;
        setVisible(false);
      }
    }).catch(() => {});

    // Sleek Spring Entrance (Official Logo) — Exactly matching Web
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();

    // Shimmer Flare Gliding Across Logo
    Animated.sequence([
      Animated.delay(220),
      Animated.timing(shimmerAnim, {
        toValue: 120,
        duration: 650,
        useNativeDriver: true,
      }),
    ]).start();

    // Text & Tagline Entrance
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(textOpacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Fast, crisp timing (~1.1s total) for returning users
    const timer = setTimeout(() => {
      handleExit();
    }, 1100);

    return () => clearTimeout(timer);
  }, [visible]);

  const handleExit = () => {
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 300,
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
        {/* Ambient Emerald Halo Glow */}
        <View style={styles.emeraldGlow} />

        <View style={styles.content}>
          {/* Official Mobile Logo Emblem with Diagonal Light Sheen */}
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

            {/* Shimmer Light Sweep Overlay */}
            <Animated.View
              style={[
                styles.shimmerBar,
                { transform: [{ translateX: shimmerAnim }, { rotate: '25deg' }] },
              ]}
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

          {/* Fast Skip Hint */}
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
    width: 105,
    height: 105,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    borderRadius: 20,
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  shimmerBar: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
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
    marginTop: 24,
    letterSpacing: 1.5,
  },
});
