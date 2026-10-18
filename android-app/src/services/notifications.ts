import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Reminder, HydrationSettings } from '../types';

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
        name: 'Luphonix Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#38BDF8',
      });
      await Notifications.setNotificationChannelAsync('hydration', {
        name: 'Hydration Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 200, 200],
        lightColor: '#0EA5E9',
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
          data: { reminderId: reminder.id },
          sound: true,
        },
        trigger: {
          date: date,
          channelId: 'default',
        },
      });
      return id;
    } catch (e) {
      console.warn('Error scheduling reminder notification', e);
      return null;
    }
  },

  async scheduleHydrationNotification(settings: HydrationSettings): Promise<void> {
    try {
      // Cancel previous scheduled hydration alerts
      await Notifications.cancelAllScheduledNotificationsAsync();

      if (!settings.remindersEnabled) return;

      const [wakeHour, wakeMin] = settings.wakeTime.split(':').map(Number);
      const [sleepHour, sleepMin] = settings.sleepTime.split(':').map(Number);

      const now = new Date();
      const intervalSec = settings.intervalMinutes * 60;

      // Schedule next hydration reminder
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💧 Time to Hydrate!',
          body: `Keep up your daily goal of ${settings.goalMl} ml. Log a cup of water in Luphonix.`,
          sound: true,
        },
        trigger: {
          seconds: Math.max(intervalSec, 60),
          repeats: true,
          channelId: 'hydration',
        },
      });
    } catch (e) {
      console.warn('Error scheduling hydration reminder', e);
    }
  },

  async sendImmediateTestNotification(): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✨ Luphonix Assistant Ready',
        body: 'Local notifications and reminders are functioning properly on your Android device!',
        sound: true,
      },
      trigger: null,
    });
  },
};
