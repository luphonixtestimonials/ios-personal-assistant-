import Foundation
import AppIntents

public struct AddTaskIntent: AppIntent {
    public static var title: LocalizedStringResource = "Add Task in Synvy"
    public static var description = IntentDescription("Creates a new task in your Synvy schedule.")
    
    @Parameter(title: "Task Title", requestValueDialog: "What task would you like to add?")
    public var title: String
    
    @Parameter(title: "Due Date & Time")
    public var dueAt: Date?
    
    @Parameter(title: "Priority", default: .medium)
    public var priority: Priority
    
    public init() {}
    
    public init(title: String, dueAt: Date? = nil, priority: Priority = .medium) {
        self.title = title
        self.dueAt = dueAt
        self.priority = priority
    }
    
    public func perform() async throws -> some ProvidesDialog & ReturnsValue<String> {
        let task = TaskItem(
            title: title,
            dueAt: dueAt,
            priority: priority,
            category: .personal
        )
        
        StorageManager.shared.addTask(task)
        
        let dialogMessage: LocalizedStringResource
        if let dueAt = dueAt {
            let formatter = DateFormatter()
            formatter.dateStyle = .none
            formatter.timeStyle = .short
            let timeString = formatter.string(from: dueAt)
            dialogMessage = "Added task '\(title)' due at \(timeString) in Synvy."
        } else {
            dialogMessage = "Added task '\(title)' to your Synvy tasks."
        }
        
        return .result(value: task.title, dialog: IntentDialog(dialogMessage))
    }
}
