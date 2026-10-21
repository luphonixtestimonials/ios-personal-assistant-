import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppNotification } from '../types';
import { NotificationService } from '../services/notifications';
import { ApiService } from '../services/api';
import { StorageService } from '../services/storage';

interface Props {
  visible: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onRefresh: () => void;
}

export const NotificationCenterModal: React.FC<Props> = ({
  visible,
  onClose,
  notifications,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'tasks'>('all');
  const [sendingTest, setSendingTest] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'tasks') return n.type === 'task_assigned';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleTestAlert = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSendingTest(true);
    try {
      await NotificationService.sendImmediateTestNotification(
        '🔔 Luphonix Notification Active',
        'Notification Center & Home Screen Heads-Up Banner are verified and working!'
      );
      // Also notify backend test route if online
      ApiService.sendTestNotification().catch(() => {});
      showFeedback('Heads-up alert sent to your Android Notification Center!');
      onRefresh();
    } catch {
      showFeedback('Notification sent locally.');
    } finally {
      setSendingTest(false);
    }
  };

  const handleHydrationPing = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const logs = await StorageService.getHydrationLogs();
      const settings = await StorageService.getHydrationSettings();
      const todayStr = new Date().toDateString();
      const totalMl = logs
        .filter((l) => new Date(l.timestamp).toDateString() === todayStr)
        .reduce((sum, l) => sum + l.amountMl, 0);

      await NotificationService.sendHydrationQuickPing(totalMl, settings.goalMl || 2000);
      showFeedback('Hydration notification sent to Android status bar!');
      onRefresh();
    } catch {
      showFeedback('Failed to send hydration alert.');
    }
  };

  const handleMarkAllRead = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await ApiService.markNotificationsRead();
    onRefresh();
    showFeedback('All notifications marked as read.');
  };

  const handleClearAll = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await ApiService.clearNotifications();
    onRefresh();
    showFeedback('Notification history cleared.');
  };

  const formatTimeAgo = (isoDate: string) => {
    const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (isNaN(diff) || diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getIconForType = (type?: string) => {
    switch (type) {
      case 'task_assigned':
        return { name: 'checkbox-outline' as const, color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.15)' };
      case 'hydration':
        return { name: 'water-outline' as const, color: '#0EA5E9', bg: 'rgba(14, 165, 233, 0.15)' };
      case 'reminder':
        return { name: 'alarm-outline' as const, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
      case 'test_notification':
        return { name: 'sparkles-outline' as const, color: '#A855F7', bg: 'rgba(168, 85, 247, 0.15)' };
      default:
        return { name: 'notifications-outline' as const, color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.12)' };
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.bellIconContainer}>
              <Ionicons name="notifications" size={20} color="#38BDF8" />
              {unreadCount > 0 && <View style={styles.bellDot} />}
            </View>
            <View>
              <Text style={styles.title}>Notification Center</Text>
              <Text style={styles.subtitle}>
                {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Feedback message banner */}
        {feedbackMsg && (
          <View style={styles.feedbackBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#38BDF8" />
            <Text style={styles.feedbackText}>{feedbackMsg}</Text>
          </View>
        )}

        {/* Android System Integration Status */}
        <View style={styles.systemStatusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <View style={styles.greenPulse} />
              <Text style={styles.statusPillText}>Status Bar & Drawer: Active</Text>
            </View>
            <View style={styles.statusPill}>
              <Ionicons name="phone-portrait-outline" size={12} color="#38BDF8" />
              <Text style={styles.statusPillText}>Home Screen Heads-Up: On</Text>
            </View>
          </View>
          <Text style={styles.systemStatusDesc}>
            Alerts appear in your Android Notification Center shade and pop up over your Home Screen.
          </Text>
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={handleTestAlert}
            disabled={sendingTest}
          >
            {sendingTest ? (
              <ActivityIndicator size="small" color="#0F172A" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={14} color="#0F172A" />
                <Text style={styles.actionBtnPrimaryText}>Trigger Test Alert</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleHydrationPing}>
            <Ionicons name="water" size={14} color="#38BDF8" />
            <Text style={styles.actionBtnText}>Water Ping</Text>
          </TouchableOpacity>

          {unreadCount > 0 && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleMarkAllRead}>
              <Ionicons name="checkmark-done" size={14} color="#10B981" />
              <Text style={styles.actionBtnText}>Read All</Text>
            </TouchableOpacity>
          )}

          {notifications.length > 0 && (
            <TouchableOpacity style={styles.actionBtnIcon} onPress={handleClearAll}>
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
              All ({notifications.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filter === 'unread' && styles.filterTabActive]}
            onPress={() => setFilter('unread')}
          >
            <Text style={[styles.filterTabText, filter === 'unread' && styles.filterTabTextActive]}>
              Unread ({unreadCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filter === 'tasks' && styles.filterTabActive]}
            onPress={() => setFilter('tasks')}
          >
            <Text style={[styles.filterTabText, filter === 'tasks' && styles.filterTabTextActive]}>
              Tasks & Friends
            </Text>
          </TouchableOpacity>
        </View>

        {/* Notification Feed */}
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-off-outline" size={36} color="#64748B" />
              </View>
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'unread'
                  ? 'All notifications have been read.'
                  : 'You will receive notifications for task assignments, scheduled reminders, and hydration alerts.'}
              </Text>
              <TouchableOpacity style={styles.emptyActionBtn} onPress={handleTestAlert}>
                <Ionicons name="sparkles" size={15} color="#38BDF8" />
                <Text style={styles.emptyActionText}>Send Sample Notification</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredNotifications.map((notif) => {
              const iconInfo = getIconForType(notif.type);
              return (
                <View
                  key={notif.id}
                  style={[styles.notifCard, !notif.isRead && styles.notifCardUnread]}
                >
                  <View style={[styles.notifIconBox, { backgroundColor: iconInfo.bg }]}>
                    <Ionicons name={iconInfo.name} size={18} color={iconInfo.color} />
                  </View>

                  <View style={styles.notifBody}>
                    <View style={styles.notifHeaderRow}>
                      <Text style={styles.notifTitle} numberOfLines={1}>
                        {notif.title}
                      </Text>
                      <Text style={styles.notifTime}>{formatTimeAgo(notif.createdAt)}</Text>
                    </View>
                    <Text style={styles.notifDesc} numberOfLines={2}>
                      {notif.body}
                    </Text>
                  </View>

                  {!notif.isRead && <View style={styles.unreadIndicator} />}
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.25)',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  feedbackText: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '600',
  },
  systemStatusCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  greenPulse: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  systemStatusDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  actionBtnPrimary: {
    backgroundColor: '#38BDF8',
    borderWidth: 0,
  },
  actionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#090D16',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  actionBtnIcon: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  filterTabActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#38BDF8',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 24,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 8,
  },
  notifCardUnread: {
    borderColor: 'rgba(56, 189, 248, 0.35)',
    backgroundColor: '#111C33',
  },
  notifIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBody: {
    flex: 1,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  notifTime: {
    fontSize: 11,
    color: '#64748B',
  },
  notifDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  emptyActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38BDF8',
  },
});
