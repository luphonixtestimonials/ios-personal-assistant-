import Foundation
import AppIntents

public struct CompleteTaskIntent: AppIntent {
    public static var title: LocalizedStringResource = "Mark Task as Completed in Synvy"
    public static var description = IntentDescription("Marks a specific task as completed in Synvy.")
    
    @Parameter(title: "Task Title", requestValueDialog: "Which task would you like to mark as completed?")
    public var taskTitle: String
    
    public init() {}
    
    public init(taskTitle: String) {
        self.taskTitle = taskTitle
    }
    
    public func perform() async throws -> some ProvidesDialog & ReturnsValue<Bool> {
        var tasks = StorageManager.shared.getTasks()
        let query = taskTitle.lowercased().trimmingCharacters(in: .whitespaces)
        
        if let idx = tasks.firstIndex(where: { $0.title.lowercased().contains(query) && !$0.isCompleted }) {
            tasks[idx].isCompleted = true
            tasks[idx].updatedAt = Date()
            StorageManager.shared.saveTasks(tasks)
            
            let matchedTask = tasks[idx]
            let matchedTitle = matchedTask.title
            
            // Sync completion to cloud backend
            Task {
                _ = try? await APIClient.shared.updateTask(matchedTask)
            }
            
            let dialogMessage: LocalizedStringResource = "Marked '\(matchedTitle)' as completed in Synvy. Good job!"
            return .result(value: true, dialog: IntentDialog(dialogMessage))
        } else {
            // Also attempt completing via cloud API if task was created in cloud
            if let cloudTask = try? await APIClient.shared.completeTask(query: taskTitle) {
                StorageManager.shared.updateTask(cloudTask)
                let dialogMessage: LocalizedStringResource = "Marked '\(cloudTask.title)' as completed in Synvy. Good job!"
                return .result(value: true, dialog: IntentDialog(dialogMessage))
            }
            
            let dialogMessage: LocalizedStringResource = "Could not find an uncompleted task matching '\(taskTitle)' in Synvy."
            return .result(value: false, dialog: IntentDialog(dialogMessage))
        }
    }
}
