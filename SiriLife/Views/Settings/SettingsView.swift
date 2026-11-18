import SwiftUI
import UserNotifications

public struct SettingsView: View {
    @StateObject private var viewModel = SettingsViewModel()
    @ObservedObject private var authManager = AuthManager.shared
    @AppStorage("synvy_backend_url") private var backendUrl: String = ""
    
    let intervals = [30, 60, 90, 120]
    
    public init() {}
    
    public var body: some View {
        NavigationStack {
            Form {
                // Section: Notification Status
                notificationStatusSection
                
                // Section: Cloud Backend & Server
                serverConfigSection
                
                // Section: User Profile & Cloud Sync
                profileSection
                
                // Section: Hydration Settings
                hydrationSettingsSection
                
                // Section: Quiet Hours & Active Schedule
                scheduleSection
                
                // Section: Notifications & Alerts
                alertSettingsSection
                
                // Section: Siri & Shortcuts Commands
                siriGuideSection
                
                // Section: Data & Account
                accountActionsSection
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $viewModel.isShowingExportSheet) {
                exportDataSheet
            }
            .alert("Delete Account", isPresented: $viewModel.isShowingDeleteConfirm) {
                Button("Delete", role: .destructive) {
                    viewModel.deleteAccount()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Are you sure? This will permanently delete your account, tasks, reminders, and hydration records from Turso database.")
            }
        }
    }
    
    // MARK: - Notification Status Section
    private var notificationStatusSection: some View {
        Section {
            if viewModel.notificationStatus == .authorized {
                HStack {
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundColor(.green)
                    Text("Notifications Active")
                        .font(.subheadline)
                    Spacer()
                    Text("Local Alerts Ready")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.orange)
                        Text("Notifications Disabled")
                            .font(.subheadline)
                            .fontWeight(.bold)
                    }
                    Text("Reminders and water alerts require notification permission. Please enable notifications in iOS Settings.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Button("Enable Notifications") {
                        if viewModel.notificationStatus == .denied {
                            if let url = URL(string: UIApplication.openSettingsURLString) {
                                UIApplication.shared.open(url)
                            }
                        } else {
                            viewModel.requestNotificationPermission()
                        }
                    }
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.blue)
                }
                .padding(.vertical, 4)
            }
        }
    }
    
    // MARK: - Server Configuration Section
    private var serverConfigSection: some View {
        Section(
            header: Text("Cloud Backend (Vercel)"),
            footer: Text("Paste your deployed Vercel URL (e.g. https://your-project.vercel.app) to connect everywhere over 5G/Wi-Fi.")
        ) {
            HStack {
                Label("Platform", systemImage: "cloud.fill")
                Spacer()
                Text("Vercel Serverless")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            HStack {
                Image(systemName: "link")
                    .foregroundColor(.blue)
                TextField("https://your-api.vercel.app", text: $backendUrl)
                    .font(.subheadline)
                    .autocapitalization(.none)
                    .disableAutocorrection(true)
            }
        }
    }
    
    // MARK: - Profile Section
    private var profileSection: some View {
        Section(header: Text("Account & Cloud Database")) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(Color.blue.opacity(0.15))
                        .frame(width: 48, height: 48)
                    Text(authManager.currentUser?.name.prefix(1) ?? "L")
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundColor(.blue)
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(authManager.currentUser?.name ?? "Synvy User")
                        .font(.headline)
                    Text(authManager.currentUser?.email ?? "user@synvy.app")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.vertical, 4)
            
            HStack {
                Label("Online Database", systemImage: "cylinder.split.1x2.fill")
                Spacer()
                Text("Turso (libSQL)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            HStack {
                Label("Time Zone", systemImage: "globe")
                Spacer()
                Text(TimeZone.current.identifier)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
    
    // MARK: - Hydration Settings
    private var hydrationSettingsSection: some View {
        Section(header: Text("Hydration Goals & Reminders")) {
            Stepper(value: $viewModel.preferences.dailyWaterGoalMl, in: 1000...5000, step: 250) {
                HStack {
                    Text("Daily Water Goal")
                    Spacer()
                    Text("\(viewModel.preferences.dailyWaterGoalMl) ml")
                        .foregroundColor(.blue)
                        .fontWeight(.semibold)
                }
            }
            .onChange(of: viewModel.preferences.dailyWaterGoalMl) { _ in
                viewModel.savePreferences()
            }
            
            Picker("Reminder Interval", selection: $viewModel.preferences.waterReminderIntervalMinutes) {
                ForEach(intervals, id: \.self) { interval in
                    Text("Every \(interval) minutes").tag(interval)
                }
            }
            .onChange(of: viewModel.preferences.waterReminderIntervalMinutes) { _ in
                viewModel.savePreferences()
            }
        }
    }
    
    // MARK: - Schedule Section
    private var scheduleSection: some View {
        Section(header: Text("Active Hours & Quiet Hours")) {
            HStack {
                Text("Waking Time")
                Spacer()
                TextField("HH:mm", text: $viewModel.preferences.wakingTime)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 80)
            }
            .onChange(of: viewModel.preferences.wakingTime) { _ in
                viewModel.savePreferences()
            }
            
            HStack {
                Text("Sleeping Time")
                Spacer()
                TextField("HH:mm", text: $viewModel.preferences.sleepingTime)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 80)
            }
            .onChange(of: viewModel.preferences.sleepingTime) { _ in
                viewModel.savePreferences()
            }
            
            Toggle("Quiet Hours Enabled", isOn: $viewModel.preferences.quietHoursEnabled)
                .onChange(of: viewModel.preferences.quietHoursEnabled) { _ in
                    viewModel.savePreferences()
                }
        }
    }
    
    // MARK: - Alert Settings
    private var alertSettingsSection: some View {
        Section(header: Text("Sound & Vibration")) {
            Toggle("Reminder Sound", isOn: $viewModel.preferences.notificationPreferences.remindersSound)
                .onChange(of: viewModel.preferences.notificationPreferences.remindersSound) { _ in
                    viewModel.savePreferences()
                }
            
            Toggle("Water Reminder Sound", isOn: $viewModel.preferences.notificationPreferences.waterSound)
                .onChange(of: viewModel.preferences.notificationPreferences.waterSound) { _ in
                    viewModel.savePreferences()
                }
            
            Toggle("Haptic Feedback", isOn: $viewModel.preferences.notificationPreferences.vibration)
                .onChange(of: viewModel.preferences.notificationPreferences.vibration) { _ in
                    viewModel.savePreferences()
                }
        }
    }
    
    // MARK: - Siri Guide Section
    private var siriGuideSection: some View {
        Section(header: Text("Siri Voice Commands")) {
            siriCommandRow(phrase: "\"Siri, add a reminder in Synvy to study at 8 PM.\"")
            siriCommandRow(phrase: "\"Siri, remind me to drink water every hour in Synvy.\"")
            siriCommandRow(phrase: "\"Siri, add a task to complete my project tomorrow in Synvy.\"")
            siriCommandRow(phrase: "\"Siri, what are my tasks for today in Synvy?\"")
            siriCommandRow(phrase: "\"Siri, mark my study task as completed in Synvy.\"")
            siriCommandRow(phrase: "\"Siri, log 250 ml of water in Synvy.\"")
            siriCommandRow(phrase: "\"Siri, how much water have I drunk today in Synvy?\"")
        }
    }
    
    private func siriCommandRow(phrase: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "waveform.circle.fill")
                .foregroundColor(.purple)
                .font(.system(size: 16))
            Text(phrase)
                .font(.caption)
                .foregroundColor(.primary)
        }
        .padding(.vertical, 2)
    }
    
    // MARK: - Account Actions Section
    private var accountActionsSection: some View {
        Section(header: Text("Data Privacy & Session")) {
            Button(action: {
                viewModel.exportData()
            }) {
                Label("Export Personal Data (JSON)", systemImage: "square.and.arrow.up")
            }
            
            Button(action: {
                authManager.logout()
            }) {
                Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                    .foregroundColor(.orange)
            }
            
            Button(role: .destructive, action: {
                viewModel.isShowingDeleteConfirm = true
            }) {
                Label("Delete Account & Data", systemImage: "trash")
                    .foregroundColor(.red)
            }
        }
    }
    
    // MARK: - Export Data Sheet
    private var exportDataSheet: some View {
        NavigationStack {
            ScrollView {
                Text(viewModel.exportedDataString ?? "No data")
                    .font(.system(.caption, design: .monospaced))
                    .padding()
            }
            .navigationTitle("Export Data")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { viewModel.isShowingExportSheet = false }
                }
            }
        }
    }
}
