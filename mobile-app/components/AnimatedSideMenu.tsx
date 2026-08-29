import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Modal,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.84, 340);

interface Category {
  id: number;
  name: string;
  slug: string;
  dietTag?: string;
}

interface AnimatedSideMenuProps {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  user: any;
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (slug: string | null) => void;
  onOpenPincodeModal: () => void;
  onToggleTheme: () => void;
  router: any;
  cartCount: number;
}

const getCategoryEmoji = (slug?: string, name?: string): string => {
  const s = (slug || '').toLowerCase();
  const n = (name || '').toLowerCase();
  
  if (s.includes('pickle-nonveg') || s.includes('non-veg') || n.includes('non-veg') || n.includes('non veg')) return '🍗';
  if (s.includes('pickle') || n.includes('pickle')) return '🥒';
  if (s.includes('fruit') || n.includes('fruit')) return '🍎';
  if (s.includes('veg') || n.includes('veg')) return '🥦';
  if (s.includes('sweet') || n.includes('sweet')) return '🍬';
  if (s.includes('namkeen') || s.includes('snack') || n.includes('namkeen')) return '🥨';
  if (s.includes('millet') || n.includes('millet')) return '🌾';
  if (s.includes('pulse') || s.includes('grain') || n.includes('pulse')) return '🫘';
  if (s.includes('spice') || n.includes('spice')) return '🌶️';
  if (s.includes('oil') || n.includes('oil')) return '🧴';
  if (s.includes('dairy') || n.includes('dairy')) return '🥛';
  return '🥬';
};

