import SwiftUI

public struct TaskRowView: View {
    public var task: TaskItem
    public var onToggleComplete: () -> Void
    public var onConvertReminder: () -> Void
    public var onDelete: () -> Void
    
    public init(
        task: TaskItem,
        onToggleComplete: @escaping () -> Void,
        onConvertReminder: @escaping () -> Void,
        onDelete: @escaping () -> Void
    ) {
        self.task = task
        self.onToggleComplete = onToggleComplete
        self.onConvertReminder = onConvertReminder
        self.onDelete = onDelete
    }
    
    public var body: some View {
        HStack(alignment: .top, spacing: 14) {
            // Checkmark button
            Button(action: onToggleComplete) {
                Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(task.isCompleted ? .green : .secondary)
            }
            .buttonStyle(.plain)
            .padding(.top, 2)
            
            // Task Details
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(task.title)
                        .font(.system(.body, design: .rounded).weight(.medium))
                        .strikethrough(task.isCompleted)
                        .foregroundColor(task.isCompleted ? .secondary : .primary)
                    
                    Spacer()
                    
                    // Priority Indicator
                    if task.priority == .high && !task.isCompleted {
                        Image(systemName: task.priority.iconName)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }
                
                if let desc = task.description, !desc.isEmpty {
                    Text(desc)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                
                // Badges row
                HStack(spacing: 8) {
                    // Due time badge
                    if let dueAt = task.dueAt {
                        HStack(spacing: 4) {
                            Image(systemName: "clock")
                            Text(task.formattedDueTime)
                        }
                        .font(.caption2)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(task.isOverdue ? Color.red.opacity(0.12) : Color.blue.opacity(0.1))
                        .foregroundColor(task.isOverdue ? .red : .blue)
                        .clipShape(Capsule())
                    }
                    
                    // Category badge
                    HStack(spacing: 4) {
                        Image(systemName: task.category.iconName)
                        Text(task.category.displayName)
                    }
                    .font(.caption2)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(task.category.color.opacity(0.12))
                    .foregroundColor(task.category.color)
                    .clipShape(Capsule())
                    
                    // Recurrence badge
                    if task.recurrenceRule != .none {
                        HStack(spacing: 4) {
                            Image(systemName: task.recurrenceRule.iconName)
                            Text(task.recurrenceRule.displayName)
                        }
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Color.purple.opacity(0.1))
                        .foregroundColor(.purple)
                        .clipShape(Capsule())
                    }

                    // Collaboration Assignment badge
                    if let toUser = task.assignedToUsername, !toUser.isEmpty {
                        HStack(spacing: 4) {
                            Image(systemName: "person.crop.circle.badge.plus")
                            Text("To @\(toUser)")
                        }
                        .font(.caption2)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.cyan.opacity(0.15))
                        .foregroundColor(.cyan)
                        .clipShape(Capsule())
                    } else if let fromUser = task.assignedByUsername, !fromUser.isEmpty {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.down.left.circle")
                            Text("From @\(fromUser)")
                        }
                        .font(.caption2)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.cyan.opacity(0.15))
                        .foregroundColor(.cyan)
                        .clipShape(Capsule())
                    }
                }
            }
        }
        .padding(.vertical, 4)
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash")
            }
            Button(action: onConvertReminder) {
                Label("Remind", systemImage: "bell.badge")
            }
            .tint(.orange)
        }
    }
}
