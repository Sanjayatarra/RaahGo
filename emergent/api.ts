import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const KEY = 'ridenow.token';

export async function saveToken(t: string) {
  if (Platform.OS === 'web') await AsyncStorage.setItem(KEY, t);
  else await SecureStore.setItemAsync(KEY, t);
}
export async function loadToken() {
  if (Platform.OS === 'web') return AsyncStorage.getItem(KEY);
  return SecureStore.getItemAsync(KEY);
}
export async function clearToken() {
  if (Platform.OS === 'web') await AsyncStorage.removeItem(KEY);
  else await SecureStore.deleteItemAsync(KEY);
}

export async function api(path: string, opts: RequestInit = {}) {
  const token = await loadToken();
  const headers: any = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
  return data;
}