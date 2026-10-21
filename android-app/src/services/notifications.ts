import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Reminder, HydrationSettings, AppNotification } from '../types';
import { StorageService } from './storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const NotificationService = {
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Luphonix Reminders & Tasks',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#38BDF8',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
        enableLights: true,
        enableVibrate: true,
      });

      await Notifications.setNotificationChannelAsync('hydration', {
        name: 'Hydration Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 200, 200],
        lightColor: '#0EA5E9',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
        enableLights: true,
        enableVibrate: true,
      });

      await Notifications.setNotificationChannelAsync('task_assigned', {
        name: 'Friends & Task Assignment',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 150, 300],
        lightColor: '#818CF8',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
        enableLights: true,
        enableVibrate: true,
      });

      await Notifications.setNotificationChannelAsync('system', {
        name: 'Assistant & System Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 150, 150],
        lightColor: '#38BDF8',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  },

  async updateBadgeCount(count?: number): Promise<void> {
    try {
      if (typeof count === 'number') {
        await Notifications.setBadgeCountAsync(Math.max(0, count));
        return;
      }
      const [tasks, notifs] = await Promise.all([
        StorageService.getTasks(),
        StorageService.getNotifications(),
      ]);
      const unreadNotifs = notifs.filter((n) => !n.isRead).length;
      const highPriorityTasks = tasks.filter((t) => !t.isCompleted && t.priority === 'high').length;
      const totalBadge = unreadNotifs + highPriorityTasks;
      await Notifications.setBadgeCountAsync(totalBadge);
    } catch {
      // safe fallback if launcher doesn't support badge API
    }
  },

  async scheduleReminderNotification(reminder: Reminder): Promise<string | null> {
    try {
      const date = new Date(reminder.time);
      if (isNaN(date.getTime()) || date.getTime() <= Date.now()) {
        return null;
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `🔔 ${reminder.title}`,
          body: reminder.notes || `Reminder scheduled for ${reminder.category}`,
          data: { reminderId: reminder.id, type: 'reminder' },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: date,
          channelId: 'default',
        },
      });

      // Save to notification center history
      const notifItem: AppNotification = {
        id: `notif_rem_${Date.now()}`,
        title: `Reminder: ${reminder.title}`,
        body: reminder.notes || `Scheduled for ${new Date(reminder.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        type: 'reminder',
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      await StorageService.addNotification(notifItem);
      await this.updateBadgeCount();

      return id;
    } catch (e) {
      console.warn('Error scheduling reminder notification', e);
      return null;
    }
  },

  async scheduleHydrationNotification(settings: HydrationSettings): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!settings.remindersEnabled) return;

      const intervalSec = Math.max(60, settings.intervalMinutes * 60);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💧 Time to Hydrate!',
          body: `Keep up your daily target of ${settings.goalMl} ml. Log a cup of water in Luphonix.`,
          data: { type: 'hydration' },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: intervalSec,
          repeats: true,
          channelId: 'hydration',
        },
      });
    } catch (e) {
      console.warn('Error scheduling hydration reminder', e);
    }
  },

  async sendImmediateTestNotification(
    customTitle?: string,
    customBody?: string,
    channelId: string = 'default'
  ): Promise<string> {
    const title = customTitle || '🔔 Luphonix Assistant Notification';
    const body =
      customBody ||
      'Notification active! This alert appears in your Android Notification Center and as a Heads-Up banner on your Home Screen.';

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { test: true, timestamp: Date.now() },
      },
      trigger: null, // triggers immediately
    });

    const notifItem: AppNotification = {
      id: `test_${Date.now()}`,
      title,
      body,
      type: 'test_notification',
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    await StorageService.addNotification(notifItem);
    await this.updateBadgeCount();

    return id;
  },

  async sendTaskAssignmentAlert(title: string, body: string, taskId?: string): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `📋 ${title}`,
        body,
        sound: true,
        data: { taskId, type: 'task_assigned' },
      },
      trigger: null,
    });

    const notifItem: AppNotification = {
      id: `task_${Date.now()}`,
      title,
      body,
      type: 'task_assigned',
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    await StorageService.addNotification(notifItem);
    await this.updateBadgeCount();

    return id;
  },

  async sendHydrationQuickPing(currentMl: number, goalMl: number): Promise<string> {
    const percent = Math.min(100, Math.round((currentMl / (goalMl || 2000)) * 100));
    const title = '💧 Water Intake Update';
    const body = `You've logged ${currentMl} ml today (${percent}% of your ${goalMl} ml goal). Stay energized!`;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { type: 'hydration' },
      },
      trigger: null,
    });

    const notifItem: AppNotification = {
      id: `water_${Date.now()}`,
      title,
      body,
      type: 'hydration',
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    await StorageService.addNotification(notifItem);
    await this.updateBadgeCount();

    return id;
  },
};

