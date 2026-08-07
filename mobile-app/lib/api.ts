import axios, { type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../constants/config';
import { tokenStorage } from './storage';

export function resolveImgUrl(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Track refresh state to avoid infinite loops
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// Request interceptor — attach access token
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshToken = await tokenStorage.getRefreshToken();
          if (!refreshToken) throw new Error('No refresh token');
          const res = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken });
          const { accessToken, refreshToken: newRefresh } = res.data;
          await tokenStorage.saveAccessToken(accessToken);
          await tokenStorage.saveRefreshToken(newRefresh);
          isRefreshing = false;
          onRefreshed(accessToken);
          original.headers.Authorization = `Bearer ${accessToken}`;
          return api(original);
        } catch {
          isRefreshing = false;
          await tokenStorage.clearAll();
          // Signal auth failure — app will redirect to login
          return Promise.reject(new Error('SESSION_EXPIRED'));
        }
      }
      // Queue other requests while refreshing
      return new Promise((resolve) => {
        refreshSubscribers.push((token: string) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }
    return Promise.reject(error);
  }
);
