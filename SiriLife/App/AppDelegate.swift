import UIKit
import UserNotifications

public class AppDelegate: NSObject, UIApplicationDelegate {
    public func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil
    ) -> Bool {
        // Configure UNUserNotificationCenter delegate and categories
        _ = NotificationManager.shared
        
        // Reconcile pending notifications on boot
        NotificationManager.shared.reconcileAllNotifications()
        HydrationScheduler.shared.rescheduleHydrationReminders()
        
        // Register for push notifications for lock screen alerts (screen on or off)
        Task {
            _ = await NotificationManager.shared.requestAuthorization()
            await MainActor.run {
                application.registerForRemoteNotifications()
            }
        }
        
        return true
    }
    
    public func applicationDidBecomeActive(_ application: UIApplication) {
        // Re-check notifications status and reconcile if date changed
        NotificationManager.shared.reconcileAllNotifications()
    }
    
    public func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        Task {
            try? await APIClient.shared.registerAPNsToken(token)
        }
    }
    
    public func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable : Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        if let aps = userInfo["aps"] as? [String: Any],
           let alert = aps["alert"] as? [String: Any] {
            let title = alert["title"] as? String ?? "Synvy Task Alert"
            let body = alert["body"] as? String ?? "A task was assigned to you."
            NotificationManager.shared.showLocalAlert(title: title, body: body)
        }
        completionHandler(.newData)
    }
}
