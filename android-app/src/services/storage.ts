import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task, Reminder, HydrationLog, HydrationSettings, UserProfile } from '../types';

const STORAGE_KEYS = {
  TASKS: '@luphonix_tasks',
  REMINDERS: '@luphonix_reminders',
  HYDRATION_LOGS: '@luphonix_hydration_logs',
  HYDRATION_SETTINGS: '@luphonix_hydration_settings',
  USER_PROFILE: '@luphonix_user_profile',
  SERVER_URL: '@luphonix_server_url',
};

const DEFAULT_HYDRATION_SETTINGS: HydrationSettings = {
  goalMl: 2000,
  intervalMinutes: 60,
  wakeTime: '07:00',
  sleepTime: '22:00',
  remindersEnabled: true,
};

export const StorageService = {
  async getTasks(): Promise<Task[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TASKS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch (e) {
      console.error('Failed to save tasks', e);
    }
  },

  async getReminders(): Promise<Reminder[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.REMINDERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async saveReminders(reminders: Reminder[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(reminders));
    } catch (e) {
      console.error('Failed to save reminders', e);
    }
  },

  async getHydrationLogs(): Promise<HydrationLog[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.HYDRATION_LOGS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async saveHydrationLogs(logs: HydrationLog[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HYDRATION_LOGS, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save hydration logs', e);
    }
  },

  async getHydrationSettings(): Promise<HydrationSettings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.HYDRATION_SETTINGS);
      return data ? { ...DEFAULT_HYDRATION_SETTINGS, ...JSON.parse(data) } : DEFAULT_HYDRATION_SETTINGS;
    } catch {
      return DEFAULT_HYDRATION_SETTINGS;
    }
  },

  async saveHydrationSettings(settings: HydrationSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HYDRATION_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save hydration settings', e);
    }
  },

  async getUserProfile(): Promise<UserProfile | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async saveUserProfile(profile: UserProfile | null): Promise<void> {
    try {
      if (profile) {
        await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
      }
    } catch (e) {
      console.error('Failed to save user profile', e);
    }
  },

  async getServerUrl(): Promise<string> {
    try {
      const url = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
      return url || 'https://luphonix.vercel.app';
    } catch {
      return 'https://luphonix.vercel.app';
    }
  },

  async saveServerUrl(url: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, url);
    } catch (e) {
      console.error('Failed to save server URL', e);
    }
  },
};
