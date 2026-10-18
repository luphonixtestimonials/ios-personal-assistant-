import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageService } from '../services/storage';
import { ApiService } from '../services/api';
import { NotificationService } from '../services/notifications';
import { UserProfile } from '../types';

export const SettingsScreen: React.FC = () => {
  const [serverUrl, setServerUrl] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Auth fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    (async () => {
      const url = await StorageService.getServerUrl();
      const profile = await StorageService.getUserProfile();
      setServerUrl(url);
      setUserProfile(profile);
    })();
  }, []);

  const saveServerUrl = async () => {
    if (!serverUrl.trim()) return;
    await StorageService.saveServerUrl(serverUrl.trim());
    Alert.alert('Saved', 'Backend server URL updated.');
  };

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setIsAuthenticating(true);
    let result;
    if (isRegistering) {
      result = await ApiService.register(name || 'Luphonix User', email, password);
    } else {
      result = await ApiService.login(email, password);
    }
    setIsAuthenticating(false);

    if (result.success && result.user) {
      setUserProfile(result.user);
      Alert.alert('Success', `Welcome, ${result.user.name}!`);
    } else {
      Alert.alert('Error', result.error || 'Authentication failed');
    }
  };

  const handleLogout = async () => {
    await StorageService.saveUserProfile(null);
    setUserProfile(null);
    Alert.alert('Logged Out', 'Switched to offline local mode.');
  };

  const triggerSync = async () => {
    setIsSyncing(true);
    await Promise.all([ApiService.syncTasks(), ApiService.syncHydration()]);
    setIsSyncing(false);
    Alert.alert('Synced', 'Local data synchronized with backend successfully.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* App Info Card */}
      <View style={styles.card}>
        <View style={styles.appHeaderRow}>
          <View style={styles.appIconCircle}>
            <Ionicons name="sparkles" size={24} color="#38BDF8" />
          </View>
          <View>
            <Text style={styles.appName}>Luphonix Assistant</Text>
            <Text style={styles.appVersion}>Android Edition • v1.0.0</Text>
          </View>
        </View>
        <Text style={styles.appDescription}>
          Smart personal assistant for daily tasks, hydration tracking, natural voice commands, and recurring alarms.
        </Text>
      </View>

      {/* Account Section */}
      <Text style={styles.sectionTitle}>Account & Cloud Sync</Text>
      <View style={styles.card}>
        {userProfile ? (
          <View>
            <View style={styles.profileRow}>
              <Ionicons name="person-circle-outline" size={40} color="#38BDF8" />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.profileName}>{userProfile.name}</Text>
                <Text style={styles.profileEmail}>{userProfile.email}</Text>
              </View>
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.syncBtn, isSyncing && styles.btnDisabled]}
                onPress={triggerSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.btnText}>Sync Data</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutBtnText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.authModeTitle}>
              {isRegistering ? 'Create Luphonix Account' : 'Sign In with Luphonix'}
            </Text>

            {isRegistering && (
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#64748B"
                value={name}
                onChangeText={setName}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#64748B"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#64748B"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              style={[styles.authSubmitBtn, isAuthenticating && styles.btnDisabled]}
              onPress={handleAuth}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.btnText}>{isRegistering ? 'Register' : 'Log In'}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)} style={styles.toggleAuthBtn}>
              <Text style={styles.toggleAuthText}>
                {isRegistering ? 'Already have an account? Log In' : "Don't have an account? Register"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Backend Endpoint Settings */}
      <Text style={styles.sectionTitle}>Cloud Endpoint Configuration</Text>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>API Server URL</Text>
        <TextInput
          style={styles.input}
          placeholder="https://luphonix.vercel.app"
          placeholderTextColor="#64748B"
          value={serverUrl}
          onChangeText={setServerUrl}
        />
        <TouchableOpacity style={styles.saveUrlBtn} onPress={saveServerUrl}>
          <Text style={styles.saveUrlBtnText}>Update Server URL</Text>
        </TouchableOpacity>
      </View>

      {/* Permissions & System Info */}
      <Text style={styles.sectionTitle}>System Permissions</Text>
      <View style={styles.card}>
        <View style={styles.permRow}>
          <Ionicons name="notifications-outline" size={20} color="#10B981" />
          <Text style={styles.permText}>Android Notifications Channel</Text>
          <Text style={styles.permStatus}>Active</Text>
        </View>
        <View style={styles.permRow}>
          <Ionicons name="mic-outline" size={20} color="#10B981" />
          <Text style={styles.permText}>Voice Assistant (Speech Recognition)</Text>
          <Text style={styles.permStatus}>Ready</Text>
        </View>
        <View style={styles.permRow}>
          <Ionicons name="alarm-outline" size={20} color="#10B981" />
          <Text style={styles.permText}>Exact Alarm & Boot Receiver</Text>
          <Text style={styles.permStatus}>Configured</Text>
        </View>
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
  card: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  appHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  appIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  appName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  appVersion: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  appDescription: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  profileEmail: {
    fontSize: 13,
    color: '#94A3B8',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  syncBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 12,
  },
  logoutBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  authModeTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  authSubmitBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  toggleAuthBtn: {
    alignItems: 'center',
    marginTop: 12,
  },
  toggleAuthText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '500',
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 6,
  },
  saveUrlBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  saveUrlBtnText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 13,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  permText: {
    color: '#E2E8F0',
    fontSize: 13,
    marginLeft: 10,
    flex: 1,
  },
  permStatus: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
});
