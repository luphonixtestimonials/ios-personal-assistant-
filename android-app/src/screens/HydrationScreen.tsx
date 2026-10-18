import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageService } from '../services/storage';
import { NotificationService } from '../services/notifications';
import { HydrationLog, HydrationSettings } from '../types';
import * as Haptics from 'expo-haptics';

export const HydrationScreen: React.FC = () => {
  const [logs, setLogs] = useState<HydrationLog[]>([]);
  const [settings, setSettings] = useState<HydrationSettings>({
    goalMl: 2000,
    intervalMinutes: 60,
    wakeTime: '07:00',
    sleepTime: '22:00',
    remindersEnabled: true,
  });
  const [customMl, setCustomMl] = useState('');

  const loadData = useCallback(async () => {
    const [savedLogs, savedSettings] = await Promise.all([
      StorageService.getHydrationLogs(),
      StorageService.getHydrationSettings(),
    ]);
    setLogs(savedLogs);
    setSettings(savedSettings);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Today's total
  const todayStr = new Date().toDateString();
  const todayLogs = logs.filter((l) => new Date(l.timestamp).toDateString() === todayStr);
  const todayTotal = todayLogs.reduce((sum, l) => sum + l.amountMl, 0);
  const percent = Math.min(100, Math.round((todayTotal / (settings.goalMl || 2000)) * 100));

  const logWater = async (amount: number, label?: string) => {
    if (amount <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newLog: HydrationLog = {
      id: Date.now().toString(),
      amountMl: amount,
      timestamp: new Date().toISOString(),
      label: label || `${amount} ml`,
    };

    const updated = [newLog, ...logs];
    setLogs(updated);
    await StorageService.saveHydrationLogs(updated);
  };

  const handleCustomLog = () => {
    const amt = parseInt(customMl.trim(), 10);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid', 'Please enter a valid amount in ml');
      return;
    }
    logWater(amt, `Custom ${amt} ml`);
    setCustomMl('');
  };

  const deleteLog = async (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const updated = logs.filter((l) => l.id !== id);
    setLogs(updated);
    await StorageService.saveHydrationLogs(updated);
  };

  const updateGoal = async (delta: number) => {
    const newGoal = Math.max(1000, Math.min(5000, settings.goalMl + delta));
    const updated = { ...settings, goalMl: newGoal };
    setSettings(updated);
    await StorageService.saveHydrationSettings(updated);
    await NotificationService.scheduleHydrationNotification(updated);
  };

  const toggleReminders = async (val: boolean) => {
    const updated = { ...settings, remindersEnabled: val };
    setSettings(updated);
    await StorageService.saveHydrationSettings(updated);
    await NotificationService.scheduleHydrationNotification(updated);
  };

  const setIntervalMin = async (mins: number) => {
    const updated = { ...settings, intervalMinutes: mins };
    setSettings(updated);
    await StorageService.saveHydrationSettings(updated);
    await NotificationService.scheduleHydrationNotification(updated);
  };

  // 7-day historical bar data
  const getLast7DaysData = () => {
    const days: { label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = d.toDateString();
      const total = logs
        .filter((l) => new Date(l.timestamp).toDateString() === str)
        .reduce((s, l) => s + l.amountMl, 0);

      const dayName = d.toLocaleDateString(undefined, { weekday: 'narrow' });
      days.push({ label: i === 0 ? 'Today' : dayName, total });
    }
    return days;
  };

  const history7Days = getLast7DaysData();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hydration Main Card */}
      <View style={styles.mainCard}>
        <View style={styles.ringContainer}>
          <View style={styles.innerCircle}>
            <Ionicons name="water" size={32} color="#0EA5E9" />
            <Text style={styles.totalNumber}>{todayTotal}</Text>
            <Text style={styles.goalLabel}>Goal: {settings.goalMl} ml</Text>
            <View style={styles.percentPill}>
              <Text style={styles.percentText}>{percent}% reached</Text>
            </View>
          </View>
        </View>

        {/* Goal adjustment row */}
        <View style={styles.goalAdjustRow}>
          <Text style={styles.goalAdjustLabel}>Daily Target:</Text>
          <View style={styles.adjustButtons}>
            <TouchableOpacity style={styles.adjustBtn} onPress={() => updateGoal(-250)}>
              <Text style={styles.adjustBtnText}>-250</Text>
            </TouchableOpacity>
            <Text style={styles.currentGoalText}>{settings.goalMl} ml</Text>
            <TouchableOpacity style={styles.adjustBtn} onPress={() => updateGoal(250)}>
              <Text style={styles.adjustBtnText}>+250</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Quick Add Log Buttons */}
      <Text style={styles.sectionTitle}>Quick Water Intake</Text>
      <View style={styles.quickGrid}>
        {[
          { label: 'Glass', ml: 150, icon: 'wine-outline' as const },
          { label: 'Cup', ml: 250, icon: 'cafe-outline' as const },
          { label: 'Mug', ml: 350, icon: 'beer-outline' as const },
          { label: 'Bottle', ml: 500, icon: 'water-outline' as const },
        ].map((item) => (
          <TouchableOpacity
            key={item.ml}
            style={styles.quickCard}
            onPress={() => logWater(item.ml, item.label)}
          >
            <Ionicons name={item.icon} size={24} color="#38BDF8" />
            <Text style={styles.quickMl}>+{item.ml} ml</Text>
            <Text style={styles.quickName}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom Amount Entry */}
      <View style={styles.customInputCard}>
        <TextInput
          style={styles.customInput}
          placeholder="Custom amount (e.g. 400)"
          placeholderTextColor="#64748B"
          keyboardType="numeric"
          value={customMl}
          onChangeText={setCustomMl}
        />
        <TouchableOpacity style={styles.customAddBtn} onPress={handleCustomLog}>
          <Text style={styles.customAddBtnText}>Log Intake</Text>
        </TouchableOpacity>
      </View>

      {/* 7-Day History Chart */}
      <Text style={styles.sectionTitle}>7-Day Intake Trend</Text>
      <View style={styles.chartCard}>
        <View style={styles.chartBars}>
          {history7Days.map((d, index) => {
            const barHeight = Math.min(100, Math.round((d.total / settings.goalMl) * 100));
            return (
              <View key={index} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${Math.max(barHeight, 4)}%` }]} />
                </View>
                <Text style={styles.barLabel}>{d.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Reminder Preferences */}
      <Text style={styles.sectionTitle}>Reminder Preferences</Text>
      <View style={styles.settingsCard}>
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Drink Water Alerts</Text>
            <Text style={styles.switchSub}>Periodic alerts during active hours</Text>
          </View>
          <Switch
            value={settings.remindersEnabled}
            onValueChange={toggleReminders}
            trackColor={{ false: '#334155', true: '#0284C7' }}
            thumbColor={settings.remindersEnabled ? '#38BDF8' : '#94A3B8'}
          />
        </View>

        {settings.remindersEnabled && (
          <View style={styles.intervalSection}>
            <Text style={styles.intervalTitle}>Alert Interval:</Text>
            <View style={styles.intervalRow}>
              {[30, 60, 90, 120].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[
                    styles.intervalChip,
                    settings.intervalMinutes === mins && styles.intervalChipActive,
                  ]}
                  onPress={() => setIntervalMin(mins)}
                >
                  <Text
                    style={[
                      styles.intervalChipText,
                      settings.intervalMinutes === mins && styles.intervalChipTextActive,
                    ]}
                  >
                    {mins}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Today's Logs */}
      <Text style={styles.sectionTitle}>Today's Logs ({todayLogs.length})</Text>
      {todayLogs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyLogsText}>No water logged yet today.</Text>
        </View>
      ) : (
        todayLogs.map((l) => (
          <View key={l.id} style={styles.logItem}>
            <View style={styles.logLeft}>
              <Ionicons name="water" size={16} color="#0EA5E9" style={{ marginRight: 8 }} />
              <View>
                <Text style={styles.logAmount}>+{l.amountMl} ml</Text>
                <Text style={styles.logTime}>
                  {new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {l.label || 'Intake'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => deleteLog(l.id)}>
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))
      )}
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
  mainCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  ringContainer: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 8,
    borderColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  innerCircle: {
    alignItems: 'center',
  },
  totalNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 4,
  },
  goalLabel: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  percentPill: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
  },
  percentText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  goalAdjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  goalAdjustLabel: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  adjustButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adjustBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  adjustBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  currentGoalText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 12,
    marginTop: 6,
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickCard: {
    width: '23%',
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  quickMl: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  quickName: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  customInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  customInput: {
    flex: 1,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    fontSize: 14,
  },
  customAddBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  customAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  chartCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 10,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barTrack: {
    width: 14,
    height: 90,
    backgroundColor: '#1E293B',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: '#0EA5E9',
    borderRadius: 7,
  },
  barLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  settingsCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  switchSub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  intervalSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  intervalTitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 8,
  },
  intervalRow: {
    flexDirection: 'row',
    gap: 8,
  },
  intervalChip: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  intervalChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  intervalChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  intervalChipTextActive: {
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  emptyLogsText: {
    color: '#64748B',
    fontSize: 13,
  },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logAmount: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  logTime: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
});
