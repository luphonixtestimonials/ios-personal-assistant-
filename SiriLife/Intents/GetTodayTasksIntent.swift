import Foundation
import AppIntents

public struct GetTodayTasksIntent: AppIntent {
    public static var title: LocalizedStringResource = "Get Today's Tasks in Synvy"
    public static var description = IntentDescription("Reads your pending tasks scheduled for today.")
    
    public init() {}
    
    public func perform() async throws -> some ProvidesDialog & ReturnsValue<[String]> {
        // Attempt quick cloud sync so tasks checked on web or another device are recognized
        let allTasks: [TaskItem]
        if let cloudTasks = try? await withTimeout(seconds: 1.5, operation: {
            try await APIClient.shared.fetchTasks(filter: "today")
        }) {
            allTasks = cloudTasks
        } else {
            allTasks = StorageManager.shared.getTasks()
        }

        let todayPending = allTasks.filter { ($0.isDueToday || $0.dueAt == nil) && !$0.isCompleted }
        
        let titles = todayPending.map { $0.title }
        let dialogMessage: LocalizedStringResource
        
        if titles.isEmpty {
            dialogMessage = "You have no pending tasks left for today in Synvy. All clear!"
        } else if titles.count == 1 {
            dialogMessage = "You have 1 task today in Synvy: \(titles[0])."
        } else {
            let taskListString = titles.prefix(4).joined(separator: ", ")
            dialogMessage = "You have \(titles.count) tasks today in Synvy: \(taskListString)."
        }
        
        return .result(value: titles, dialog: IntentDialog(dialogMessage))
    }
}

private func withTimeout<T: Sendable>(seconds: TimeInterval, operation: @escaping @Sendable () async throws -> T) async throws -> T {
    try await withThrowingTaskGroup(of: T.self) { group in
        group.addTask {
            try await operation()
        }
        group.addTask {
            try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            throw CancellationError()
        }
        let result = try await group.next()!
        group.cancelAll()
        return result
    }
}
