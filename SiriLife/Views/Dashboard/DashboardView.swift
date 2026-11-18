import SwiftUI

public struct DashboardView: View {
    @StateObject private var viewModel = DashboardViewModel()
    @State private var showingAddTaskSheet: Bool = false
    @State private var showingAddReminderSheet: Bool = false
    @State private var newTaskTitle: String = ""
    @State private var newReminderTitle: String = ""
    @State private var newReminderDate: Date = Date().addingTimeInterval(3600)
    
    public init() {}
    
    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Header: Greeting & Date
                    headerSection
                    
                    // Quick Stat Cards: Tasks & Hydration
                    statsGridSection
                    
                    // Quick Action Buttons
                    quickActionsSection
                    
                    // Siri Voice Assistant Card
                    siriShortcutBanner
                    
                    // Upcoming Reminders & Timeline
                    upcomingRemindersSection
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
            .navigationTitle("Synvy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        HapticFeedback.shared.impact(.light)
                        viewModel.loadDashboardData()
                    }) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 14, weight: .semibold))
                    }
                }
            }
            .refreshable {
                viewModel.loadDashboardData()
            }
            .sheet(isPresented: $showingAddTaskSheet) {
                quickAddTaskSheet
            }
            .sheet(isPresented: $showingAddReminderSheet) {
                quickAddReminderSheet
            }
        }
    }
    
    // MARK: - Header
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(viewModel.greeting)
                .font(.system(.title2, design: .rounded).weight(.bold))
                .foregroundColor(.primary)
            
            Text(viewModel.currentDateFormatted)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 8)
    }
    
    // MARK: - Stats Grid (Tasks & Water)
    private var statsGridSection: some View {
        HStack(spacing: 14) {
            // Task Progress Card
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    ZStack {
                        Circle()
                            .fill(Color.indigo.opacity(0.12))
                            .frame(width: 36, height: 36)
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 16))
                            .foregroundColor(.indigo)
                    }
                    Spacer()
                    Text("\(Int(viewModel.tasksProgress * 100))%")
                        .font(.system(.caption, design: .rounded).weight(.bold))
                        .foregroundColor(.indigo)
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(viewModel.todayTasksCompleted)/\(viewModel.todayTasksTotal)")
                        .font(.system(.title3, design: .rounded).weight(.bold))
                    Text("Tasks Today")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                
                ProgressView(value: viewModel.tasksProgress)
                    .tint(.indigo)
            }
            .glassCard()
            
            // Water Intake Card
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    ZStack {
                        Circle()
                            .fill(Color.blue.opacity(0.12))
                            .frame(width: 36, height: 36)
                        Image(systemName: "drop.fill")
                            .font(.system(size: 16))
                            .foregroundColor(.blue)
                    }
                    Spacer()
                    Text("\(Int(viewModel.waterProgress * 100))%")
                        .font(.system(.caption, design: .rounded).weight(.bold))
                        .foregroundColor(.blue)
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(viewModel.waterIntakeMl) ml")
                        .font(.system(.title3, design: .rounded).weight(.bold))
                    Text("Goal: \(viewModel.waterGoalMl) ml")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                
                ProgressView(value: viewModel.waterProgress)
                    .tint(.blue)
            }
            .glassCard()
        }
    }
    
    // MARK: - Quick Action Buttons
    private var quickActionsSection: some View {
        HStack(spacing: 12) {
            // Quick Add Task Button
            Button(action: {
                HapticFeedback.shared.impact(.light)
                showingAddTaskSheet = true
            }) {
                HStack {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 16, weight: .bold))
                    Text("Add Task")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.indigo)
                .cornerRadius(12)
            }
            
            // Quick Add Water Button (+250ml)
            Button(action: {
                viewModel.quickLogWater(amountMl: 250)
            }) {
                HStack {
                    Image(systemName: "drop.circle.fill")
                        .font(.system(size: 16, weight: .bold))
                    Text("+250 ml Water")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.blue)
                .cornerRadius(12)
            }
        }
    }
    
    // MARK: - Siri Shortcut Banner
    private var siriShortcutBanner: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.purple, Color.blue, Color.pink],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 44, height: 44)
                
                Image(systemName: "waveform")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(.white)
            }
            
            VStack(alignment: .leading, spacing: 3) {
                Text("Built-in Siri Ready")
                    .font(.subheadline)
                    .fontWeight(.bold)
                Text("\"Siri, what are my tasks for today in Synvy?\"")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .glassCard()
    }
    
    // MARK: - Upcoming Reminders
    private var upcomingRemindersSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Upcoming Schedule")
                    .font(.headline)
                    .fontWeight(.bold)
                
                Spacer()
                
                Button(action: {
                    showingAddReminderSheet = true
                }) {
                    Text("+ Reminder")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.blue)
                }
            }
            
            if viewModel.upcomingReminders.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "bell.slash")
                        .font(.title2)
                        .foregroundColor(.secondary)
                    Text("No upcoming reminders right now")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
                .glassCard()
            } else {
                VStack(spacing: 10) {
                    ForEach(viewModel.upcomingReminders) { reminder in
                        HStack(spacing: 12) {
                            Circle()
                                .fill(reminder.category.color)
                                .frame(width: 10, height: 10)
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text(reminder.title)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                Text(reminder.formattedScheduledTime)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            
                            Spacer()
                            
                            Text(reminder.category.displayName)
                                .font(.caption2)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(reminder.category.color.opacity(0.12))
                                .foregroundColor(reminder.category.color)
                                .clipShape(Capsule())
                        }
                        .padding(.vertical, 4)
                        
                        if reminder.id != viewModel.upcomingReminders.last?.id {
                            Divider()
                        }
                    }
                }
                .glassCard()
            }
        }
    }
    
    // MARK: - Quick Add Task Sheet
    private var quickAddTaskSheet: some View {
        NavigationStack {
            Form {
                Section(header: Text("Task Details")) {
                    TextField("What do you want to accomplish?", text: $newTaskTitle)
                }
            }
            .navigationTitle("New Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showingAddTaskSheet = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        if !newTaskTitle.isEmpty {
                            let task = TaskItem(title: newTaskTitle, dueAt: Date(), category: .personal)
                            StorageManager.shared.addTask(task)
                            viewModel.loadDashboardData()
                            newTaskTitle = ""
                            showingAddTaskSheet = false
                            HapticFeedback.shared.notification(.success)
                        }
                    }
                    .disabled(newTaskTitle.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.fraction(0.35)])
    }
    
    // MARK: - Quick Add Reminder Sheet
    private var quickAddReminderSheet: some View {
        NavigationStack {
            Form {
                Section(header: Text("Reminder Details")) {
                    TextField("Reminder title", text: $newReminderTitle)
                    DatePicker("Time", selection: $newReminderDate, in: Date()...)
                }
            }
            .navigationTitle("New Reminder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showingAddReminderSheet = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Schedule") {
                        if !newReminderTitle.isEmpty {
                            let reminder = ReminderItem(
                                title: newReminderTitle,
                                scheduledAt: newReminderDate,
                                category: .personal
                            )
                            StorageManager.shared.addReminder(reminder)
                            NotificationManager.shared.scheduleReminderNotification(for: reminder)
                            viewModel.loadDashboardData()
                            newReminderTitle = ""
                            showingAddReminderSheet = false
                            HapticFeedback.shared.notification(.success)
                        }
                    }
                    .disabled(newReminderTitle.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.fraction(0.4)])
    }
}
