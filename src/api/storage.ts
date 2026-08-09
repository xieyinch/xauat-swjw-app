import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY_USER = 'xauat:user';
const KEY_CREDENTIALS = 'xauat:credentials';

export interface StoredUser {
  stdNo: string;
  name: string;
}

export interface StoredCredentials {
  stdNo: string;
  password: string;
}

// 凭据走系统安全存储（Keychain/Keystore）；web 端回退 AsyncStorage
async function storeGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return AsyncStorage.getItem(key);
  }
}

async function storeSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

async function storeDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    await AsyncStorage.removeItem(key);
  }
}

export async function saveUser(user: StoredUser) {
  await storeSet(KEY_USER, JSON.stringify(user));
}

export async function loadUser(): Promise<StoredUser | null> {
  const raw = await storeGet(KEY_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export async function clearUser() {
  await storeDelete(KEY_USER);
}

export async function saveCredentials(creds: StoredCredentials) {
  await storeSet(KEY_CREDENTIALS, JSON.stringify(creds));
}

export async function loadCredentials(): Promise<StoredCredentials | null> {
  const raw = await storeGet(KEY_CREDENTIALS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredCredentials;
  } catch {
    return null;
  }
}

export async function clearCredentials() {
  await storeDelete(KEY_CREDENTIALS);
}
