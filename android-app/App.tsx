import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TasksScreen } from './src/screens/TasksScreen';
import { HydrationScreen } from './src/screens/HydrationScreen';
import { RemindersScreen } from './src/screens/RemindersScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { VoiceAssistantModal } from './src/components/VoiceAssistantModal';
import { NotificationService } from './src/services/notifications';
import * as Notifications from 'expo-notifications';

type Tab = 'dashboard' | 'tasks' | 'hydration' | 'reminders' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isVoiceModalVisible, setIsVoiceModalVisible] = useState(false);

  useEffect(() => {
    // Request notification permissions on app launch and configure channels
    NotificationService.requestPermissions().then(() => {
      NotificationService.updateBadgeCount();
    });

    // Listen for incoming notifications while app is open
    const subReceived = Notifications.addNotificationReceivedListener(() => {
      NotificationService.updateBadgeCount();
    });

    const subResponse = Notifications.addNotificationResponseReceivedListener(() => {
      setActiveTab('dashboard');
    });

    return () => {
      subReceived.remove();
      subResponse.remove();
    };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardScreen
            onNavigateTab={(tab) => setActiveTab(tab as Tab)}
            onOpenVoice={() => setIsVoiceModalVisible(true)}
          />
        );
      case 'tasks':
        return <TasksScreen />;
      case 'hydration':
        return <HydrationScreen />;
      case 'reminders':
        return <RemindersScreen />;
      case 'settings':
        return <SettingsScreen />;
    }
  };

  const navItems: { tab: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { tab: 'dashboard', label: 'Home', icon: 'home-outline' },
    { tab: 'tasks', label: 'Tasks', icon: 'checkbox-outline' },
    { tab: 'hydration', label: 'Water', icon: 'water-outline' },
    { tab: 'reminders', label: 'Remind', icon: 'alarm-outline' },
    { tab: 'settings', label: 'Settings', icon: 'settings-outline' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Main Content Area */}
      <View style={styles.screenContainer}>{renderContent()}</View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        {navItems.map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <TouchableOpacity
              key={item.tab}
              style={styles.navTab}
              onPress={() => setActiveTab(item.tab)}
            >
              <Ionicons
                name={item.icon}
                size={22}
                color={isActive ? '#38BDF8' : '#64748B'}
              />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Voice Assistant Modal */}
      <VoiceAssistantModal
        visible={isVoiceModalVisible}
        onClose={() => setIsVoiceModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  screenContainer: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navTab: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  navLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
});
