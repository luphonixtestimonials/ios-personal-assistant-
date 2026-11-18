import Foundation
import AppIntents

public struct SynvyShortcuts: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AddReminderIntent(),
            phrases: [
                "Add a reminder in \(.applicationName) to \(\.$title)",
                "Add a reminder in \(.applicationName)",
                "Remind me in \(.applicationName) to \(\.$title)",
                "Remind me to take my medicine in \(.applicationName)",
                "Remind me in \(.applicationName) to call my friend"
            ],
            shortTitle: "Add Smart Reminder",
            systemImageName: "bell.badge.fill"
        )
        
        AppShortcut(
            intent: AddTaskIntent(),
            phrases: [
                "Add a task to \(\.$title) in \(.applicationName)",
                "Add a task in \(.applicationName)",
                "Create a new task in \(.applicationName)"
            ],
            shortTitle: "Add Task",
            systemImageName: "checklist"
        )
        
        AppShortcut(
            intent: LogWaterIntent(),
            phrases: [
                "Log \(\.$amountMl) ml of water in \(.applicationName)",
                "Track water in \(.applicationName)",
                "Log water in \(.applicationName)"
            ],
            shortTitle: "Log Water",
            systemImageName: "drop.fill"
        )
        
        AppShortcut(
            intent: GetHydrationIntent(),
            phrases: [
                "How much water have I drunk today in \(.applicationName)",
                "Check water intake in \(.applicationName)",
                "What is my hydration progress in \(.applicationName)"
            ],
            shortTitle: "Check Hydration",
            systemImageName: "waterbottle.fill"
        )
        
        AppShortcut(
            intent: GetTodayTasksIntent(),
            phrases: [
                "What are my tasks for today in \(.applicationName)",
                "What is my schedule today in \(.applicationName)",
                "Check today's tasks in \(.applicationName)"
            ],
            shortTitle: "Today's Tasks",
            systemImageName: "calendar.day.timeline.left"
        )
        
        AppShortcut(
            intent: CompleteTaskIntent(),
            phrases: [
                "Mark \(\.$taskTitle) as completed in \(.applicationName)",
                "Complete task in \(.applicationName)"
            ],
            shortTitle: "Complete Task",
            systemImageName: "checkmark.circle.fill"
        )
        
        AppShortcut(
            intent: AssignTaskIntent(),
            phrases: [
                "Assign task \(\.$task) to \(\.$to) in \(.applicationName)",
                "Assign \(\.$task) to \(\.$to) in \(.applicationName)",
                "Delegate \(\.$task) to \(\.$to) in \(.applicationName)"
            ],
            shortTitle: "Assign Task to Person",
            systemImageName: "person.badge.shield.checkmark.fill"
        )
        
        AppShortcut(
            intent: SetWaterReminderIntervalIntent(),
            phrases: [
                "Remind me to drink water every hour in \(.applicationName)",
                "Set water reminders in \(.applicationName)"
            ],
            shortTitle: "Water Reminder Schedule",
            systemImageName: "alarm.waves.left.and.right.fill"
        )
    }
}
