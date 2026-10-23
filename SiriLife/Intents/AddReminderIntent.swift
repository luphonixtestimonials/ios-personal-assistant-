import Foundation
import AppIntents

public struct AddReminderIntent: AppIntent {
    public static var title: LocalizedStringResource = "Add Reminder in Synvy"
    public static var description = IntentDescription("Schedules a smart reminder in Synvy with notifications.")
    
    @Parameter(title: "Reminder Title", requestValueDialog: "What do you want to be reminded about?")
    public var title: String
    
    @Parameter(title: "Time", requestValueDialog: "At what time should I remind you?")
    public var scheduledAt: Date
    
    @Parameter(title: "Repeat Frequency", default: .none)
    public var recurrenceRule: RecurrenceRule
    
    public init() {}
    
    public init(title: String, scheduledAt: Date, recurrenceRule: RecurrenceRule = .none) {
        self.title = title
        self.scheduledAt = scheduledAt
        self.recurrenceRule = recurrenceRule
    }
    
    public func perform() async throws -> some ProvidesDialog & ReturnsValue<String> {
        let reminder = ReminderItem(
            title: title,
            scheduledAt: scheduledAt,
            recurrenceRule: recurrenceRule,
            category: .personal,
            priority: .high
        )
        
        StorageManager.shared.addReminder(reminder)
        NotificationManager.shared.scheduleReminderNotification(for: reminder)
        
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        let timeString = formatter.string(from: scheduledAt)
        
        let dialogMessage: LocalizedStringResource = "Scheduled a reminder in Synvy to '\(title)' at \(timeString)."
        return .result(value: reminder.title, dialog: IntentDialog(dialogMessage))
    }
}
