import SwiftUI

public struct HydrationView: View {
    @StateObject private var viewModel = HydrationViewModel()
    @State private var showingCustomAmountSheet: Bool = false
    @State private var customAmountText: String = ""
    
    public init() {}
    
    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Large Progress Ring Card
                    hydrationProgressCard
                    
                    // Quick-Add Buttons
                    quickAddGrid
                    
                    // Reminder Status & Pause/Resume
                    reminderStatusCard
                    
                    // Weekly History Chart
                    HydrationWeeklyChart(
                        records: viewModel.weeklyHistory,
                        goalMl: viewModel.dailyGoalMl
                    )
                    
                    // Siri Voice Hint
                    siriVoiceHintCard
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
            .navigationTitle("Hydration")
            .refreshable {
                viewModel.loadHydrationData()
            }
            .sheet(isPresented: $showingCustomAmountSheet) {
                customAmountSheet
            }
        }
    }
    
    // MARK: - Progress Ring Card
    private var hydrationProgressCard: some View {
        VStack(spacing: 16) {
            ZStack {
                CircularProgressView(
                    progress: viewModel.progressPercentage,
                    lineWidth: 18,
                    primaryColor: .cyan,
                    secondaryColor: Color.blue.opacity(0.12),
                    iconName: "drop.fill",
                    centerText: "\(viewModel.currentDayTotalMl) ml",
                    subText: "\(Int(viewModel.progressPercentage * 100))% of goal"
                )
                .frame(width: 200, height: 200)
            }
            .padding(.top, 8)
            
            HStack(spacing: 24) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Daily Goal")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("\(viewModel.dailyGoalMl) ml")
                        .font(.headline)
                        .fontWeight(.bold)
                }
                
                Divider().frame(height: 30)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("Remaining")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("\(viewModel.remainingMl) ml")
                        .font(.headline)
                        .fontWeight(.bold)
                        .foregroundColor(viewModel.remainingMl == 0 ? .green : .primary)
                }
            }
        }
        .glassCard(cornerRadius: 20, padding: 20)
    }
    
    // MARK: - Quick-Add Grid (150, 250, 350, 500 ml)
    private var quickAddGrid: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Log")
                .font(.headline)
                .fontWeight(.bold)
            
            HStack(spacing: 10) {
                quickAddButton(amount: 150, icon: "cup.and.saucer.fill", label: "Glass")
                quickAddButton(amount: 250, icon: "mug.fill", label: "Cup")
                quickAddButton(amount: 350, icon: "wineglass.fill", label: "Mug")
                quickAddButton(amount: 500, icon: "waterbottle.fill", label: "Bottle")
            }
            
            Button(action: {
                customAmountText = ""
                showingCustomAmountSheet = true
            }) {
                HStack {
                    Image(systemName: "plus.circle")
                    Text("Custom Amount...")
                }
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(.blue)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(Color.blue.opacity(0.08))
                .cornerRadius(10)
            }
        }
        .glassCard()
    }
    
    private func quickAddButton(amount: Int, icon: String, label: String) -> some View {
        Button(action: {
            viewModel.logWater(amountMl: amount)
        }) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundColor(.blue)
                Text("+\(amount) ml")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(.primary)
                Text(label)
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(Color(.secondarySystemBackground))
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }
    
    // MARK: - Reminder Status Card
    private var reminderStatusCard: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(viewModel.isReminderPaused ? Color.orange.opacity(0.15) : Color.green.opacity(0.15))
                    .frame(width: 42, height: 42)
                
                Image(systemName: viewModel.isReminderPaused ? "pause.fill" : "alarm.waves.left.and.right.fill")
                    .font(.system(size: 18))
                    .foregroundColor(viewModel.isReminderPaused ? .orange : .green)
            }
            
            VStack(alignment: .leading, spacing: 3) {
                Text(viewModel.isReminderPaused ? "Reminders Paused" : "Active Hydration Reminders")
                    .font(.subheadline)
                    .fontWeight(.bold)
                Text(viewModel.isReminderPaused ? "Tap resume to re-enable notifications" : "Scheduled every \(viewModel.reminderIntervalMinutes) min during active hours")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Button(action: {
                viewModel.togglePauseReminders()
            }) {
                Text(viewModel.isReminderPaused ? "Resume" : "Pause")
                    .font(.caption)
                    .fontWeight(.bold)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(viewModel.isReminderPaused ? Color.green : Color.orange.opacity(0.2))
                    .foregroundColor(viewModel.isReminderPaused ? .white : .orange)
                    .clipShape(Capsule())
            }
        }
        .glassCard()
    }
    
    // MARK: - Siri Voice Hint Card
    private var siriVoiceHintCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "mic.fill")
                .foregroundColor(.purple)
            Text("Try: \"Siri, log 250 ml of water in Synvy\"")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.purple.opacity(0.08))
        .cornerRadius(10)
    }
    
    // MARK: - Custom Amount Sheet
    private var customAmountSheet: some View {
        NavigationStack {
            Form {
                Section(header: Text("Enter Milliliters (ml)")) {
                    TextField("e.g. 400", text: $customAmountText)
                        .keyboardType(.numberPad)
                }
            }
            .navigationTitle("Log Custom Amount")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showingCustomAmountSheet = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Log") {
                        if let ml = Int(customAmountText), ml > 0 {
                            viewModel.logWater(amountMl: ml)
                            showingCustomAmountSheet = false
                        }
                    }
                    .disabled(Int(customAmountText) == nil || (Int(customAmountText) ?? 0) <= 0)
                }
            }
        }
        .presentationDetents([.fraction(0.3)])
    }
}
