import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'fff_refresh_token';
const ACCESS_TOKEN_KEY = 'fff_access_token';

export const tokenStorage = {
  async saveRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },
  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },
  async clearRefreshToken(): Promise<void> {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
  async saveAccessToken(token: string): Promise<void> {
    // Access token stored in memory-backed SecureStore (short TTL)
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  },
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },
  async clearAll(): Promise<void> {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  },
};
