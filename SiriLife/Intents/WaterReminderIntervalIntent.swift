import Foundation
import AppIntents

public struct SetWaterReminderIntervalIntent: AppIntent {
    public static var title: LocalizedStringResource = "Set Water Reminder Interval in Synvy"
    public static var description = IntentDescription("Sets how often Synvy reminds you to drink water.")
    
    @Parameter(title: "Interval Minutes", default: 60)
    public var intervalMinutes: Int
    
    public init() {}
    
    public init(intervalMinutes: Int) {
        self.intervalMinutes = intervalMinutes
    }
    
    public func perform() async throws -> some ProvidesDialog & ReturnsValue<Int> {
        var prefs = StorageManager.shared.getPreferences()
        prefs.waterReminderIntervalMinutes = max(15, intervalMinutes)
        StorageManager.shared.savePreferences(prefs)
        
        HydrationScheduler.shared.rescheduleHydrationReminders()
        
        let dialogMessage: LocalizedStringResource = "Updated your Synvy water reminders to every \(intervalMinutes) minutes during your active hours."
        return .result(value: prefs.waterReminderIntervalMinutes, dialog: IntentDialog(dialogMessage))
    }
}
