import Foundation
import UserNotifications
import UIKit

public final class NotificationManager: NSObject, UNUserNotificationCenterDelegate {
    public static let shared = NotificationManager()
    
    public static let reminderCategoryIdentifier = "SYNVY_REMINDER_CATEGORY"
    public static let hydrationCategoryIdentifier = "SYNVY_HYDRATION_CATEGORY"
    
    public static let actionComplete = "SYNVY_ACTION_COMPLETE"
    public static let actionSnooze = "SYNVY_ACTION_SNOOZE"
    public static let actionLog250 = "SYNVY_ACTION_LOG_250"
    public static let actionSnoozeWater = "SYNVY_ACTION_SNOOZE_WATER"
    
    private let center = UNUserNotificationCenter.current()
    
    private override init() {
        super.init()
        center.delegate = self
        setupCategories()
    }
    
    // MARK: - Notification Categories & Actions
    public func setupCategories() {
        // Reminder Actions
        let completeAction = UNNotificationAction(
            identifier: NotificationManager.actionComplete,
            title: "Mark as Done",
            options: [.authenticationRequired]
        )
        
        let snoozeAction = UNNotificationAction(
            identifier: NotificationManager.actionSnooze,
            title: "Snooze 15 Min",
            options: []
        )
        
        let reminderCategory = UNNotificationCategory(
            identifier: NotificationManager.reminderCategoryIdentifier,
            actions: [completeAction, snoozeAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )
        
        // Hydration Actions
        let logWaterAction = UNNotificationAction(
            identifier: NotificationManager.actionLog250,
            title: "Drank 250 ml",
            options: []
        )
        
        let snoozeWaterAction = UNNotificationAction(
            identifier: NotificationManager.actionSnoozeWater,
            title: "Remind in 15 Min",
            options: []
        )
        
        let hydrationCategory = UNNotificationCategory(
            identifier: NotificationManager.hydrationCategoryIdentifier,
            actions: [logWaterAction, snoozeWaterAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )
        
        center.setNotificationCategories([reminderCategory, hydrationCategory])
    }
    
    // MARK: - Permission Request
    public func requestAuthorization() async -> Bool {
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            return granted
        } catch {
            print("Failed to request notification authorization: \(error)")
            return false
        }
    }
    
    public func checkAuthorizationStatus() async -> UNAuthorizationStatus {
        let settings = await center.notificationSettings()
        return settings.authorizationStatus
    }
    
    // MARK: - Schedule Reminder Notification
    public func scheduleReminderNotification(for reminder: ReminderItem) {
        guard reminder.isEnabled, !reminder.isCompleted else {
            cancelReminderNotification(id: reminder.id)
            return
        }
        
        let content = UNMutableNotificationContent()
        content.title = reminder.title
        if let desc = reminder.description, !desc.isEmpty {
            content.body = desc
        } else {
            content.body = "Scheduled for \(reminder.formattedScheduledTime)"
        }
        content.sound = .default
        content.categoryIdentifier = NotificationManager.reminderCategoryIdentifier
        content.userInfo = [
            "reminderId": reminder.id,
            "type": "reminder"
        ]
        
        let targetDate = reminder.effectiveScheduledDate
        
        // If date has passed and not recurring, cancel
        if targetDate < Date() && reminder.recurrenceRule == .none {
            cancelReminderNotification(id: reminder.id)
            return
        }
        
        let trigger: UNNotificationTrigger
        let calendar = Calendar.current
        
        switch reminder.recurrenceRule {
        case .none:
            let components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: targetDate)
            trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            
        case .daily:
            let components = calendar.dateComponents([.hour, .minute], from: targetDate)
            trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
            
        case .weekly:
            let components = calendar.dateComponents([.weekday, .hour, .minute], from: targetDate)
            trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
            
        case .weekdays:
            // For weekdays, schedule individual notifications for Mon-Fri
            scheduleWeekdayNotifications(for: reminder)
            return
            
        case .hourly:
            trigger = UNTimeIntervalNotificationTrigger(timeInterval: 3600, repeats: true)
        }
        
        let request = UNNotificationRequest(
            identifier: "reminder_\(reminder.id)",
            content: content,
            trigger: trigger
        )
        
        center.add(request) { error in
            if let error = error {
                print("Error adding notification request: \(error)")
            }
        }
    }
    
