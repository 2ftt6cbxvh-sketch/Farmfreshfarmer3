import { QueryClient, QueryFunction } from "@tanstack/react-query";

export const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

const PRODUCT_ACCURATE_IMAGE_MAP: Record<string, string> = {
  // Fruits (Specific multi-word names first)
  "custard apple": "/images/produce/custard-apple.jpg",
  "sitaphal": "/images/produce/custard-apple.jpg",
  "seethaphal": "/images/produce/custard-apple.jpg",
  "pomegranate": "/images/produce/pomegranate.jpg",
  "danimma": "/images/produce/pomegranate.jpg",
  "dragon fruit": "/images/produce/dragon-fruit.jpg",
  "alphonso mango": "/images/p-mango.jpg",
  "mango": "/images/p-mango.jpg",
  "mamidi": "/images/p-mango.jpg",
  "papaya": "/images/produce/papaya.jpg",
  "boppayi": "/images/produce/papaya.jpg",
  "pineapple": "/images/produce/pineapple.jpg",
  "anasa": "/images/produce/pineapple.jpg",
  "muskmelon": "/images/produce/muskmelon.jpg",
  "kharbuja": "/images/produce/muskmelon.jpg",
  "guava": "/images/produce/guava.jpg",
  "jamakaya": "/images/produce/guava.jpg",
  "orange": "/images/produce/orange.jpg",
  "narinja": "/images/produce/orange.jpg",
  "santra": "/images/produce/orange.jpg",
  "seedless grapes": "/images/produce/grapes.jpg",
  "grapes": "/images/produce/grapes.jpg",
  "draksha": "/images/produce/grapes.jpg",
  "sweet bananas": "/images/produce/bananas.jpg",
  "bananas": "/images/produce/bananas.jpg",
  "banana": "/images/produce/bananas.jpg",
  "arati": "/images/produce/bananas.jpg",

  // Vegetables
  "farm tomatoes": "/images/produce/tomatoes.jpg",
  "tomatoes": "/images/produce/tomatoes.jpg",
  "tomato": "/images/produce/tomatoes.jpg",
  "tamota": "/images/produce/tomatoes.jpg",
  "carrots": "/images/produce/carrots.jpg",
  "carrot": "/images/produce/carrots.jpg",
  "kyarettu": "/images/produce/carrots.jpg",
  "bottle gourd": "/images/produce/bottlegourd.jpg",
  "bottlegourd": "/images/produce/bottlegourd.jpg",
  "sorakaya": "/images/produce/bottlegourd.jpg",
  "bitter gourd": "/images/produce/bitter-gourd.jpg",
  "kakarakaya": "/images/produce/bitter-gourd.jpg",
  "ridge gourd": "/images/produce/ridge-gourd.jpg",
  "beerakaya": "/images/produce/ridge-gourd.jpg",
  "tindora": "/images/produce/tindora.jpg",
  "dondakaya": "/images/produce/tindora.jpg",
  "purple brinjal": "/images/produce/purple-brinjal.jpg",
  "green brinjal": "/images/produce/green-brinjal.jpg",
  "brinjal": "/images/produce/purple-brinjal.jpg",
  "vankaya": "/images/produce/purple-brinjal.jpg",
  "green chilli": "/images/produce/green-chilli.jpg",
  "mirchi": "/images/produce/green-chilli.jpg",
  "garlic": "/images/produce/garlic.jpg",
  "vellulli": "/images/produce/garlic.jpg",
  "ginger": "/images/produce/ginger.jpg",
  "allam": "/images/produce/ginger.jpg",
  "weekly fresh box": "/images/produce/weekly-fresh-box.jpg",

  // Spices & Powders
  "turmeric powder": "/images/produce/turmeric-powder.jpg",
  "turmeric": "/images/produce/turmeric-powder.jpg",
  "pasupu": "/images/produce/turmeric-powder.jpg",
  "red chilli powder": "/images/produce/red-chilli-powder.jpg",
  "chilli powder": "/images/produce/red-chilli-powder.jpg",
  "karam": "/images/produce/red-chilli-powder.jpg",
  "coriander powder": "/images/produce/coriander-powder.jpg",
  "dhaniyala": "/images/produce/coriander-powder.jpg",

  // Pulses & Dals
  "toor dal": "/images/produce/toor-dal.jpg",
  "kandi pappu": "/images/produce/toor-dal.jpg",
  "kandi": "/images/produce/toor-dal.jpg",
  "moong dal": "/images/produce/moong-dal.jpg",
  "pesara pappu": "/images/produce/moong-dal.jpg",
  "pesara": "/images/produce/moong-dal.jpg",
  "chana dal": "/images/produce/chana-dal.jpg",
  "senagapappu": "/images/produce/chana-dal.jpg",
  "senaga": "/images/produce/chana-dal.jpg",

  // Millets
  "foxtail millet": "/images/produce/foxtail-millet.jpg",
  "korralu": "/images/produce/foxtail-millet.jpg",
  "korra": "/images/produce/foxtail-millet.jpg",
  "pearl millet": "/images/produce/pearl-millet.jpg",
  "sajjalu": "/images/produce/pearl-millet.jpg",
  "bajra": "/images/produce/pearl-millet.jpg",
  "finger millet": "/images/produce/finger-millet.jpg",
  "ragi": "/images/produce/finger-millet.jpg",
  "ragulu": "/images/produce/finger-millet.jpg",

  // Pickles (Veg & Non-Veg)
  "mango pickle": "/images/produce/mango-pickle.jpg",
  "avakaya": "/images/produce/mango-pickle.jpg",
  "lemon pickle": "/images/produce/lemon-pickle.jpg",
  "nimmakaya": "/images/produce/lemon-pickle.jpg",
  "gongura pickle": "/images/produce/gongura-pickle.jpg",
  "gongura": "/images/produce/gongura-pickle.jpg",
  "chicken pickle": "/images/produce/chicken-pickle.jpg",
  "mutton pickle": "/images/produce/mutton-pickle.jpg",
  "prawn pickle": "/images/produce/prawn-pickle.jpg",
  "royyala": "/images/produce/prawn-pickle.jpg",

  // Sweets & Namkeen
  "boondi laddu": "/images/p-laddu.jpg",
  "laddu": "/images/p-laddu.jpg",
  "kaju katli": "/images/produce/kaju-katli.jpg",
  "mysore pak": "/images/produce/mysore-pak.jpg",
  "special mixture": "/images/p-mixture.jpg",
  "mixture": "/images/p-mixture.jpg",
  "murukku": "/images/produce/murukku.jpg",
  "janthikalu": "/images/produce/murukku.jpg",
};

