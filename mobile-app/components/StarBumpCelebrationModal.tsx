import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../lib/store";
import { getMobileStarTheme } from "../lib/starTheme";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");

interface StarBumpInfo { stars: number; oldStars?: number; name?: string; }

function ConfettiPiece({ delay, color, xPos }: { delay: number; color: string; xPos: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const rotAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.loop(Animated.timing(rotAnim, { toValue: 1, duration: 500, useNativeDriver: true })),
      ]),
    ]).start();
  }, []);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-30, height + 50] });
  const opacity = anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.7, 0] });
  const rotate = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ position: "absolute", left: xPos, top: 0, width: 10, height: 6, backgroundColor: color, transform: [{ translateY }, { rotate }], opacity, borderRadius: 2 }} />
  );
}

function StarBounce({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([Animated.delay(delay), Animated.spring(anim, { toValue: 1, useNativeDriver: true, bounciness: 20 })]).start();
  }, []);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  return <Animated.Text style={{ fontSize: 18, color: "#fbbf24", transform: [{ scale }] }}>{String.fromCharCode(0x2605)}</Animated.Text>;
}

export function StarBumpCelebrationModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [bumpInfo, setBumpInfo] = useState<StarBumpInfo | null>(null);
  const slideAnim = useRef(new Animated.Value(height)).current;

  const isSuperAdmin = Boolean(user?.isPrimaryAdmin || user?.email?.toLowerCase() === "admin@farmfreshfarmer.com" || user?.id === 1);
  const isStaff = Boolean(!isSuperAdmin && user && user.role !== "customer");
  const currentStars = user
    ? isSuperAdmin ? 6 : isStaff ? Math.max(0, Math.min(6, Number(user.starRating) ?? 5)) : Math.max(0, Math.min(5, Number(user.customerStars) || 0))
    : 0;

  useEffect(() => {
    if (!user) return;
    const storageKey = "fff_last_stars_" + user.id;
    AsyncStorage.getItem(storageKey).then((val) => {
      const storedStars = val !== null ? parseInt(val, 10) : null;
      if (storedStars !== null && currentStars > storedStars) {
        setBumpInfo({ stars: currentStars, oldStars: storedStars, name: user.name || "Farmer Friend" });
        setIsOpen(true);
      }
      AsyncStorage.setItem(storageKey, String(currentStars));
    });
  }, [currentStars, user?.id]);

  useEffect(() => {
    if (isOpen) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }).start();
    }
  }, [isOpen]);

  if (!isOpen || !bumpInfo) return null;

  const theme = getMobileStarTheme(bumpInfo.stars);
  const starCount = bumpInfo.stars;
  const CONFETTI_COLORS = ["#fbbf24", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#ffffff", "#d97706", "#ef4444"];
  const confetti = Array.from({ length: 40 }, (_, i) => ({ key: i, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], delay: i * 60, xPos: Math.round((i / 40) * width * 1.1) }));

  const getEmoji = () => starCount >= 6 ? "\u{1F451}" : starCount === 5 ? "\u{1F48E}" : starCount === 4 ? "\u{1F537}" : starCount === 3 ? "\u{1F949}" : "\u{1F331}";
  const getPerks = (): string[] => {
    if (starCount >= 6) return ["\u{1F451} Master Super Admin Clearance", "\u{1FA94} Lakshmi VIP Executive Concierge", "\u26A1 Immediate Order Dispatch Priority", "\u2728 Royal Gold Aura across App & Web"];
    if (starCount === 5) return ["\u{1F48E} Elite 5-Star VIP — 15% Tier Discount", "\u{1F69A} Zero Delivery Fee on All Orders", "\u{1FA94} VIP Lakshmi Support & WhatsApp Line", "\u{1F381} Double Referral Rewards"];
    if (starCount === 4) return ["\u{1F537} 10% Silver Tier Discount at Checkout", "\u26A1 Express Dispatch Priority", "\u{1FA94} Enhanced Lakshmi AI Tips"];
    if (starCount === 3) return ["\u{1F949} Exclusive Bronze Weekly Promotions", "\u{1F33E} Fresh Arrival Priority Notifications"];
    return ["\u{1F331} Farm Fresh Member Access", "\u{1F381} First Order Welcome Discount"];
  };

  const gradColors = theme.gradientColors as [string, string, string];

  return (
    <Modal visible={isOpen} transparent animationType="none" onRequestClose={() => setIsOpen(false)}>
      <View style={StyleSheet.absoluteFillObject}>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.88)" }]} />
        {confetti.map((p) => <ConfettiPiece key={p.key} delay={p.delay} color={p.color} xPos={p.xPos} />)}
        <Animated.View style={[styles.modalWrapper, { transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient colors={["#0f172a", "#1e1b4b", "#0f172a"]} style={styles.card}>
            <View style={[styles.glowCircle, { backgroundColor: theme.glowColor }]} />
            <View style={[styles.badgeBox, { backgroundColor: theme.badgeBg, borderColor: theme.border }]}>
              <Text style={{ fontSize: 40 }}>{getEmoji()}</Text>
              <View style={styles.starCountBadge}><Text style={styles.starCountText}>+{starCount} {String.fromCharCode(0x2605)}</Text></View>
            </View>
            <View style={styles.starsRow}>{Array.from({ length: starCount }).map((_, i) => <StarBounce key={i} delay={i * 120} />)}</View>
            <Text style={styles.title}>{String.fromCharCode(0x1F389)} Congratulations!</Text>
            <Text style={[styles.tierLabel, { color: theme.color }]}>{String.fromCharCode(0x1F31F)} {theme.label} Unlocked!</Text>
            <Text style={styles.desc}>You have been elevated to <Text style={{ fontWeight: "900", color: "#ffffff" }}>{theme.label}</Text>. Enjoy your new perks!</Text>
            <View style={styles.perksBox}>
              <Text style={styles.perksTitle}>{String.fromCharCode(0x2728)} Your Unlocked Privileges:</Text>
              {getPerks().map((perk, i) => <Text key={i} style={styles.perkItem}>{perk}</Text>)}
            </View>
            <TouchableOpacity style={[styles.ctaBtn, { borderColor: theme.border }]} onPress={() => setIsOpen(false)} activeOpacity={0.85}>
              <LinearGradient colors={gradColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGradient}>
                <Text style={[styles.ctaText, { color: theme.buttonTextColor }]}>Claim Rewards & Continue {String.fromCharCode(0x1F680)}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.skipBtn}>
              <Text style={styles.skipText}>Continue later</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrapper: { position: "absolute", bottom: 0, left: 0, right: 0 },
  card: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 44, alignItems: "center", overflow: "hidden" },
  glowCircle: { position: "absolute", top: -80, width: 160, height: 160, borderRadius: 80, opacity: 0.4, alignSelf: "center" },
  badgeBox: { width: 90, height: 90, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 2, marginBottom: 12, position: "relative" },
  starCountBadge: { position: "absolute", top: -8, right: -8, backgroundColor: "#fbbf24", borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  starCountText: { fontSize: 10, fontWeight: "900", color: "#0f172a" },
  starsRow: { flexDirection: "row", gap: 4, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: "900", color: "#ffffff", marginBottom: 4, textAlign: "center" },
  tierLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginBottom: 10, textAlign: "center", textTransform: "uppercase" },
  desc: { fontSize: 12, color: "#94a3b8", textAlign: "center", lineHeight: 18, marginBottom: 18, maxWidth: 280 },
  perksBox: { width: "100%", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 16, padding: 14, backgroundColor: "rgba(255,255,255,0.04)", marginBottom: 20, gap: 6 },
  perksTitle: { fontSize: 10, fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  perkItem: { fontSize: 12, color: "#e2e8f0", fontWeight: "600", lineHeight: 20 },
  ctaBtn: { width: "100%", borderRadius: 14, overflow: "hidden", borderWidth: 1.5 },
  ctaGradient: { padding: 16, alignItems: "center" },
  ctaText: { fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
  skipBtn: { marginTop: 12 },
  skipText: { fontSize: 12, color: "#64748b", textDecorationLine: "underline" },
});
