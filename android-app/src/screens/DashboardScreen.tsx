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
import { Task, Reminder, HydrationLog, HydrationSettings } from '../types';
import * as Haptics from 'expo-haptics';

interface Props {
  onNavigateTab: (tab: string) => void;
  onOpenVoice: () => void;
}

export const DashboardScreen: React.FC<Props> = ({ onNavigateTab, onOpenVoice }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [hydrationLogs, setHydrationLogs] = useState<HydrationLog[]>([]);
  const [settings, setSettings] = useState<HydrationSettings>({
    goalMl: 2000,
    intervalMinutes: 60,
    wakeTime: '07:00',
    sleepTime: '22:00',
    remindersEnabled: true,
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [t, r, hl, hs] = await Promise.all([
      StorageService.getTasks(),
      StorageService.getReminders(),
      StorageService.getHydrationLogs(),
      StorageService.getHydrationSettings(),
    ]);
    setTasks(t);
    setReminders(r);
    setHydrationLogs(hl);
    setSettings(hs);
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

  const pendingTasks = tasks.filter((t) => !t.isCompleted);
  const activeReminders = reminders.filter((r) => r.isActive);

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
        <TouchableOpacity style={styles.voiceAssistantBtn} onPress={onOpenVoice}>
          <Ionicons name="mic" size={22} color="#FFFFFF" />
        </TouchableOpacity>
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
});
