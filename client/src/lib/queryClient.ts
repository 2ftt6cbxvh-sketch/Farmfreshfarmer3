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
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

// GET helper that respects API_BASE (use in custom queryFns instead of raw fetch)
export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, { credentials: "include" });
  await throwIfResNotOk(res);
  return (await res.json()) as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, {
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
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
