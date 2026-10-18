import * as Speech from 'expo-speech';
import { StorageService } from './storage';
import { Task, Reminder, HydrationLog } from '../types';
import { NotificationService } from './notifications';

export interface VoiceActionResult {
  action: 'add_task' | 'add_reminder' | 'log_water' | 'list_tasks' | 'water_status' | 'unknown';
  message: string;
  data?: any;
}

export const VoiceAssistantService = {
  async speak(text: string): Promise<void> {
    try {
      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 1.0,
      });
    } catch (e) {
      console.warn('Speech error', e);
    }
  },

  async processCommand(query: string): Promise<VoiceActionResult> {
    const q = query.trim().toLowerCase();

    // 1. Water Logging: "log 250 ml of water", "drink 500ml water", "drank 300 ml"
    const waterMatch = q.match(/(?:log|drink|drank|add)\s+(\d+)\s*(?:ml)?\s*(?:of\s+)?water/);
    if (waterMatch) {
      const amount = parseInt(waterMatch[1], 10);
      const logs = await StorageService.getHydrationLogs();
      const newLog: HydrationLog = {
        id: Date.now().toString(),
        amountMl: amount,
        timestamp: new Date().toISOString(),
        label: 'Voice Log',
      };
      logs.unshift(newLog);
      await StorageService.saveHydrationLogs(logs);

      // Total today
      const todayStr = new Date().toDateString();
      const totalToday = logs
        .filter((l) => new Date(l.timestamp).toDateString() === todayStr)
        .reduce((sum, l) => sum + l.amountMl, 0);

      const msg = `Logged ${amount} milliliters of water. Your total today is ${totalToday} milliliters.`;
      await this.speak(msg);
      return { action: 'log_water', message: msg, data: newLog };
    }

    // 2. Hydration Status: "how much water did i drink", "water status", "hydration progress"
    if (q.includes('water') && (q.includes('how much') || q.includes('status') || q.includes('progress'))) {
      const logs = await StorageService.getHydrationLogs();
      const settings = await StorageService.getHydrationSettings();
      const todayStr = new Date().toDateString();
      const totalToday = logs
        .filter((l) => new Date(l.timestamp).toDateString() === todayStr)
        .reduce((sum, l) => sum + l.amountMl, 0);

      const percent = Math.min(100, Math.round((totalToday / settings.goalMl) * 100));
      const msg = `You have drunk ${totalToday} out of ${settings.goalMl} milliliters today, reaching ${percent}% of your hydration goal.`;
      await this.speak(msg);
      return { action: 'water_status', message: msg };
    }

    // 3. Reminders: "remind me to take medicine at 8 pm", "add reminder to call mom"
    if (q.startsWith('remind me to') || q.startsWith('add reminder') || q.includes('reminder to')) {
      const title = q
        .replace(/^remind me to\s+/i, '')
        .replace(/^add reminder(?:\s+to)?\s+/i, '')
        .replace(/^remind me in luphonix to\s+/i, '');

      const reminderDate = new Date(Date.now() + 60 * 60 * 1000); // Default 1 hour later
      const newReminder: Reminder = {
        id: Date.now().toString(),
        title: title.charAt(0).toUpperCase() + title.slice(1),
        time: reminderDate.toISOString(),
        recurrence: 'none',
        category: 'Personal',
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      const reminders = await StorageService.getReminders();
      reminders.unshift(newReminder);
      await StorageService.saveReminders(reminders);
      await NotificationService.scheduleReminderNotification(newReminder);

      const msg = `Added reminder to ${newReminder.title}.`;
      await this.speak(msg);
      return { action: 'add_reminder', message: msg, data: newReminder };
    }

    // 4. Task Assignment & Tasks: "assign task review code to keval", "add task study for exam", "create task finish slides"
    if (q.startsWith('assign task') || q.includes('assign to') || q.startsWith('add task') || q.startsWith('create task') || q.startsWith('new task')) {
      let title = q;
      let assignee: string | undefined = undefined;

      // Check if command assigns to a friend: e.g. "assign task complete deck to @alex" or "add task call client to alex"
      const assignMatch = q.match(/(?:assign\s+task|add\s+task|create\s+task)\s+(.+?)\s+to\s+@?([a-zA-Z0-9_]+)$/i);
      if (assignMatch) {
        title = assignMatch[1].trim();
        assignee = assignMatch[2].trim().toLowerCase();
      } else {
        title = q
          .replace(/^assign task(?:\s+to)?\s+/i, '')
          .replace(/^add task(?:\s+to)?\s+/i, '')
          .replace(/^create task(?:\s+to)?\s+/i, '')
          .replace(/^new task\s+/i, '');
      }

      const newTask: Task = {
        id: Date.now().toString(),
        title: title.charAt(0).toUpperCase() + title.slice(1),
        priority: 'medium',
        category: 'Work',
        isCompleted: false,
        subtasks: [],
        assignedToUsername: assignee,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const tasks = await StorageService.getTasks();
      tasks.unshift(newTask);
      await StorageService.saveTasks(tasks);

      const msg = assignee
        ? `Created and assigned task "${newTask.title}" to @${assignee}.`
        : `Added task: "${newTask.title}".`;
      await this.speak(msg);
      return { action: 'add_task', message: msg, data: newTask };
    }

    // 5. Complete Task: "complete task ...", "finish task ...", "done with task ..."
    if (q.startsWith('complete task') || q.startsWith('finish task') || q.startsWith('mark task')) {
      const targetTitle = q
        .replace(/^complete task\s+/i, '')
        .replace(/^finish task\s+/i, '')
        .replace(/^mark task\s+/i, '')
        .replace(/\s+as completed$/i, '');

      const tasks = await StorageService.getTasks();
      let found = false;
      const updated = tasks.map((t) => {
        if (!found && !t.isCompleted && t.title.toLowerCase().includes(targetTitle.toLowerCase())) {
          found = true;
          return { ...t, isCompleted: true, completedAt: new Date().toISOString() };
        }
        return t;
      });

      if (found) {
        await StorageService.saveTasks(updated);
        const msg = `Marked task "${targetTitle}" as completed!`;
        await this.speak(msg);
        return { action: 'add_task', message: msg };
      }
    }

    // 6. List Tasks: "what are my tasks", "list tasks", "my tasks for today"
    if (q.includes('tasks') && (q.includes('what') || q.includes('list') || q.includes('show') || q.includes('pending'))) {
      const tasks = await StorageService.getTasks();
      const pending = tasks.filter((t) => !t.isCompleted);
      if (pending.length === 0) {
        const msg = 'You have no pending tasks! Great job staying caught up.';
        await this.speak(msg);
        return { action: 'list_tasks', message: msg };
      }
      const taskNames = pending.slice(0, 3).map((t) => t.title).join(', ');
      const msg = `You have ${pending.length} pending task${pending.length > 1 ? 's' : ''}: ${taskNames}.`;
      await this.speak(msg);
      return { action: 'list_tasks', message: msg, data: pending };
    }

    // 7. Cloud Sync: "sync data", "sync tasks", "sync with cloud"
    if (q.includes('sync')) {
      const msg = 'Synchronizing your tasks and hydration logs with Luphonix Cloud.';
      await this.speak(msg);
      return { action: 'unknown', message: msg };
    }

    const fallbackMsg = `I heard: "${query}". Try saying "add task study", "assign task review to alex", "remind me to drink water", or "log 250 ml of water".`;
    await this.speak(fallbackMsg);
    return { action: 'unknown', message: fallbackMsg };
  },
};
