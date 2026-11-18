import Foundation
import AppIntents

public struct AssignTaskIntent: AppIntent {
    public static var title: LocalizedStringResource = "Assign Task in Synvy"
    public static var description = IntentDescription("Assigns a task by number or title to a person/friend in Synvy.")
    
    @Parameter(title: "Task (Number or Title)", requestValueDialog: "Which task number or title would you like to assign?")
    public var task: String
    
    @Parameter(title: "Person / Friend", requestValueDialog: "Who would you like to assign this task to?")
    public var to: String
    
    public init() {}
    
    public init(task: String, to: String) {
        self.task = task
        self.to = to
    }
    
    public func perform() async throws -> some ProvidesDialog & ReturnsValue<String> {
        do {
            let message = try await APIClient.shared.assignTask(task: task, to: to)
            return .result(value: message, dialog: IntentDialog(LocalizedStringResource(stringLiteral: message)))
        } catch {
            let errorMsg = "Could not assign task '\(task)' to \(to) in Synvy."
            return .result(value: errorMsg, dialog: IntentDialog(LocalizedStringResource(stringLiteral: errorMsg)))
        }
    }
}