// Resolve an image path so it works both locally and after deployment.
export function imgUrl(src?: string | null, productName?: string): string {
  if (productName) {
    const norm = productName.toLowerCase().trim();
    // Sort keys by length descending so "custard apple" matches before "apple"
    const sortedKeys = Object.keys(PRODUCT_ACCURATE_IMAGE_MAP).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (norm.includes(key)) {
        return PRODUCT_ACCURATE_IMAGE_MAP[key];
      }
    }
  }

  if (!src) return "/images/produce/weekly-fresh-box.jpg";

  // If pointing to a generic category fallback, check if we can map by product name or replace
  if (src.includes("cat-spices.jpg")) return "/images/produce/turmeric-powder.jpg";
  if (src.includes("cat-pulses.jpg")) return "/images/produce/toor-dal.jpg";
  if (src.includes("cat-millets.jpg")) return "/images/produce/foxtail-millet.jpg";
  if (src.includes("cat-pickle-nonveg.jpg")) return "/images/produce/chicken-pickle.jpg";
  if (src.includes("cat-pickle-veg.jpg")) return "/images/produce/mango-pickle.jpg";
  if (src.includes("cat-sweets.jpg")) return "/images/produce/mysore-pak.jpg";
  if (src.includes("cat-namkeen.jpg")) return "/images/produce/murukku.jpg";
  if (src.includes("cat-fruits.jpg")) return "/images/produce/pomegranate.jpg";
  if (src.includes("cat-vegetables.jpg")) return "/images/produce/weekly-fresh-box.jpg";

  if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  const path = src.startsWith("/") ? src : `/${src}`;
  return `${API_BASE}${path}`;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let text = (await res.text()) || res.statusText;
    if (res.status === 403 && (text.includes("blocked") || text.includes("suspended") || text.includes("Account is blocked"))) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("farmfresh:user_blocked"));
      }
    }
    if (res.status === 503 && typeof window !== "undefined") {
      try {
        const parsed = JSON.parse(text);
        if (parsed.maintenance) {
          try {
            localStorage.setItem("farmfresh_maintenance_state", JSON.stringify(parsed));
          } catch {}
          window.dispatchEvent(new CustomEvent("farmfresh:maintenance_active", { detail: parsed }));
        }
      } catch {}
    }
    if (text.includes("<html") || text.includes("<!DOCTYPE") || text.includes("cf-error")) {
      if (res.status === 504) text = "Gateway Timeout: Server took too long to respond. Please try again.";
      else if (res.status === 502) text = "Bad Gateway: Backend service restarting. Please retry in a moment.";
      else text = `Server Error (${res.status}): Please try again.`;
    }
    throw new Error(`${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (sessionStorage.getItem("admin_mfa_verified") === "true") {
    headers["X-Admin-MFA-Verified"] = "true";
  }

  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

export async function apiGet<T>(url: string): Promise<T> {
  const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (sessionStorage.getItem("admin_mfa_verified") === "true" || localStorage.getItem("adminUser")) {
    headers["X-Admin-MFA-Verified"] = "true";
  }

  const res = await fetch(`${API_BASE}${url}`, { headers, credentials: "include" });
  await throwIfResNotOk(res);
  return (await res.json()) as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    if (sessionStorage.getItem("admin_mfa_verified") === "true" || localStorage.getItem("adminUser")) {
      headers["X-Admin-MFA-Verified"] = "true";
    }

    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      staleTime: 5 * 60 * 1000, // 5 minutes in-memory caching for ultra-fast instant page navigation
      gcTime: 30 * 60 * 1000, // 30 minutes garbage collection time
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});
