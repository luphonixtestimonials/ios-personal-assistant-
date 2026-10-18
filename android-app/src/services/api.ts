import { StorageService } from './storage';
import { Task, Reminder, HydrationLog, HydrationSettings, UserProfile, Friend } from '../types';

async function parseApiResponse(res: Response): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  try {
    const text = await res.text();
    if (!text || !text.trim()) {
      return { ok: res.ok, status: res.status, error: res.ok ? undefined : `HTTP ${res.status}` };
    }
    try {
      const json = JSON.parse(text);
      return { ok: res.ok, status: res.status, data: json };
    } catch {
      // Plain text or HTML error page from web server / edge
      const cleanSnippet = text.replace(/<[^>]*>?/gm, '').trim().slice(0, 150);
      return {
        ok: false,
        status: res.status,
        error: cleanSnippet || `Server error (${res.status})`,
      };
    }
  } catch (err: any) {
    return { ok: false, status: 0, error: err.message || 'Network request failed' };
  }
}

export const ApiService = {
  async getHeaders(): Promise<HeadersInit> {
    const profile = await StorageService.getUserProfile();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (profile?.token) {
      headers['Authorization'] = `Bearer ${profile.token}`;
    }
    return headers;
  },

  async login(email: string, password: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const serverUrl = await StorageService.getServerUrl();
      const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const parsed = await parseApiResponse(res);
      if (!parsed.ok || !parsed.data) {
        return { success: false, error: parsed.error || parsed.data?.error || 'Login failed' };
      }

      const responseData = parsed.data.data || parsed.data;
      if (parsed.data.success === false) {
        return { success: false, error: parsed.data.error || 'Invalid credentials' };
      }

      const userProfile: UserProfile = {
        id: String(responseData.user?.id || 'user_1'),
        name: responseData.user?.name || email.split('@')[0],
        username: responseData.user?.username || email.split('@')[0],
        email: responseData.user?.email || email.trim(),
        token: responseData.token,
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
      const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });

      const parsed = await parseApiResponse(res);
      if (!parsed.ok || !parsed.data) {
        return { success: false, error: parsed.error || parsed.data?.error || 'Registration failed' };
      }

      if (parsed.data.success === false) {
        return { success: false, error: parsed.data.error || 'Registration failed' };
      }

      const responseData = parsed.data.data || parsed.data;
      const userProfile: UserProfile = {
        id: String(responseData.user?.id || 'user_1'),
        name: responseData.user?.name || name.trim(),
        username: responseData.user?.username || email.split('@')[0],
        email: responseData.user?.email || email.trim(),
        token: responseData.token,
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
      const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
      const headers = await this.getHeaders();
      const res = await fetch(`${cleanUrl}/api/tasks`, { headers });
      const parsed = await parseApiResponse(res);

      if (parsed.ok && parsed.data) {
        const tasksList = parsed.data.data || parsed.data.tasks || [];
        if (Array.isArray(tasksList)) {
          const serverTasks: Task[] = tasksList.map((t: any) => ({
            id: String(t.id),
            title: t.title,
            notes: t.description || t.notes || '',
            priority: t.priority || 'medium',
            category: t.category || 'Personal',
            dueDate: t.due_at || t.due_date || t.dueDate,
            isCompleted: Boolean(t.is_completed ?? t.completed),
            subtasks: t.subtasks || [],
            assignedToUserId: t.assigned_to_user_id || undefined,
            assignedByUserId: t.assigned_by_user_id || undefined,
            assignedToUsername: t.assigned_to_username || t.assignee_username || undefined,
            assignedByUsername: t.assigned_by_username || t.assigner_username || undefined,
            createdAt: t.created_at || new Date().toISOString(),
            updatedAt: t.updated_at || new Date().toISOString(),
          }));
          await StorageService.saveTasks(serverTasks);
          return serverTasks;
        }
      }
    } catch {
      // Offline fallback
    }
    return StorageService.getTasks();
  },

  async createTask(task: Partial<Task> & { assigned_to_username?: string }): Promise<{ success: boolean; task?: Task; error?: string }> {
    try {
      const serverUrl = await StorageService.getServerUrl();
      const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
      const headers = await this.getHeaders();
      const body: any = {
        title: task.title,
        description: task.notes || null,
        priority: task.priority || 'medium',
        category: (task.category || 'Personal').toLowerCase(),
        due_at: task.dueDate || null,
      };
      if (task.assignedToUsername || task.assigned_to_username) {
        body.assigned_to_username = task.assignedToUsername || task.assigned_to_username;
      }
      if (task.assignedToUserId) {
        body.assigned_to_user_id = task.assignedToUserId;
      }

      const res = await fetch(`${cleanUrl}/api/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const parsed = await parseApiResponse(res);
      if (parsed.ok && parsed.data) {
        const t = parsed.data.data || parsed.data;
        const createdTask: Task = {
          id: String(t.id),
          title: t.title,
          notes: t.description || t.notes || '',
          priority: t.priority || 'medium',
          category: t.category || 'Personal',
          dueDate: t.due_at || t.due_date,
          isCompleted: Boolean(t.is_completed),
          subtasks: t.subtasks || [],
          assignedToUserId: t.assigned_to_user_id || undefined,
          assignedByUserId: t.assigned_by_user_id || undefined,
          assignedToUsername: t.assigned_to_username || t.assignee_username || undefined,
          assignedByUsername: t.assigned_by_username || t.assigner_username || undefined,
          createdAt: t.created_at || new Date().toISOString(),
          updatedAt: t.updated_at || new Date().toISOString(),
        };
        return { success: true, task: createdTask };
      }
      return { success: false, error: parsed.error || 'Failed to create task' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error' };
    }
  },

  async syncHydration(): Promise<{ logs: HydrationLog[]; settings: HydrationSettings }> {
    const localSettings = await StorageService.getHydrationSettings();
    const localLogs = await StorageService.getHydrationLogs();

    try {
      const serverUrl = await StorageService.getServerUrl();
      const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
      const headers = await this.getHeaders();
      const res = await fetch(`${cleanUrl}/api/hydration/today`, { headers });
      const parsed = await parseApiResponse(res);

      if (parsed.ok && parsed.data) {
        const dataObj = parsed.data.data || parsed.data;
        if (dataObj.logs && Array.isArray(dataObj.logs)) {
          const mappedLogs: HydrationLog[] = dataObj.logs.map((l: any) => ({
            id: String(l.id),
            amountMl: Number(l.amount_ml || l.amountMl),
            timestamp: l.logged_at || l.timestamp || new Date().toISOString(),
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

  async getFriends(): Promise<Friend[]> {
    try {
      const serverUrl = await StorageService.getServerUrl();
      const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
      const headers = await this.getHeaders();
      const res = await fetch(`${cleanUrl}/api/friends`, { headers });
      const parsed = await parseApiResponse(res);
      if (parsed.ok && parsed.data) {
        const friendsList = parsed.data.data || parsed.data.friends || [];
        if (Array.isArray(friendsList)) {
          const mapped: Friend[] = friendsList.map((f: any) => ({
            id: String(f.id),
            friendshipId: f.friendship_id,
            name: f.name,
            username: f.username || String(f.email).split('@')[0],
            email: f.email,
            connectedAt: f.connected_at,
          }));
          await StorageService.saveFriends(mapped);
          return mapped;
        }
      }
    } catch {
      // fallback to cached
    }
    return StorageService.getFriends();
  },

  async addFriend(username: string): Promise<{ success: boolean; friend?: Friend; error?: string }> {
    try {
      const serverUrl = await StorageService.getServerUrl();
      const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
      const headers = await this.getHeaders();
      const res = await fetch(`${cleanUrl}/api/friends/add`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ username: username.trim() }),
      });
      const parsed = await parseApiResponse(res);
      if (!parsed.ok || !parsed.data) {
        return { success: false, error: parsed.error || parsed.data?.error || 'Failed to add friend' };
      }
      if (parsed.data.success === false) {
        return { success: false, error: parsed.data.error || 'Could not find user' };
      }
      const f = parsed.data.data || parsed.data.friend;
      const friend: Friend = {
        id: String(f.id),
        name: f.name,
        username: f.username || username.trim(),
        email: f.email,
      };
      const currentFriends = await StorageService.getFriends();
      if (!currentFriends.some((cf) => cf.id === friend.id)) {
        await StorageService.saveFriends([...currentFriends, friend]);
      }
      return { success: true, friend };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error' };
    }
  },

  async removeFriend(friendId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const serverUrl = await StorageService.getServerUrl();
      const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
      const headers = await this.getHeaders();
      const res = await fetch(`${cleanUrl}/api/friends/${friendId}`, {
        method: 'DELETE',
        headers,
      });
      const parsed = await parseApiResponse(res);
      if (parsed.ok) {
        const current = await StorageService.getFriends();
        await StorageService.saveFriends(current.filter((f) => f.id !== friendId));
        return { success: true };
      }
      return { success: false, error: parsed.error || 'Failed to remove friend' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error' };
    }
  },
};
