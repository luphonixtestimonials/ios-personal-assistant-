# Luphonix — Android React Native Application & APK Build Guide

## 📱 Overview

The **Luphonix Android App** is a modern, high-performance mobile client built with **React Native (Expo SDK 58)**, designed to provide 100% feature parity with the iOS version for Android devices:

- 🔔 **Smart Daily Reminders**: Local actionable notifications, recurring reminders (daily, weekly, weekdays), snooze functionality (+15m), and alarm scheduling.
- 💧 **Hydration Tracker**: Daily target goal adjuster, circular progress dial, quick one-tap logging (150ml Glass, 250ml Cup, 350ml Mug, 500ml Bottle, and Custom ml), periodic drink water alert interval, and 7-day historical bar trend chart.
- 📋 **Comprehensive Task Manager**: Create, edit, complete, prioritize (*Low, Medium, High*), filter (*All, Pending, Completed, High*), search, and checklist/subtasks.
- 🎙️ **Android Voice Assistant**: Built-in voice parser and text-to-speech audio feedback replicating Siri functionality on Android ("Log 250ml of water", "Remind me to call John at 8 PM", "What are my tasks for today?").
- ☁️ **Cloud Synchronization & Offline Mode**: Seamless offline-first persistence with AsyncStorage, configurable API endpoint, and cloud account sync with the TypeScript Hono backend.

---

## 🛠️ Project Structure

```
ios-personal-assistant-/
├── android-app/
│   ├── App.tsx                     # Root application container & tab navigator
│   ├── app.json                    # Android package, permissions & notification config
│   ├── assets/                     # Luphonix brand icons & splash graphics
│   ├── src/
│   │   ├── types/index.ts          # Core TypeScript models (Task, Reminder, Hydration)
│   │   ├── services/
│   │   │   ├── storage.ts          # Offline-first AsyncStorage engine
│   │   │   ├── notifications.ts    # Android notification channels & alarms
│   │   │   ├── api.ts              # REST API sync & auth service
│   │   │   └── voiceAssistant.ts   # Natural voice parser & Speech synthesis
│   │   ├── screens/
│   │   │   ├── DashboardScreen.tsx # Daily overview, water stats, quick actions
│   │   │   ├── TasksScreen.tsx     # Full task lifecycle & subtasks
│   │   │   ├── HydrationScreen.tsx # Water ring, 7-day charts, reminder settings
│   │   │   ├── RemindersScreen.tsx # Scheduled alarms, snooze & test trigger
│   │   │   └── SettingsScreen.tsx  # Server URL, profile, cloud sync & permissions
│   │   └── components/
│   │       └── VoiceAssistantModal.tsx # Interactive voice assistant interface
│   └── android/                    # Native Gradle project & build scripts
```

---

## 🚀 Running in Development Mode

To start the Expo development server:

```bash
npm run android:dev
```
Or inside `android-app/`:
```bash
cd android-app
npm start
```

Press `a` in the terminal to launch on a connected Android phone (via USB debugging) or Android Virtual Device (AVD).

---

## 📦 Building the Android APK

### Building Release APK
From the root repository:
```bash
npm run android:apk
```

Or from `android-app/android`:
```bash
cd android-app/android
gradlew.bat assembleRelease
```

The compiled release APK will be located at:
```
android-app/android/app/build/outputs/apk/release/app-release.apk
```

### Building Debug APK
```bash
cd android-app/android
gradlew.bat assembleDebug
```
The compiled debug APK will be located at:
```
android-app/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📲 Installing on Your Android Phone

1. Enable **Developer Options** on your Android device (Settings -> About Phone -> tap Build Number 7 times).
2. Enable **USB Debugging**.
3. Connect your phone via USB cable and install directly:
   ```bash
   adb install -r android-app/android/app/build/outputs/apk/release/app-release.apk
   ```
4. Or copy `app-release.apk` to your phone via Google Drive, WhatsApp, or USB transfer and open the file to install.
