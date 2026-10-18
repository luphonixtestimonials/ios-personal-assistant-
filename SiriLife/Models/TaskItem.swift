import Foundation

public struct SubTask: Codable, Identifiable, Hashable {
    public var id: String
    public var title: String
    public var isCompleted: Bool
    
    public init(id: String = UUID().uuidString, title: String, isCompleted: Bool = false) {
        self.id = id
        self.title = title
        self.isCompleted = isCompleted
    }
}

public struct TaskItem: Codable, Identifiable, Hashable {
    public var id: String
    public var userId: String
    public var title: String
    public var description: String?
    public var dueAt: Date?
    public var priority: Priority
    public var category: ItemCategory
    public var isCompleted: Bool
    public var recurrenceRule: RecurrenceRule
    public var subtasks: [SubTask]
    public var assignedToUserId: String?
    public var assignedByUserId: String?
    public var assignedToUsername: String?
    public var assignedByUsername: String?
    public var createdAt: Date
    public var updatedAt: Date
    
    public init(
        id: String = UUID().uuidString,
        userId: String = "",
        title: String,
        description: String? = nil,
        dueAt: Date? = nil,
        priority: Priority = .medium,
        category: ItemCategory = .other,
        isCompleted: Bool = false,
        recurrenceRule: RecurrenceRule = .none,
        subtasks: [SubTask] = [],
        assignedToUserId: String? = nil,
        assignedByUserId: String? = nil,
        assignedToUsername: String? = nil,
        assignedByUsername: String? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.title = title
        self.description = description
        self.dueAt = dueAt
        self.priority = priority
        self.category = category
        self.isCompleted = isCompleted
        self.recurrenceRule = recurrenceRule
        self.subtasks = subtasks
        self.assignedToUserId = assignedToUserId
        self.assignedByUserId = assignedByUserId
        self.assignedToUsername = assignedToUsername
        self.assignedByUsername = assignedByUsername
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
    
    public var isOverdue: Bool {
        guard let dueAt = dueAt, !isCompleted else { return false }
        return dueAt < Date()
    }
    
    public var isDueToday: Bool {
        guard let dueAt = dueAt else { return false }
        return Calendar.current.isDateInToday(dueAt)
    }
    
    public var formattedDueTime: String {
        guard let dueAt = dueAt else { return "No due date" }
        let formatter = DateFormatter()
        if Calendar.current.isDateInToday(dueAt) {
            formatter.dateFormat = "'Today at' h:mm a"
        } else if Calendar.current.isDateInTomorrow(dueAt) {
            formatter.dateFormat = "'Tomorrow at' h:mm a"
        } else {
            formatter.dateFormat = "MMM d, h:mm a"
        }
        return formatter.string(from: dueAt)
    }
}
