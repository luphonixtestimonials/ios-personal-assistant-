export type Priority = 'low' | 'medium' | 'high';

export type TaskCategory = 'Work' | 'Personal' | 'Health' | 'Study' | 'Other';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  priority: Priority;
  category: TaskCategory;
  dueDate?: string; // ISO string
  isCompleted: boolean;
  completedAt?: string;
  subtasks: Subtask[];
  assignedToUserId?: string;
  assignedByUserId?: string;
  assignedToUsername?: string;
  assignedByUsername?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReminderRecurrence = 'none' | 'daily' | 'weekly' | 'weekdays';

export interface Reminder {
  id: string;
  title: string;
  notes?: string;
  time: string; // ISO string or time string e.g. "20:00"
  recurrence: ReminderRecurrence;
  category: TaskCategory;
  isActive: boolean;
  createdAt: string;
}

export interface HydrationLog {
  id: string;
  amountMl: number;
  timestamp: string; // ISO string
  label?: string;
}

export interface HydrationSettings {
  goalMl: number;
  intervalMinutes: number; // 30, 60, 90, 120
  wakeTime: string; // "07:00"
  sleepTime: string; // "22:00"
  remindersEnabled: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  username?: string;
  email: string;
  token?: string;
}

export interface Friend {
  id: string;
  friendshipId?: string;
  name: string;
  username: string;
  email: string;
  connectedAt?: string;
}

export interface AppNotification {
  id: string;
  userId?: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  type?: 'general' | 'task_assigned' | 'hydration' | 'reminder' | 'test_notification' | string;
  isRead: boolean;
  createdAt: string;
}


