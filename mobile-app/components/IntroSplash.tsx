import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Image, Animated, TouchableOpacity, AccessibilityInfo } from 'react-native';

export function IntroSplash() {
  const [visible, setVisible] = useState(true);

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.82)).current;
  const translateAnim = useRef(new Animated.Value(14)).current;
  const textOpacityAnim = useRef(new Animated.Value(0)).current;
  const textTranslateAnim = useRef(new Animated.Value(10)).current;
  const shimmerAnim = useRef(new Animated.Value(-160)).current;
  const glowScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Check OS accessibility reduce-motion setting
    AccessibilityInfo.isReduceMotionEnabled().then((isReduced) => {
      if (isReduced) {
        setVisible(false);
      }
    }).catch(() => {});

    // Spring Entrance (Official Emblem)
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 45,
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowScale, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(glowScale, { toValue: 0.9, duration: 800, useNativeDriver: true }),
        ])
      ),
    ]).start();

    // Shimmer Flare Gliding Across Emblem
    Animated.sequence([
      Animated.delay(180),
      Animated.timing(shimmerAnim, {
        toValue: 160,
        duration: 750,
        useNativeDriver: true,
      }),
    ]).start();

    // Text & Tagline Entrance
    Animated.sequence([
      Animated.delay(180),
      Animated.parallel([
        Animated.timing(textOpacityAnim, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateAnim, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Crisp hold timing (~1.25s) then exit
    const timer = setTimeout(() => {
      handleExit();
    }, 1250);

    return () => clearTimeout(timer);
  }, []);

  const handleExit = () => {
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
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
        {/* Glowing Emerald Radial Halo */}
        <Animated.View
          style={[
            styles.emeraldGlow,
            { transform: [{ scale: glowScale }] },
          ]}
        />

        <View style={styles.content}>
          {/* Official Emblem with Diagonal Shimmer Light Sweep */}
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

            {/* Glowing White Shimmer Flare */}
            <Animated.View
              style={[
                styles.shimmerBar,
                { transform: [{ translateX: shimmerAnim }, { rotate: '25deg' }] },
              ]}
            />
          </Animated.View>

          {/* Brand Name & Tagline Unfold */}
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
    width: 290,
    height: 290,
    borderRadius: 145,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
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
    overflow: 'hidden',
    borderRadius: 22,
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  shimmerBar: {
    position: 'absolute',
    top: -30,
    bottom: -30,
    width: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  textContainer: {
    alignItems: 'center',
  },
  brandTitle: {
    fontFamily: 'System',
    fontSize: 28,
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
