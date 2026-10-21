import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageService } from '../services/storage';
import { ApiService } from '../services/api';
import { NotificationService } from '../services/notifications';
import { Task, Reminder, HydrationLog, HydrationSettings, AppNotification } from '../types';
import { NotificationCenterModal } from '../components/NotificationCenterModal';
import * as Haptics from 'expo-haptics';

interface Props {
  onNavigateTab: (tab: string) => void;
  onOpenVoice: () => void;
}

export const DashboardScreen: React.FC<Props> = ({ onNavigateTab, onOpenVoice }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [hydrationLogs, setHydrationLogs] = useState<HydrationLog[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifModalVisible, setIsNotifModalVisible] = useState(false);
  const [settings, setSettings] = useState<HydrationSettings>({
    goalMl: 2000,
    intervalMinutes: 60,
    wakeTime: '07:00',
    sleepTime: '22:00',
    remindersEnabled: true,
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [t, r, hl, hs, notifData] = await Promise.all([
      StorageService.getTasks(),
      StorageService.getReminders(),
      StorageService.getHydrationLogs(),
      StorageService.getHydrationSettings(),
      ApiService.getNotifications(),
    ]);
    setTasks(t);
    setReminders(r);
    setHydrationLogs(hl);
    setSettings(hs);
    setNotifications(notifData.notifications || []);
    await NotificationService.updateBadgeCount(notifData.unreadCount);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Water calculation
  const todayStr = new Date().toDateString();
  const todayWater = hydrationLogs
    .filter((l) => new Date(l.timestamp).toDateString() === todayStr)
    .reduce((sum, l) => sum + l.amountMl, 0);

  const waterPercent = Math.min(100, Math.round((todayWater / (settings.goalMl || 2000)) * 100));

  const quickLogWater = async (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newLog: HydrationLog = {
      id: Date.now().toString(),
      amountMl: amount,
      timestamp: new Date().toISOString(),
      label: `Quick ${amount}ml`,
    };
    const updated = [newLog, ...hydrationLogs];
    setHydrationLogs(updated);
    await StorageService.saveHydrationLogs(updated);
  };

  const handleQuickTestAlert = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await NotificationService.sendImmediateTestNotification(
      '✨ Luphonix Home Screen Alert',
      'This notification is delivered to your Android Notification Center and displayed as a heads-up banner.'
    );
    await loadData();
  };

  const pendingTasks = tasks.filter((t) => !t.isCompleted);
  const activeReminders = reminders.filter((r) => r.isActive);
  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;
  const latestNotif = notifications[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome to Luphonix</Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>
        </View>

        <View style={styles.headerActionsRow}>
          {/* Notification Center Bell Button */}
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsNotifModalVisible(true);
            }}
          >
            <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
            {unreadNotifCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Voice Assistant Mic Button */}
          <TouchableOpacity style={styles.voiceAssistantBtn} onPress={onOpenVoice}>
            <Ionicons name="mic" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Android Notification Center & Status Widget */}
      <View style={styles.notifWidgetCard}>
        <View style={styles.notifWidgetHeader}>
          <View style={styles.notifWidgetTitleRow}>
            <View style={styles.notifWidgetIconCircle}>
              <Ionicons name="notifications" size={18} color="#38BDF8" />
            </View>
            <View>
              <Text style={styles.notifWidgetTitle}>Android Notification Center</Text>
              <View style={styles.notifWidgetStatusPill}>
                <View style={styles.greenDot} />
                <Text style={styles.notifWidgetStatusText}>System Drawer & Heads-Up Active</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.openNotifCenterBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsNotifModalVisible(true);
            }}
          >
            <Text style={styles.openNotifCenterText}>Open &gt;</Text>
          </TouchableOpacity>
        </View>

        {latestNotif ? (
          <View style={styles.latestNotifBox}>
            <View style={styles.latestNotifHeader}>
              <Text style={styles.latestNotifTitle} numberOfLines={1}>
                {latestNotif.title}
              </Text>
              <Text style={styles.latestNotifTime}>Latest</Text>
            </View>
            <Text style={styles.latestNotifBody} numberOfLines={2}>
              {latestNotif.body}
            </Text>
          </View>
        ) : (
          <Text style={styles.noNotifText}>
            No unread alerts. Scheduled reminders and friend tasks will trigger here.
          </Text>
        )}

        {/* Quick Trigger Buttons on Home Screen */}
        <View style={styles.notifQuickActions}>
          <TouchableOpacity style={styles.notifQuickBtnPrimary} onPress={handleQuickTestAlert}>
            <Ionicons name="paper-plane" size={13} color="#090D16" />
            <Text style={styles.notifQuickBtnPrimaryText}>Trigger Heads-Up Alert</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.notifQuickBtnSecondary}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsNotifModalVisible(true);
            }}
          >
            <Ionicons name="albums-outline" size={13} color="#38BDF8" />
            <Text style={styles.notifQuickBtnSecondaryText}>View All ({notifications.length})</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Hydration Summary Card */}
      <View style={styles.card}>

        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(14, 165, 233, 0.15)' }]}>
              <Ionicons name="water" size={20} color="#0EA5E9" />
            </View>
            <Text style={styles.cardTitle}>Hydration Tracker</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigateTab('hydration')}>
            <Text style={styles.seeAllText}>Details &gt;</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.waterStatsRow}>
          <View>
            <Text style={styles.waterAmountText}>
              {todayWater} <Text style={styles.waterUnit}>/ {settings.goalMl} ml</Text>
            </Text>
            <Text style={styles.waterSubtext}>{waterPercent}% of daily goal achieved</Text>
          </View>
          <View style={styles.percentBadge}>
            <Text style={styles.percentBadgeText}>{waterPercent}%</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${waterPercent}%` }]} />
        </View>

        {/* Quick Add Water Buttons */}
        <View style={styles.quickWaterRow}>
          {[150, 250, 350, 500].map((amount) => (
            <TouchableOpacity
              key={amount}
              style={styles.waterChip}
              onPress={() => quickLogWater(amount)}
            >
              <Ionicons name="add" size={14} color="#38BDF8" />
              <Text style={styles.waterChipText}>{amount} ml</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tasks Overview Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
              <Ionicons name="checkbox-outline" size={20} color="#6366F1" />
            </View>
            <Text style={styles.cardTitle}>Tasks for Today</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigateTab('tasks')}>
            <Text style={styles.seeAllText}>View All ({pendingTasks.length}) &gt;</Text>
          </TouchableOpacity>
        </View>

        {pendingTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={32} color="#10B981" />
            <Text style={styles.emptyText}>No pending tasks. You are all caught up!</Text>
          </View>
        ) : (
          pendingTasks.slice(0, 3).map((task) => (
            <TouchableOpacity
              key={task.id}
              style={styles.taskItem}
              onPress={() => onNavigateTab('tasks')}
            >
              <View style={styles.taskLeft}>
                <Ionicons
                  name={task.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={task.isCompleted ? '#10B981' : '#64748B'}
                />
                <Text style={styles.taskTitle} numberOfLines={1}>
                  {task.title}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {task.assignedToUsername ? (
                  <View style={styles.collabBadge}>
                    <Text style={styles.collabBadgeText}>@{task.assignedToUsername}</Text>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.priorityBadge,
                    task.priority === 'high' && styles.priorityHigh,
                    task.priority === 'medium' && styles.priorityMedium,
                    task.priority === 'low' && styles.priorityLow,
                  ]}
                >
                  <Text style={styles.priorityText}>{task.priority}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Upcoming Reminders Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Ionicons name="notifications-outline" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.cardTitle}>Active Reminders</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigateTab('reminders')}>
            <Text style={styles.seeAllText}>Manage ({activeReminders.length}) &gt;</Text>
          </TouchableOpacity>
        </View>

        {activeReminders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="alarm-outline" size={32} color="#64748B" />
            <Text style={styles.emptyText}>No active reminders scheduled.</Text>
          </View>
        ) : (
          activeReminders.slice(0, 3).map((r) => (
            <View key={r.id} style={styles.reminderItem}>
              <View>
                <Text style={styles.reminderTitle}>{r.title}</Text>
                <Text style={styles.reminderTime}>
                  {new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {r.recurrence}
                </Text>
              </View>
              <Ionicons name="time-outline" size={18} color="#94A3B8" />
            </View>
          ))
        )}
      </View>

      {/* Notification Center Modal */}
      <NotificationCenterModal
        visible={isNotifModalVisible}
        onClose={() => setIsNotifModalVisible(false)}
        notifications={notifications}
        onRefresh={loadData}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  dateText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  voiceAssistantBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  seeAllText: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '600',
  },
  waterStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  waterAmountText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#38BDF8',
  },
  waterUnit: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  waterSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  percentBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  percentBadgeText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 13,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0EA5E9',
    borderRadius: 4,
  },
  quickWaterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  waterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
  waterChipText: {
    color: '#E0F2FE',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 8,
  },
  taskItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  taskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  taskTitle: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  priorityHigh: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  priorityMedium: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  priorityLow: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F1F5F9',
    textTransform: 'uppercase',
  },
  reminderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  reminderTitle: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '600',
  },
  reminderTime: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  collabBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  collabBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#38BDF8',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#090D16',
  },
  bellBadgeText: {
    color: '#090D16',
    fontSize: 10,
    fontWeight: '800',
  },
  notifWidgetCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    padding: 16,
    marginBottom: 16,
  },
  notifWidgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  notifWidgetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifWidgetIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifWidgetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  notifWidgetStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  notifWidgetStatusText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  openNotifCenterBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  openNotifCenterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
  },
  latestNotifBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 10,
    marginBottom: 12,
  },
  latestNotifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  latestNotifTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
    flex: 1,
    marginRight: 6,
  },
  latestNotifTime: {
    fontSize: 10,
    fontWeight: '600',
    color: '#38BDF8',
  },
  latestNotifBody: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },
  noNotifText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 16,
  },
  notifQuickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  notifQuickBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#38BDF8',
    paddingVertical: 8,
    borderRadius: 10,
  },
  notifQuickBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#090D16',
  },
  notifQuickBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    borderRadius: 10,
  },
  notifQuickBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38BDF8',
  },
});

