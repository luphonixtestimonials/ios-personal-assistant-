import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageService } from '../services/storage';
import { NotificationService } from '../services/notifications';
import { Reminder, ReminderRecurrence, TaskCategory } from '../types';
import * as Haptics from 'expo-haptics';

export const RemindersScreen: React.FC = () => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // New reminder form
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>('none');
  const [category, setCategory] = useState<TaskCategory>('Personal');
  const [hoursOffset, setHoursOffset] = useState(1);

  const loadReminders = useCallback(async () => {
    const list = await StorageService.getReminders();
    setReminders(list);
  }, []);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const toggleReminderActive = async (reminder: Reminder) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = reminders.map((r) =>
      r.id === reminder.id ? { ...r, isActive: !r.isActive } : r
    );
    setReminders(updated);
    await StorageService.saveReminders(updated);
  };

  const snoozeReminder = async (reminder: Reminder) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const updated = reminders.map((r) =>
      r.id === reminder.id ? { ...r, time: newTime } : r
    );
    setReminders(updated);
    await StorageService.saveReminders(updated);
    const target = updated.find((r) => r.id === reminder.id);
    if (target) {
      await NotificationService.scheduleReminderNotification(target);
    }
    Alert.alert('Snoozed', 'Reminder snoozed for 15 minutes.');
  };

  const deleteReminder = async (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const updated = reminders.filter((r) => r.id !== id);
    setReminders(updated);
    await StorageService.saveReminders(updated);
  };

  const handleSaveReminder = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a reminder title');
      return;
    }

    const scheduledDate = new Date(Date.now() + hoursOffset * 60 * 60 * 1000);
    const newReminder: Reminder = {
      id: Date.now().toString(),
      title: title.trim(),
      notes: notes.trim() || undefined,
      time: scheduledDate.toISOString(),
      recurrence: recurrence,
      category: category,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const updated = [newReminder, ...reminders];
    setReminders(updated);
    await StorageService.saveReminders(updated);
    await NotificationService.scheduleReminderNotification(newReminder);

    setTitle('');
    setNotes('');
    setIsModalVisible(false);
  };

  const testNotification = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await NotificationService.sendImmediateTestNotification();
    Alert.alert('Notification Sent', 'A test alert has been delivered to your notification tray.');
  };

  return (
    <View style={styles.container}>
      {/* Header Info Banner */}
      <View style={styles.banner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Smart Daily Reminders</Text>
          <Text style={styles.bannerSub}>High-priority local alarms and snooze</Text>
        </View>
        <TouchableOpacity style={styles.testBtn} onPress={testNotification}>
          <Ionicons name="notifications" size={16} color="#38BDF8" style={{ marginRight: 4 }} />
          <Text style={styles.testBtnText}>Test</Text>
        </TouchableOpacity>
      </View>

      {/* Reminder List */}
      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="alarm-outline" size={48} color="#334155" />
            <Text style={styles.emptyTitle}>No reminders yet</Text>
            <Text style={styles.emptySubtitle}>Tap the '+' button to schedule a reminder</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.reminderCard, !item.isActive && styles.reminderCardInactive]}>
            <View style={styles.reminderTop}>
              <View style={styles.reminderInfo}>
                <Text style={styles.reminderTitle}>{item.title}</Text>
                {item.notes ? <Text style={styles.reminderNotes}>{item.notes}</Text> : null}
                <Text style={styles.reminderTime}>
                  <Ionicons name="time-outline" size={12} color="#38BDF8" />{' '}
                  {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                  {item.recurrence.toUpperCase()}
                </Text>
              </View>
              <Switch
                value={item.isActive}
                onValueChange={() => toggleReminderActive(item)}
                trackColor={{ false: '#334155', true: '#0284C7' }}
                thumbColor={item.isActive ? '#38BDF8' : '#94A3B8'}
              />
            </View>

            <View style={styles.reminderActions}>
              <TouchableOpacity style={styles.snoozeBtn} onPress={() => snoozeReminder(item)}>
                <Ionicons name="pause-outline" size={14} color="#CBD5E1" style={{ marginRight: 4 }} />
                <Text style={styles.actionBtnText}>Snooze 15m</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteReminder(item.id)}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setIsModalVisible(true)}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Create Reminder Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set New Reminder</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Reminder title (e.g. Drink water, Call mom)"
              placeholderTextColor="#64748B"
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Notes or instructions (optional)"
              placeholderTextColor="#64748B"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />

            {/* Trigger time offset */}
            <Text style={styles.fieldLabel}>Trigger In</Text>
            <View style={styles.selectorRow}>
              {[
                { label: 'In 30m', hrs: 0.5 },
                { label: 'In 1h', hrs: 1 },
                { label: 'In 2h', hrs: 2 },
                { label: 'In 4h', hrs: 4 },
                { label: 'Tomorrow', hrs: 24 },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  style={[styles.selectorBtn, hoursOffset === opt.hrs && styles.selectorBtnActive]}
                  onPress={() => setHoursOffset(opt.hrs)}
                >
                  <Text style={[styles.selectorText, hoursOffset === opt.hrs && styles.selectorTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Recurrence */}
            <Text style={styles.fieldLabel}>Recurrence</Text>
            <View style={styles.selectorRow}>
              {(['none', 'daily', 'weekdays', 'weekly'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.selectorBtn, recurrence === r && styles.selectorBtnActive]}
                  onPress={() => setRecurrence(r)}
                >
                  <Text style={[styles.selectorText, recurrence === r && styles.selectorTextActive]}>
                    {r.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Category */}
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.selectorRow}>
              {(['Personal', 'Work', 'Health', 'Study'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.selectorBtn, category === cat && styles.selectorBtnActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.selectorText, category === cat && styles.selectorTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveReminder}>
              <Text style={styles.saveBtnText}>Schedule Reminder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
    padding: 16,
  },
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  bannerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  testBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 80,
  },
  reminderCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  reminderCardInactive: {
    opacity: 0.5,
  },
  reminderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reminderInfo: {
    flex: 1,
    marginRight: 10,
  },
  reminderTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  reminderNotes: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
  },
  reminderTime: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  reminderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  snoozeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 6,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  modalInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTextArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  selectorBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectorBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  selectorText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  selectorTextActive: {
    color: '#FFFFFF',
  },
  saveBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
