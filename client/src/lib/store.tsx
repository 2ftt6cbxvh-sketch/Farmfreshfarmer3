import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { apiRequest, queryClient } from "./queryClient";
import type { AuthUser, CartItem, Product } from "./types";
import { effectivePrice } from "./types";

import { StarPromotionOverlay } from "@/components/StarPromotionOverlay";
import { StaffPromotionOverlay } from "@/components/StaffPromotionOverlay";

/* ----------------------------- Auth ------------------------------ */
interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [promotedCustomerStars, setPromotedCustomerStars] = useState<number | null>(null);
  const [promotedStaffInfo, setPromotedStaffInfo] = useState<{ stars: number; title: string; role: string } | null>(null);

  async function refresh() {
    try {
      const res = await apiRequest("GET", "/api/me");
      const data = await res.json();
      const newUser = data.user || null;

      if (newUser) {
        if (newUser.role === "customer") {
          const newStars = newUser.customerStars ?? 0;
          const storedKey = `seen_star_level_${newUser.id}`;
          const prevStars = Number(localStorage.getItem(storedKey) ?? "-1");

          // Trigger celebration overlay when customer star level increases
          if (prevStars !== -1 && newStars > prevStars && newStars > 0) {
            setPromotedCustomerStars(newStars);
          }
          localStorage.setItem(storedKey, String(newStars));
        } else if (!newUser.isPrimaryAdmin && newUser.email?.toLowerCase() !== "admin@farmfreshfarmer.com") {
          // Sub-admin & staff promotion check
          const currentStars = newUser.starRating || 5;
          const currentTitle = newUser.customTitle || newUser.experienceRank || "Sub-Admin Specialist";
          const storedStarKey = `seen_staff_stars_${newUser.id}`;
          const prevStars = Number(localStorage.getItem(storedStarKey) ?? "-1");

          if (prevStars !== -1 && currentStars > prevStars) {
            setPromotedStaffInfo({
              stars: currentStars,
              title: currentTitle,
              role: newUser.role,
            });
          }
          localStorage.setItem(storedStarKey, String(currentStars));
        }
      }

      setUser(newUser);
      if (newUser && newUser.role !== "customer") {
        localStorage.setItem("adminUser", JSON.stringify(newUser));
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();

    const onUserBlocked = () => {
      setUser((prev) => (prev ? { ...prev, status: "blocked" } : null));
    };

    window.addEventListener("farmfresh:user_blocked", onUserBlocked);

    // Poll /api/me periodically when tab is visible (every 4s for instant status sync)
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (localStorage.getItem("accessToken") || localStorage.getItem("token")) {
        refresh();
      }
    }, 4000);

    return () => {
      window.removeEventListener("farmfresh:user_blocked", onUserBlocked);
      clearInterval(interval);
    };
  }, []);

  async function login(email: string, password: string) {
    const res = await apiRequest("POST", "/api/login", { email, password });
    const data = await res.json();
    if (data.require2fa) {
      return data;
    }
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
    }
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
    setUser(data.user);
    if (data.user && data.user.role !== "customer") {
      localStorage.setItem("adminUser", JSON.stringify(data.user));
    }
    return data.user as AuthUser;
  }

  async function register(payload: { name: string; email: string; password: string; phone?: string }) {
    const res = await apiRequest("POST", "/api/register", payload);
    const data = await res.json();
    setUser(data.user);
    if (data.user && data.user.role !== "customer") {
      localStorage.setItem("adminUser", JSON.stringify(data.user));
    }
    return data.user as AuthUser;
  }


  async function logout() {
    try {
      await apiRequest("POST", "/api/logout");
    } catch (e) {
      console.warn("[logout] API error:", e);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      queryClient.clear();
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, setUser }}>
      {promotedCustomerStars !== null && (
        <StarPromotionOverlay stars={promotedCustomerStars} onClose={() => setPromotedCustomerStars(null)} />
      )}
      {promotedStaffInfo !== null && (
        <StaffPromotionOverlay
          stars={promotedStaffInfo.stars}
          title={promotedStaffInfo.title}
          role={promotedStaffInfo.role}
          onClose={() => setPromotedStaffInfo(null)}
        />
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/* ----------------------------- Cart ------------------------------ */
function consolidateCartItems(rawItems: CartItem[]): CartItem[] {
  if (!Array.isArray(rawItems)) return [];
  const map = new Map<number, CartItem>();
  for (const item of rawItems) {
    if (!item || typeof item.productId !== "number" || isNaN(item.productId)) continue;
    if (map.has(item.productId)) {
      const existing = map.get(item.productId)!;
      existing.qty += Number(item.qty) || 0;
      if (item.price) existing.price = item.price;
      if (item.name) existing.name = item.name;
    } else {
      map.set(item.productId, {
        ...item,
        qty: Number(item.qty) || 0,
      });
    }
  }
  return Array.from(map.values()).filter((i) => i.qty > 0);
}

interface CartContextType {
  items: CartItem[];
  add: (product: Product, qty?: number) => void;
  setQty: (productId: number, qty: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("cartItems") || "[]");
      return consolidateCartItems(raw);
    } catch {
      return [];
    }
  });
  const { user } = useAuth();
  const lastLocalEditRef = useRef<number>(0);
  const deletedProductIdsRef = useRef<Set<number>>(new Set());
  const hasMergedUserRef = useRef<number | null>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      const clean = consolidateCartItems(items).filter((i) => !deletedProductIdsRef.current.has(i.productId));
      localStorage.setItem("cartItems", JSON.stringify(clean));
    } catch {}
  }, [items]);

  // Fetch / merge cart on user login
  useEffect(() => {
    if (!user) {
      hasMergedUserRef.current = null;
      return;
    }
    let cancelled = false;

    async function syncCartOnLogin() {
      try {
        if (hasMergedUserRef.current !== user.id) {
          hasMergedUserRef.current = user.id;
          if (items.length > 0) {
            const res = await apiRequest("POST", "/api/cart/merge", {
              items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
            });
            const data = await res.json();
            if (!cancelled && Array.isArray(data.items)) {
              const clean = consolidateCartItems(data.items).filter((i) => !deletedProductIdsRef.current.has(i.productId));
              setItems(clean);
            }
          } else {
            const res = await apiRequest("GET", "/api/cart");
            const data = await res.json();
            if (!cancelled && Array.isArray(data.items)) {
              const clean = consolidateCartItems(data.items).filter((i) => !deletedProductIdsRef.current.has(i.productId));
              setItems(clean);
            }
          }
        }
      } catch (err) {
        console.error("[Cart] DB sync error:", err);
      }
    }

    syncCartOnLogin();

    // Poll /api/cart when tab is visible to prevent unnecessary CPU load
    const interval = setInterval(async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      // Avoid overwriting state if user edited cart locally within last 5 seconds
      if (user && !cancelled && Date.now() - lastLocalEditRef.current > 5000) {
        try {
          const res = await apiRequest("GET", "/api/cart");
          const data = await res.json();
          if (!cancelled && Array.isArray(data.items)) {
            const clean = consolidateCartItems(data.items).filter((i) => !deletedProductIdsRef.current.has(i.productId));
            if (clean.length > 0 || items.length === 0) {
              setItems(clean);
            }
          }
        } catch {}
      }
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.id]);

  // Helper to sync changes to DB for logged in user
  const syncToDb = (updatedItems: CartItem[]) => {
    if (user) {
      apiRequest("POST", "/api/cart", {
        items: updatedItems.map((i) => ({ productId: i.productId, qty: i.qty })),
      }).catch(() => {});
    }
  };

  function add(product: Product, qty = 1) {
    lastLocalEditRef.current = Date.now();
    deletedProductIdsRef.current.delete(product.id);
    setItems((prev) => {
      const price = effectivePrice(Number(product.price), Number(product.discountPercent));
      const maxStock = Number(product.stock || 0);
      const targetAddQty = Math.min(maxStock > 0 ? maxStock : 999, qty);
      if (targetAddQty <= 0) return prev;

      const newRawItem: CartItem = {
        productId: product.id,
        name: product.name,
        unit: product.unit,
        price,
        image: product.image,
        qty: targetAddQty,
      };

      const consolidated = consolidateCartItems([...prev, newRawItem]).filter((i) => !deletedProductIdsRef.current.has(i.productId));
      syncToDb(consolidated);
      return consolidated;
    });
  }

  function setQty(productId: number, qty: number) {
    lastLocalEditRef.current = Date.now();
    if (qty <= 0) {
      deletedProductIdsRef.current.add(productId);
    }
    setItems((prev) => {
      const nextRaw = qty <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, qty } : i));
      const consolidated = consolidateCartItems(nextRaw).filter((i) => !deletedProductIdsRef.current.has(i.productId));
      syncToDb(consolidated);
      return consolidated;
    });
  }

  function remove(productId: number) {
    lastLocalEditRef.current = Date.now();
    deletedProductIdsRef.current.add(productId);
    setItems((prev) => {
      const nextRaw = prev.filter((i) => i.productId !== productId);
      const consolidated = consolidateCartItems(nextRaw).filter((i) => !deletedProductIdsRef.current.has(i.productId));
      syncToDb(consolidated);
      return consolidated;
    });
  }

  function clear() {
    lastLocalEditRef.current = Date.now();
    items.forEach((i) => deletedProductIdsRef.current.add(i.productId));
    setItems([]);
    syncToDb([]);
  }

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <CartContext.Provider value={{ items, add, setQty, remove, clear, count, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
