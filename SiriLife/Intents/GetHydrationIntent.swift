import Foundation
import AppIntents

public struct GetHydrationIntent: AppIntent {
    public static var title: LocalizedStringResource = "Check Water Intake in Synvy"
    public static var description = IntentDescription("Reports today's water intake and goal progress.")
    
    public init() {}
    
    public func perform() async throws -> some ProvidesDialog & ReturnsValue<Int> {
        let total = StorageManager.shared.getTodayHydrationTotal()
        let prefs = StorageManager.shared.getPreferences()
        let remaining = max(0, prefs.dailyWaterGoalMl - total)
        
        let dialogMessage: LocalizedStringResource
        if remaining > 0 {
            dialogMessage = "You've drunk \(total) ml of water today. You have \(remaining) ml remaining to reach your \(prefs.dailyWaterGoalMl) ml goal in Synvy."
        } else {
            dialogMessage = "Great job! You've reached your water goal today with \(total) ml logged in Synvy."
        }
        
        return .result(value: total, dialog: IntentDialog(dialogMessage))
    }
}
