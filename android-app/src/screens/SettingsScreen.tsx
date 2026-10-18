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
import { UserProfile, Friend } from '../types';

export const SettingsScreen: React.FC = () => {
  const [serverUrl, setServerUrl] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Auth fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot_password'>('login');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Reset password fields (logged-out)
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Change password fields (logged-in)
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [changeNewPassword, setChangeNewPassword] = useState('');
  const [changeConfirmPassword, setChangeConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Friends & Collaboration
  const [friends, setFriends] = useState<Friend[]>([]);
  const [newFriendHandle, setNewFriendHandle] = useState('');
  const [isAddingFriend, setIsAddingFriend] = useState(false);

  useEffect(() => {
    (async () => {
      const url = await StorageService.getServerUrl();
      const profile = await StorageService.getUserProfile();
      const cachedFriends = await StorageService.getFriends();
      setServerUrl(url);
      setUserProfile(profile);
      setFriends(cachedFriends);

      if (profile?.token) {
        try {
          const remoteFriends = await ApiService.getFriends();
          if (remoteFriends) setFriends(remoteFriends);
        } catch {}
      }
    })();
  }, []);

  const handleAddFriend = async () => {
    if (!newFriendHandle.trim()) {
      Alert.alert('Required', 'Please enter a username or email (e.g. @keval or @alex)');
      return;
    }
    setIsAddingFriend(true);
    const res = await ApiService.addFriend(newFriendHandle.trim());
    setIsAddingFriend(false);
    if (res.success && res.friend) {
      setNewFriendHandle('');
      const updated = [...friends.filter((f) => f.id !== res.friend!.id), res.friend];
      setFriends(updated);
      Alert.alert('Friend Connected!', `You are now connected with @${res.friend.username}. You can assign tasks to each other!`);
    } else {
      Alert.alert('Could Not Connect', res.error || 'Failed to add friend. Verify the username.');
    }
  };

  const handleRemoveFriend = async (friend: Friend) => {
    Alert.alert('Remove Friend', `Disconnect from @${friend.username}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await ApiService.removeFriend(friend.id);
          setFriends(friends.filter((f) => f.id !== friend.id));
        },
      },
    ]);
  };

  const saveServerUrl = async () => {
    if (!serverUrl.trim()) return;
    const clean = serverUrl.trim().replace(/\/+$/, '');
    await StorageService.saveServerUrl(clean);
    setServerUrl(clean);
    Alert.alert('Saved', `Backend server URL set to:\n${clean}`);
  };

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    if (authMode === 'register' && password.length < 6) {
      Alert.alert('Password Too Short', 'Password must be at least 6 characters long.');
      return;
    }

    // Auto-save whatever server URL is currently entered
    if (serverUrl.trim()) {
      const clean = serverUrl.trim().replace(/\/+$/, '');
      await StorageService.saveServerUrl(clean);
    }

    setIsAuthenticating(true);
    let result;
    if (authMode === 'register') {
      result = await ApiService.register(name.trim() || 'Luphonix User', email.trim(), password);
    } else {
      result = await ApiService.login(email.trim(), password);
    }
    setIsAuthenticating(false);

    if (result.success && result.user) {
      setUserProfile(result.user);
      Alert.alert('Success', `Welcome, ${result.user.name}!`);
    } else {
      const err = result.error || 'Authentication failed';
      if (err.toLowerCase().includes('already exists')) {
        Alert.alert(
          'Account Exists',
          'An account with this email already exists. Switch to Log In?',
          [
            { text: 'Switch to Log In', onPress: () => setAuthMode('login') },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert('Authentication Error', err);
      }
    }
  };

  const handleResetPassword = async () => {
    if (!resetIdentifier.trim()) {
      Alert.alert('Required', 'Please enter your account email or @username.');
      return;
    }
    if (!resetNewPassword || resetNewPassword.length < 6) {
      Alert.alert('Invalid Password', 'New password must be at least 6 characters long.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match. Please verify.');
      return;
    }

    setIsResetting(true);
    const res = await ApiService.resetPassword(resetIdentifier.trim(), resetNewPassword);
    setIsResetting(false);

    if (res.success) {
      Alert.alert('Password Reset', res.message || 'Password reset successfully! Please log in with your new password.');
      setResetIdentifier('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      setAuthMode('login');
    } else {
      Alert.alert('Reset Failed', res.error || 'Could not reset password. Check email/username.');
    }
  };

  const handleChangePassword = async () => {
    if (!changeNewPassword || changeNewPassword.length < 6) {
      Alert.alert('Invalid Password', 'New password must be at least 6 characters long.');
      return;
    }
    if (changeNewPassword !== changeConfirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match. Please verify.');
      return;
    }

    setIsChangingPassword(true);
    const res = await ApiService.changePassword(currentPassword, changeNewPassword);
    setIsChangingPassword(false);

    if (res.success) {
      Alert.alert('Password Updated', res.message || 'Your password was changed successfully.');
      setCurrentPassword('');
      setChangeNewPassword('');
      setChangeConfirmPassword('');
      setShowChangePassword(false);
    } else {
      Alert.alert('Change Failed', res.error || 'Could not update password. Please check your current password.');
    }
  };

  const handleLogout = async () => {
    await StorageService.saveUserProfile(null);
    setUserProfile(null);
    setShowChangePassword(false);
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
              <Ionicons name="person-circle-outline" size={44} color="#38BDF8" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.profileName}>{userProfile.name}</Text>
                <Text style={styles.profileEmail}>{userProfile.email}</Text>
                <View style={styles.handleBadge}>
                  <Ionicons name="at-outline" size={12} color="#06B6D4" style={{ marginRight: 2 }} />
                  <Text style={styles.handleBadgeText}>
                    {userProfile.username || userProfile.email.split('@')[0]}
                  </Text>
                </View>
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

              <TouchableOpacity
                style={styles.changePwdToggleBtn}
                onPress={() => setShowChangePassword(!showChangePassword)}
              >
                <Ionicons name="key-outline" size={16} color="#38BDF8" style={{ marginRight: 4 }} />
                <Text style={styles.changePwdToggleText}>Password</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutBtnText}>Log Out</Text>
              </TouchableOpacity>
            </View>

            {/* Change Password Expansion Form */}
            {showChangePassword && (
              <View style={styles.changePasswordCard}>
                <View style={styles.changePwdHeaderRow}>
                  <Ionicons name="lock-closed-outline" size={18} color="#38BDF8" style={{ marginRight: 6 }} />
                  <Text style={styles.changePwdTitle}>Change Account Password</Text>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Current Password"
                  placeholderTextColor="#64748B"
                  secureTextEntry
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                />
                <TextInput
                  style={styles.input}
                  placeholder="New Password (min 6 characters)"
                  placeholderTextColor="#64748B"
                  secureTextEntry
                  value={changeNewPassword}
                  onChangeText={setChangeNewPassword}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm New Password"
                  placeholderTextColor="#64748B"
                  secureTextEntry
                  value={changeConfirmPassword}
                  onChangeText={setChangeConfirmPassword}
                />

                <View style={styles.changePwdActionsRow}>
                  <TouchableOpacity
                    style={[styles.updatePwdBtn, isChangingPassword && styles.btnDisabled]}
                    onPress={handleChangePassword}
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.btnText}>Update Password</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cancelPwdBtn}
                    onPress={() => {
                      setShowChangePassword(false);
                      setCurrentPassword('');
                      setChangeNewPassword('');
                      setChangeConfirmPassword('');
                    }}
                  >
                    <Text style={styles.cancelPwdBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View>
            {/* Mode Header */}
            <Text style={styles.authModeTitle}>
              {authMode === 'register'
                ? 'Create Luphonix Account'
                : authMode === 'forgot_password'
                ? 'Reset Account Password'
                : 'Sign In with Luphonix'}
            </Text>

            {authMode === 'forgot_password' && (
              <Text style={styles.authModeSubtitle}>
                Enter your registered email address or @username handle, along with a new password to reset your credentials.
              </Text>
            )}

            {/* Register specific name field */}
            {authMode === 'register' && (
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#64748B"
                value={name}
                onChangeText={setName}
              />
            )}

            {/* Input fields based on mode */}
            {authMode === 'forgot_password' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Email or @username (e.g. user@example.com or @alex)"
                  placeholderTextColor="#64748B"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={resetIdentifier}
                  onChangeText={setResetIdentifier}
                />
                <TextInput
                  style={styles.input}
                  placeholder="New Password (min 6 chars)"
                  placeholderTextColor="#64748B"
                  secureTextEntry
                  value={resetNewPassword}
                  onChangeText={setResetNewPassword}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm New Password"
                  placeholderTextColor="#64748B"
                  secureTextEntry
                  value={resetConfirmPassword}
                  onChangeText={setResetConfirmPassword}
                />

                <TouchableOpacity
                  style={[styles.authSubmitBtn, isResetting && styles.btnDisabled]}
                  onPress={handleResetPassword}
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.btnText}>Reset & Set New Password</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setAuthMode('login')}
                  style={styles.toggleAuthBtn}
                >
                  <Text style={styles.toggleAuthText}>Back to Sign In</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
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
                    <Text style={styles.btnText}>{authMode === 'register' ? 'Register' : 'Log In'}</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.authNavLinksRow}>
                  <TouchableOpacity
                    onPress={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}
                    style={styles.authNavLink}
                  >
                    <Text style={styles.toggleAuthText}>
                      {authMode === 'register' ? 'Already have an account? Log In' : "Don't have an account? Register"}
                    </Text>
                  </TouchableOpacity>

                  {authMode === 'login' && (
                    <TouchableOpacity
                      onPress={() => setAuthMode('forgot_password')}
                      style={styles.forgotPasswordLink}
                    >
                      <Ionicons name="key-outline" size={13} color="#06B6D4" style={{ marginRight: 4 }} />
                      <Text style={styles.forgotPasswordText}>Reset Password?</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        )}
      </View>

      {/* Friends & Collaboration Section */}
      <Text style={styles.sectionTitle}>Friends & Collaboration</Text>
      <View style={styles.card}>
        <View style={styles.friendHeaderRow}>
          <Ionicons name="people" size={20} color="#06B6D4" style={{ marginRight: 8 }} />
          <Text style={styles.friendHeaderTitle}>Connected Teammates</Text>
        </View>
        <Text style={styles.friendHeaderDesc}>
          Connect with friends using unique handles (@username) to assign and share tasks.
        </Text>

        <View style={styles.addFriendBox}>
          <TextInput
            style={styles.friendInput}
            placeholder="Enter @username (e.g. @alex, @keval)"
            placeholderTextColor="#64748B"
            value={newFriendHandle}
            onChangeText={setNewFriendHandle}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.addFriendSubmitBtn, isAddingFriend && styles.btnDisabled]}
            onPress={handleAddFriend}
            disabled={isAddingFriend}
          >
            {isAddingFriend ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.addFriendBtnLabel}>Connect</Text>
            )}
          </TouchableOpacity>
        </View>

        {friends.length > 0 ? (
          <View style={styles.friendsListContainer}>
            {friends.map((f) => (
              <View key={f.id} style={styles.friendItem}>
                <View style={styles.friendAvatarCircle}>
                  <Text style={styles.friendAvatarInitial}>{f.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.friendItemName}>{f.name}</Text>
                  <Text style={styles.friendItemHandle}>@{f.username}</Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveFriend(f)} style={styles.friendRemoveAction}>
                  <Ionicons name="person-remove-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyFriendsContainer}>
            <Ionicons name="person-add-outline" size={24} color="#475569" style={{ marginBottom: 6 }} />
            <Text style={styles.emptyFriendsMsg}>No friends connected yet.</Text>
            <Text style={styles.emptyFriendsHint}>
              Enter demo handles like @alex or @keval above to test instant collaboration!
            </Text>
          </View>
        )}
      </View>

      {/* Backend Endpoint Settings */}
      <Text style={styles.sectionTitle}>Cloud Endpoint Configuration</Text>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>API Server URL</Text>
        <TextInput
          style={styles.input}
          placeholder="https://luphonix-web.vercel.app"
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
  handleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  handleBadgeText: {
    color: '#06B6D4',
    fontSize: 12,
    fontWeight: '700',
  },
  friendHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  friendHeaderTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  friendHeaderDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  addFriendBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  friendInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
  },
  addFriendSubmitBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFriendBtnLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  friendsListContainer: {
    gap: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  friendAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0E7490',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendAvatarInitial: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  friendItemName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  friendItemHandle: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '500',
  },
  friendRemoveAction: {
    padding: 6,
  },
  emptyFriendsContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
  },
  emptyFriendsMsg: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyFriendsHint: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  changePwdToggleBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  changePwdToggleText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  changePasswordCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  changePwdHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  changePwdTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  changePwdActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  updatePwdBtn: {
    flex: 1,
    backgroundColor: '#0284C7',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPwdBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPwdBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  authModeSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  authNavLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  authNavLink: {
    flex: 1,
  },
  forgotPasswordLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  forgotPasswordText: {
    color: '#06B6D4',
    fontSize: 13,
    fontWeight: '600',
  },
});
