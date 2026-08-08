import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_USER = 'xauat:user';

export interface StoredUser {
  stdNo: string;
  name: string;
}

export async function saveUser(user: StoredUser) {
  try {
    await AsyncStorage.setItem(KEY_USER, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export async function loadUser(): Promise<StoredUser | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_USER);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

export async function clearUser() {
  try {
    await AsyncStorage.removeItem(KEY_USER);
  } catch {
    // ignore
  }
}
