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
  // Synchronous instant initialization from localStorage (0ms delay on refresh)
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem("user") || localStorage.getItem("adminUser");
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(() => {
    const hasToken = typeof window !== "undefined" && Boolean(localStorage.getItem("accessToken") || localStorage.getItem("token"));
    const hasUser = typeof window !== "undefined" && Boolean(localStorage.getItem("user") || localStorage.getItem("adminUser"));
    return hasToken && !hasUser;
  });
  const [promotedCustomerStars, setPromotedCustomerStars] = useState<number | null>(null);
  const [promotedStaffInfo, setPromotedStaffInfo] = useState<{ stars: number; title: string; role: string } | null>(null);

  async function refresh() {
    try {
      const res = await apiRequest("GET", "/api/me");
      const data = await res.json();
      const newUser = data.user || null;

      if (newUser) {
        localStorage.setItem("user", JSON.stringify(newUser));
        if (newUser.role !== "customer") {
          localStorage.setItem("adminUser", JSON.stringify(newUser));
        }

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
      } else {
        localStorage.removeItem("user");
        localStorage.removeItem("adminUser");
      }

      setUser(newUser);
    } catch {
      // If network fails, preserve existing local user if token is still valid
    } finally {
      setLoading(false);
    }
  }

  // ========================================================
  // ⏱️ 2-HOUR CUSTOMER INACTIVITY AUTO-LOGOUT ENGINE
  // ========================================================
  const CUSTOMER_INACTIVITY_LIMIT_MS = 2 * 60 * 60 * 1000; // 2 hours (7,200,000 ms)

  useEffect(() => {
    // Check if user was previously inactive for > 2 hours before mounting
    const lastActive = Number(localStorage.getItem("customer_last_activity") || "0");
    const now = Date.now();

    if (lastActive > 0 && now - lastActive >= CUSTOMER_INACTIVITY_LIMIT_MS) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("adminUser");
      localStorage.removeItem("customer_last_activity");
      sessionStorage.clear();
      setUser(null);
      setLoading(false);
      return;
    }

    refresh();

    const onUserBlocked = () => {
      setUser((prev) => (prev ? { ...prev, status: "blocked" } : null));
    };

    window.addEventListener("farmfresh:user_blocked", onUserBlocked);

    // Initial activity stamp
    localStorage.setItem("customer_last_activity", String(now));

    let lastRecorded = now;
    const recordUserActivity = () => {
      const current = Date.now();
      if (current - lastRecorded > 15000) {
        lastRecorded = current;
        localStorage.setItem("customer_last_activity", String(current));
      }
    };

    window.addEventListener("mousemove", recordUserActivity, { passive: true });
    window.addEventListener("mousedown", recordUserActivity, { passive: true });
    window.addEventListener("keydown", recordUserActivity, { passive: true });
    window.addEventListener("scroll", recordUserActivity, { passive: true });
    window.addEventListener("touchstart", recordUserActivity, { passive: true });

    // Periodic check every 60 seconds (lightweight)
    const interval = setInterval(() => {
      const hasToken = localStorage.getItem("accessToken") || localStorage.getItem("token");
      const currentActivity = Number(localStorage.getItem("customer_last_activity") || String(Date.now()));

      if (hasToken && Date.now() - currentActivity >= CUSTOMER_INACTIVITY_LIMIT_MS) {
        // Expire session
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("adminUser");
        localStorage.removeItem("customer_last_activity");
        sessionStorage.clear();
        queryClient.invalidateQueries();
        setUser(null);
        try {
          fetch("/api/logout", { method: "POST", credentials: "include" }).catch(() => {});
        } catch {}
        return;
      }

      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (hasToken) {
        refresh();
      }
    }, 60000);

    return () => {
      window.removeEventListener("farmfresh:user_blocked", onUserBlocked);
      window.removeEventListener("mousemove", recordUserActivity);
      window.removeEventListener("mousedown", recordUserActivity);
      window.removeEventListener("keydown", recordUserActivity);
      window.removeEventListener("scroll", recordUserActivity);
      window.removeEventListener("touchstart", recordUserActivity);
      clearInterval(interval);
    };
  }, []);

  async function login(email: string, password: string, options?: { isStealthGateway?: boolean }) {
    const res = await apiRequest("POST", "/api/login", {
      email,
      password,
      isStealthGateway: options?.isStealthGateway,
    });
    const data = await res.json();
    if (data.require2fa || data.requirePasskey) {
      return data;
    }
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
    }
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
    localStorage.setItem("customer_last_activity", String(Date.now()));
    if (data.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
      if (data.user.role !== "customer") {
        localStorage.setItem("adminUser", JSON.stringify(data.user));
      }
    }
    setUser(data.user);
    return data.user as AuthUser;
  }

  async function register(payload: { name: string; email: string; password: string; phone?: string }) {
    const res = await apiRequest("POST", "/api/register", payload);
    const data = await res.json();
    localStorage.setItem("customer_last_activity", String(Date.now()));
    if (data.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
      if (data.user.role !== "customer") {
        localStorage.setItem("adminUser", JSON.stringify(data.user));
      }
    }
    setUser(data.user);
    return data.user as AuthUser;
  }

  async function logout() {
    // 1. Instant optimistic local teardown (0ms visual logout)
    setUser(null);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("customer_last_activity");
    sessionStorage.clear();
    queryClient.invalidateQueries();

    // 2. Fire backend session destroy in background
    try {
      fetch("/api/logout", { method: "POST", credentials: "include" }).catch(() => {});
    } catch {}
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
function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

function consolidateCartItems(rawItems: CartItem[]): CartItem[] {
  if (!Array.isArray(rawItems)) return [];
  const map = new Map<number, CartItem>();
  for (const item of rawItems) {
    if (!item || typeof item.productId !== "number" || isNaN(item.productId)) continue;
    const qty = Math.max(0, Math.floor(Number(item.qty) || 0));
    if (qty <= 0) continue;

    if (map.has(item.productId)) {
      const existing = map.get(item.productId)!;
      existing.qty += qty;
      if (item.price != null) existing.price = round2(item.price);
      if (item.name) existing.name = item.name;
    } else {
      map.set(item.productId, {
        ...item,
        price: round2(item.price),
        qty,
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
  const hasMergedUserRef = useRef<number | null>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      const clean = consolidateCartItems(items);
      localStorage.setItem("cartItems", JSON.stringify(clean));
    } catch {}
  }, [items]);

  // Real-time live price synchronizer: periodically updates cart items' prices from live products
  useEffect(() => {
    if (items.length === 0) return;
    let isCancelled = false;

    async function syncLivePrices() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const cachedProducts = queryClient.getQueryData<Product[]>(["/api/products"]);
        const productsList: Product[] = cachedProducts || await apiGet<Product[]>("/api/products");
        if (isCancelled || !Array.isArray(productsList)) return;

        setItems((currentItems) => {
          let hasPriceChanged = false;
          const updated = currentItems.map((item) => {
            const liveProd = productsList.find((p) => p.id === item.productId);
            if (!liveProd) return item;
            const livePrice = effectivePrice(Number(liveProd.price), Number(liveProd.discountPercent || 0));
            if (Math.abs(Number(item.price) - livePrice) > 0.01 || item.name !== liveProd.name) {
              hasPriceChanged = true;
              return {
                ...item,
                name: liveProd.name,
                price: livePrice,
                image: liveProd.image || item.image,
                unit: liveProd.unit || item.unit,
              };
            }
            return item;
          });

          return hasPriceChanged ? consolidateCartItems(updated) : currentItems;
        });
      } catch {}
    }

    const timer = setTimeout(syncLivePrices, 2000);
    const interval = setInterval(syncLivePrices, 60000);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [items.length]);

  // Helper to sync changes to DB for logged in user
  const syncToDb = (updatedItems: CartItem[]) => {
    if (user) {
      apiRequest("POST", "/api/cart", {
        items: updatedItems.map((i) => ({ productId: i.productId, qty: i.qty })),
      }).catch(() => {});
    }
  };

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
              const clean = consolidateCartItems(data.items);
              setItems(clean);
            }
          } else {
            const res = await apiRequest("GET", "/api/cart");
            const data = await res.json();
            if (!cancelled && Array.isArray(data.items)) {
              const clean = consolidateCartItems(data.items);
              setItems(clean);
            }
          }
        }
      } catch (err) {
        console.error("[Cart] DB sync error:", err);
      }
    }

    syncCartOnLogin();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  function add(product: Product, qty = 1) {
    lastLocalEditRef.current = Date.now();
    setItems((prev) => {
      const price = effectivePrice(Number(product.price), Number(product.discountPercent));
      const maxStock = Number(product.stock || 0) > 0 ? Number(product.stock) : 999;
      
      const existingItem = prev.find((i) => i.productId === product.id);
      const currentInCart = existingItem?.qty || 0;
      const availableToAdd = Math.max(0, maxStock - currentInCart);
      const targetAddQty = Math.min(availableToAdd, Math.max(1, qty));

      if (targetAddQty <= 0) return prev;

      let next: CartItem[];
      if (existingItem) {
        next = prev.map((i) =>
          i.productId === product.id ? { ...i, qty: i.qty + targetAddQty, price } : i
        );
      } else {
        next = [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            unit: product.unit,
            price,
            image: product.image,
            qty: targetAddQty,
          },
        ];
      }

      const consolidated = consolidateCartItems(next);
      syncToDb(consolidated);
      return consolidated;
    });
  }

  function setQty(productId: number, qty: number) {
    lastLocalEditRef.current = Date.now();
    setItems((prev) => {
      const targetQty = Math.max(0, Math.floor(qty));
      const nextRaw = targetQty <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, qty: targetQty } : i));
      const consolidated = consolidateCartItems(nextRaw);
      syncToDb(consolidated);
      return consolidated;
    });
  }

  function remove(productId: number) {
    lastLocalEditRef.current = Date.now();
    setItems((prev) => {
      const nextRaw = prev.filter((i) => i.productId !== productId);
      const consolidated = consolidateCartItems(nextRaw);
      syncToDb(consolidated);
      return consolidated;
    });
  }

  function clear() {
    lastLocalEditRef.current = Date.now();
    setItems([]);
    syncToDb([]);
  }

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = round2(items.reduce((s, i) => s + i.qty * i.price, 0));

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
