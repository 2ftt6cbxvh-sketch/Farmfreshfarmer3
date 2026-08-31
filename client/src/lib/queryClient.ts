import { QueryClient, QueryFunction } from "@tanstack/react-query";

export const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// Resolve an image path so it works both locally and after deployment.
// Local served images live at /images/... ; after deploy they are served
// through the same backend proxy as the API (API_BASE). Data URLs (uploaded
// images stored as base64) and absolute http(s) URLs are returned unchanged.
export function imgUrl(src?: string | null): string {
  if (!src) return "";
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
