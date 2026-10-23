import Foundation
import AppIntents

public struct LogWaterIntent: AppIntent {
    public static var title: LocalizedStringResource = "Log Water in Synvy"
    public static var description = IntentDescription("Logs your water intake amount to Synvy.")
    
    @Parameter(title: "Amount (ml)", default: 250, requestValueDialog: "How many milliliters of water did you drink?")
    public var amountMl: Int
    
    public init() {}
    
    public init(amountMl: Int) {
        self.amountMl = amountMl
    }
    
    public func perform() async throws -> some ProvidesDialog & ReturnsValue<Int> {
        let log = HydrationLog(amountMl: amountMl)
        StorageManager.shared.addHydrationLog(log)
        
        let total = StorageManager.shared.getTodayHydrationTotal()
        let prefs = StorageManager.shared.getPreferences()
        
        let dialogMessage: LocalizedStringResource = "Logged \(amountMl) ml in Synvy. You have drunk \(total) ml out of your \(prefs.dailyWaterGoalMl) ml goal today."
        return .result(value: total, dialog: IntentDialog(dialogMessage))
    }
}