export function AnimatedSideMenu({
  visible,
  onClose,
  isDark,
  user,
  categories,
  selectedCategory,
  onSelectCategory,
  onOpenPincodeModal,
  onToggleTheme,
  router,
  cartCount,
}: AnimatedSideMenuProps) {
  const insets = useSafeAreaInsets();
  const [modalRendered, setModalRendered] = useState(false);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    if (visible) {
      setModalRendered(true);
      // Spring Entrance Animation
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(panelTranslateX, {
          toValue: 0,
          friction: 9,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (modalRendered) {
      // Smooth Exit Animation
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(panelTranslateX, {
          toValue: -DRAWER_WIDTH,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalRendered(false);
      });
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(panelTranslateX, {
        toValue: -DRAWER_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalRendered(false);
      onClose();
    });
  };

  if (!modalRendered) return null;

  // Solid, non-transparent theme tokens
  const panelBg = isDark ? '#091510' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';
  const borderCol = isDark ? 'rgba(52, 211, 153, 0.25)' : '#e2e8f0';

  const tileBg = isDark ? '#0e221b' : '#f8fafc';
  const activeTileBg = isDark ? '#14382c' : '#e6f4ea';

  const userStars = user?.starRating || user?.stars || 5;
  const isAdminOrStaff = user?.role === 'admin' || user?.isPrimaryAdmin;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        {/* Backdrop Fade */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View
            style={[
              styles.backdrop,
              { opacity: backdropOpacity },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Solid Side Drawer Panel */}
        <Animated.View
          style={[
            styles.drawerPanel,
            {
              backgroundColor: panelBg,
              borderRightColor: borderCol,
              paddingTop: Math.max(insets.top + 8, 44),
              transform: [{ translateX: panelTranslateX }],
            },
          ]}
        >
          {/* Header Row */}
          <View style={[styles.headerRow, { borderBottomColor: borderCol }]}>
            <View style={styles.brandGroup}>
              <Text style={styles.brandLeaf}>🌿</Text>
              <Text style={[styles.brandTitle, { color: textColor }]}>
                FarmFresh<Text style={{ color: '#10b981' }}>Farmer</Text>
              </Text>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={[styles.closeBtnText, { color: textColor }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}>
            {/* User Profile & Loyalty Badge */}
            {user ? (
              <View style={[styles.userCard, { backgroundColor: isDark ? '#0e2c22' : '#e6f4ea', borderColor: '#10b981' }]}>
                <Text style={{ fontSize: 20 }}>{isAdminOrStaff ? '🛡️' : '👑'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.userName, { color: textColor }]}>{user.name || 'Valued Customer'}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#10b981' }}>
                    {isAdminOrStaff ? `${user.customTitle || 'Sub-Admin Staff'}` : `⭐ ${Math.min(userStars, 5)} Loyalty Star Member`}
                  </Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.loginBanner, { backgroundColor: '#10b981' }]}
                onPress={() => {
                  handleClose();
                  router.push('/(auth)/login');
                }}
              >
                <Text style={styles.loginBannerText}>🔑 Sign In for Exclusive Fresh Offers</Text>
              </TouchableOpacity>
            )}

            {/* Quick Navigation Section */}
            <Text style={[styles.sectionHeading, { color: mutedColor }]}>QUICK NAVIGATION</Text>
            
            <View style={styles.quickGrid}>
              <TouchableOpacity
                style={[styles.quickTile, { backgroundColor: tileBg, borderColor: borderCol }]}
                onPress={() => {
                  handleClose();
                  router.push('/(tabs)/basket');
                }}
              >
                <Text style={{ fontSize: 18 }}>🛒</Text>
                <Text style={[styles.quickTileText, { color: textColor }]}>Basket ({cartCount})</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickTile, { backgroundColor: tileBg, borderColor: borderCol }]}
                onPress={() => {
                  handleClose();
                  onOpenPincodeModal();
                }}
              >
                <Text style={{ fontSize: 18 }}>📍</Text>
                <Text style={[styles.quickTileText, { color: textColor }]}>PIN Location</Text>
              </TouchableOpacity>
            </View>

            {isAdminOrStaff && (
              <TouchableOpacity
                style={[styles.adminTile, { backgroundColor: isDark ? '#271b05' : '#fef3c7', borderColor: '#f59e0b' }]}
                onPress={() => {
                  handleClose();
                  router.push('/admin');
                }}
              >
                <Text style={{ fontSize: 18 }}>🛡️</Text>
                <Text style={{ color: '#d97706', fontWeight: '900', fontSize: 13, flex: 1 }}>
                  {user?.isPrimaryAdmin ? 'Master Admin Control' : 'Sub-Admin Reconsiderations ↩️'}
                </Text>
                <Text style={{ color: '#d97706', fontWeight: 'bold' }}>→</Text>
              </TouchableOpacity>
            )}

            {/* Harvest Categories Section */}
            <Text style={[styles.sectionHeading, { color: mutedColor, marginTop: 18 }]}>EXPLORE HARVEST CATEGORIES</Text>

            <TouchableOpacity
              style={[
                styles.categoryRow,
                { backgroundColor: !selectedCategory ? activeTileBg : tileBg, borderColor: !selectedCategory ? '#10b981' : borderCol },
              ]}
              onPress={() => {
                onSelectCategory(null);
                handleClose();
              }}
            >
              <Text style={{ fontSize: 16 }}>🌿</Text>
              <Text style={[styles.categoryRowText, { color: textColor }, !selectedCategory && { fontWeight: '900', color: '#10b981' }]}>
                All Harvest Products
              </Text>
              {!selectedCategory && <Text style={{ color: '#10b981', fontWeight: '900' }}>✓</Text>}
            </TouchableOpacity>

            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.slug;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryRow,
                    { backgroundColor: isSelected ? activeTileBg : tileBg, borderColor: isSelected ? '#10b981' : borderCol },
                  ]}
                  onPress={() => {
                    onSelectCategory(cat.slug);
                    handleClose();
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{getCategoryEmoji(cat.slug, cat.name)}</Text>
                  <Text style={[styles.categoryRowText, { color: textColor }, isSelected && { fontWeight: '900', color: '#10b981' }]}>
                    {cat.name}
                  </Text>
                  {isSelected && <Text style={{ color: '#10b981', fontWeight: '900' }}>✓</Text>}
                </TouchableOpacity>
              );
            })}

            {/* Dark Mode & Theme Toggle Footer */}
            <View style={[styles.footerRow, { borderTopColor: borderCol }]}>
              <TouchableOpacity style={styles.themeToggleBtn} onPress={onToggleTheme}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: textColor }}>
                  {isDark ? '🌕 Dark Mode' : '☀️ Light Mode'}
                </Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 10, fontWeight: '700', color: mutedColor }}>v10.0.0</Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  drawerPanel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    borderRightWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandLeaf: {
    fontSize: 20,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '900',
  },
  scrollContent: {
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  userName: {
    fontSize: 14,
    fontWeight: '800',
  },
  loginBanner: {
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  loginBannerText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 12,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  quickTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickTileText: {
    fontSize: 12,
    fontWeight: '800',
  },
  adminTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  categoryRowText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  footerRow: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
});
