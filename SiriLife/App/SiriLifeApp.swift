import SwiftUI

@main
struct SiriLifeApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        WindowGroup {
            RootView()
                .onAppear {
                    // Seed initial demo data if first launch
                    seedInitialDataIfNeeded()
                }
        }
    }
    
    private func seedInitialDataIfNeeded() {
        let existingTasks = StorageManager.shared.getTasks()
        if existingTasks.isEmpty {
            let demoTasks = [
                TaskItem(
                    title: "Review Synvy Architecture Specs",
                    description: "Verify App Intents and Turso libSQL schema",
                    dueAt: Calendar.current.date(bySettingHour: 20, minute: 0, second: 0, of: Date()),
                    priority: .high,
                    category: .work
                ),
                TaskItem(
                    title: "Drink a tall glass of water",
                    description: "Stay hydrated throughout the afternoon",
                    dueAt: Date().addingTimeInterval(1800),
                    priority: .medium,
                    category: .health
                ),
                TaskItem(
                    title: "Call Alex for project sync",
                    description: "Discuss iOS shortcuts and voice triggers",
                    dueAt: Calendar.current.date(bySettingHour: 18, minute: 0, second: 0, of: Date()),
                    priority: .medium,
                    category: .personal
                )
            ]
            StorageManager.shared.saveTasks(demoTasks)
        }
        
        let existingReminders = StorageManager.shared.getReminders()
        if existingReminders.isEmpty {
            let demoReminders = [
                ReminderItem(
                    title: "Take evening vitamins & medicine",
                    description: "Daily health routine",
                    scheduledAt: Calendar.current.date(bySettingHour: 21, minute: 0, second: 0, of: Date()) ?? Date(),
                    recurrenceRule: .daily,
                    category: .health,
                    priority: .high
                ),
                ReminderItem(
                    title: "Read 20 pages of Swift Concurrency guide",
                    description: "Daily study habit",
                    scheduledAt: Calendar.current.date(bySettingHour: 22, minute: 0, second: 0, of: Date()) ?? Date(),
                    recurrenceRule: .daily,
                    category: .study,
                    priority: .medium
                )
            ]
            StorageManager.shared.saveReminders(demoReminders)
            for r in demoReminders {
                NotificationManager.shared.scheduleReminderNotification(for: r)
            }
        }
    }
}