    private func scheduleWeekdayNotifications(for reminder: ReminderItem) {
        let calendar = Calendar.current
        let timeComponents = calendar.dateComponents([.hour, .minute], from: reminder.effectiveScheduledDate)
        
        // Weekdays: Monday (2) through Friday (6)
        for weekday in 2...6 {
            var comp = DateComponents()
            comp.weekday = weekday
            comp.hour = timeComponents.hour
            comp.minute = timeComponents.minute
            
            let content = UNMutableNotificationContent()
            content.title = reminder.title
            content.body = reminder.description ?? "Scheduled weekday reminder"
            content.sound = .default
            content.categoryIdentifier = NotificationManager.reminderCategoryIdentifier
            content.userInfo = ["reminderId": reminder.id, "type": "reminder"]
            
            let trigger = UNCalendarNotificationTrigger(dateMatching: comp, repeats: true)
            let request = UNNotificationRequest(
                identifier: "reminder_\(reminder.id)_w\(weekday)",
                content: content,
                trigger: trigger
            )
            center.add(request)
        }
    }
    
    // MARK: - Cancel Notification
    public func cancelReminderNotification(id: String) {
        var identifiers = ["reminder_\(id)"]
        for weekday in 2...6 {
            identifiers.append("reminder_\(id)_w\(weekday)")
        }
        center.removePendingNotificationRequests(withIdentifiers: identifiers)
        center.removeDeliveredNotifications(withIdentifiers: identifiers)
    }
    
    // MARK: - Snooze Reminder
    public func snoozeReminder(id: String, minutes: Int = 15) {
        var reminders = StorageManager.shared.getReminders()
        guard let index = reminders.firstIndex(where: { $0.id == id }) else { return }
        
        let snoozedDate = Date().addingTimeInterval(Double(minutes * 60))
        reminders[index].snoozedUntil = snoozedDate
        StorageManager.shared.saveReminders(reminders)
        
        // Schedule snooze notification
        let content = UNMutableNotificationContent()
        content.title = "Snoozed: \(reminders[index].title)"
        content.body = "Snoozed for \(minutes) minutes"
        content.sound = .default
        content.categoryIdentifier = NotificationManager.reminderCategoryIdentifier
        content.userInfo = ["reminderId": id, "type": "reminder"]
        
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: Double(minutes * 60), repeats: false)
        let request = UNNotificationRequest(
            identifier: "reminder_\(id)_snooze",
            content: content,
            trigger: trigger
        )
        center.add(request)
    }
    
    // MARK: - Reconcile All Notifications
    public func reconcileAllNotifications() {
        let reminders = StorageManager.shared.getReminders()
        for reminder in reminders {
            if reminder.isEnabled && !reminder.isCompleted {
                scheduleReminderNotification(for: reminder)
            } else {
                cancelReminderNotification(id: reminder.id)
            }
        }
    }
    
    // MARK: - UNUserNotificationCenterDelegate
    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show banner and play sound even when app is foregrounded
        completionHandler([.banner, .sound, .badge, .list])
    }
    
    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        let actionId = response.actionIdentifier
        
        if let reminderId = userInfo["reminderId"] as? String {
            switch actionId {
            case NotificationManager.actionComplete, "LUPHONIX_ACTION_COMPLETE":
                var reminders = StorageManager.shared.getReminders()
                if let idx = reminders.firstIndex(where: { $0.id == reminderId }) {
                    reminders[idx].isCompleted = true
                    if reminders[idx].recurrenceRule != .none,
                       let next = reminders[idx].recurrenceRule.nextDate(after: reminders[idx].scheduledAt) {
                        reminders[idx].scheduledAt = next
                        reminders[idx].isCompleted = false
                        reminders[idx].snoozedUntil = nil
                    }
                    StorageManager.shared.saveReminders(reminders)
                    NotificationManager.shared.scheduleReminderNotification(for: reminders[idx])
                }
            case NotificationManager.actionSnooze, "LUPHONIX_ACTION_SNOOZE":
                snoozeReminder(id: reminderId, minutes: 15)
            default:
                break
            }
        } else if let type = userInfo["type"] as? String, type == "hydration" {
            switch actionId {
            case NotificationManager.actionLog250, "LUPHONIX_ACTION_LOG_250":
                let log = HydrationLog(amountMl: 250)
                StorageManager.shared.addHydrationLog(log)
            case NotificationManager.actionSnoozeWater, "LUPHONIX_ACTION_SNOOZE_WATER":
                HydrationScheduler.shared.snoozeWaterReminder(minutes: 15)
            default:
                break
            }
        }
        
        completionHandler()
    }
    
    // MARK: - Immediate Local Alert (For Task Assignment)
    public func showLocalAlert(title: String, body: String, taskId: String? = nil) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        if let taskId = taskId {
            content.userInfo = ["taskId": taskId, "type": "task_assigned"]
        }
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        let request = UNNotificationRequest(identifier: "notif_assigned_\(UUID().uuidString)", content: content, trigger: trigger)
        center.add(request) { error in
            if let error = error {
                print("Failed to schedule local task notification: \(error)")
            }
        }
    }
}
