import { StorageService } from './storage';
import { Task, Reminder, HydrationLog, HydrationSettings, UserProfile } from '../types';

export const ApiService = {
  async getHeaders(): Promise<HeadersInit> {
    const profile = await StorageService.getUserProfile();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (profile?.token) {
      headers['Authorization'] = `Bearer ${profile.token}`;
    }
    return headers;
  },

  async login(email: string, password: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const serverUrl = await StorageService.getServerUrl();
      const res = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }
      const userProfile: UserProfile = {
        id: data.user?.id || 'user_1',
        name: data.user?.name || email.split('@')[0],
        email: email,
        token: data.token,
      };
      await StorageService.saveUserProfile(userProfile);
      return { success: true, user: userProfile };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error' };
    }
  },

  async register(name: string, email: string, password: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const serverUrl = await StorageService.getServerUrl();
      const res = await fetch(`${serverUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }
      const userProfile: UserProfile = {
        id: data.user?.id || 'user_1',
        name: name,
        email: email,
        token: data.token,
      };
      await StorageService.saveUserProfile(userProfile);
      return { success: true, user: userProfile };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error' };
    }
  },

  async syncTasks(): Promise<Task[]> {
    try {
      const serverUrl = await StorageService.getServerUrl();
      const headers = await this.getHeaders();
      const res = await fetch(`${serverUrl}/api/tasks`, { headers });
      if (res.ok) {
        const data = await res.json();
        const serverTasks: Task[] = (data.tasks || []).map((t: any) => ({
          id: String(t.id),
          title: t.title,
          notes: t.notes || '',
          priority: t.priority || 'medium',
          category: t.category || 'Personal',
          dueDate: t.due_date || t.dueDate,
          isCompleted: Boolean(t.is_completed ?? t.completed),
          subtasks: t.subtasks || [],
          createdAt: t.created_at || new Date().toISOString(),
          updatedAt: t.updated_at || new Date().toISOString(),
        }));
        await StorageService.saveTasks(serverTasks);
        return serverTasks;
      }
    } catch {
      // Offline fallback
    }
    return StorageService.getTasks();
  },

  async syncHydration(): Promise<{ logs: HydrationLog[]; settings: HydrationSettings }> {
    const localSettings = await StorageService.getHydrationSettings();
    const localLogs = await StorageService.getHydrationLogs();

    try {
      const serverUrl = await StorageService.getServerUrl();
      const headers = await this.getHeaders();
      const res = await fetch(`${serverUrl}/api/hydration/today`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.logs) {
          const mappedLogs: HydrationLog[] = data.logs.map((l: any) => ({
            id: String(l.id),
            amountMl: Number(l.amount_ml || l.amountMl),
            timestamp: l.timestamp || l.logged_at || new Date().toISOString(),
            label: l.label,
          }));
          await StorageService.saveHydrationLogs(mappedLogs);
          return { logs: mappedLogs, settings: localSettings };
        }
      }
    } catch {
      // Offline fallback
    }
    return { logs: localLogs, settings: localSettings };
  },
};
