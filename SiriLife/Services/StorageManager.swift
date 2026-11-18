import Foundation

public final class StorageManager {
    public static let shared = StorageManager()
    
    public static let appGroupSuiteName = "group.com.synvy.app"
    public static let legacyAppGroupSuiteName = "group.com.luphonix.app"
    private let defaults: UserDefaults
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    
    private let tasksKey = "synvy_tasks_cache"
    private let remindersKey = "synvy_reminders_cache"
    private let hydrationKey = "synvy_hydration_cache"
    private let preferencesKey = "synvy_preferences_cache"
    private let userKey = "synvy_user_cache"
    private let tokenKey = "synvy_auth_token"
    private let hydrationPausedKey = "synvy_hydration_paused"
    
    // Legacy keys for seamless migration
    private let legacyTasksKey = "luphonix_tasks_cache"
    private let legacyRemindersKey = "luphonix_reminders_cache"
    private let legacyHydrationKey = "luphonix_hydration_cache"
    private let legacyPreferencesKey = "luphonix_preferences_cache"
    private let legacyUserKey = "luphonix_user_cache"
    private let legacyTokenKey = "luphonix_auth_token"
    private let legacyHydrationPausedKey = "luphonix_hydration_paused"
    
    public init() {
        if let sharedDefaults = UserDefaults(suiteName: StorageManager.appGroupSuiteName) {
            self.defaults = sharedDefaults
        } else if let legacyDefaults = UserDefaults(suiteName: StorageManager.legacyAppGroupSuiteName) {
            self.defaults = legacyDefaults
        } else {
            self.defaults = UserDefaults.standard
        }
        
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
        
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
    }
    
    // MARK: - Auth Token
    public func saveAuthToken(_ token: String?) {
        if let token = token {
            defaults.set(token, forKey: tokenKey)
        } else {
            defaults.removeObject(forKey: tokenKey)
            defaults.removeObject(forKey: legacyTokenKey)
        }
    }
    
    public func getAuthToken() -> String? {
        defaults.string(forKey: tokenKey) ?? defaults.string(forKey: legacyTokenKey)
    }
    
    // MARK: - User
    public func saveUser(_ user: User?) {
        guard let user = user else {
            defaults.removeObject(forKey: userKey)
            defaults.removeObject(forKey: legacyUserKey)
            return
        }
        if let data = try? encoder.encode(user) {
            defaults.set(data, forKey: userKey)
        }
    }
    
    public func getUser() -> User? {
        guard let data = defaults.data(forKey: userKey) ?? defaults.data(forKey: legacyUserKey),
              let user = try? decoder.decode(User.self, from: data) else {
            return nil
        }
        return user
    }
    
    // MARK: - Tasks
    public func saveTasks(_ tasks: [TaskItem]) {
        if let data = try? encoder.encode(tasks) {
            defaults.set(data, forKey: tasksKey)
        }
    }
    
    public func getTasks() -> [TaskItem] {
        guard let data = defaults.data(forKey: tasksKey) ?? defaults.data(forKey: legacyTasksKey),
              let tasks = try? decoder.decode([TaskItem].self, from: data) else {
            return []
        }
        return tasks
    }
    
    public func addTask(_ task: TaskItem) {
        var tasks = getTasks()
        tasks.removeAll(where: { $0.id == task.id })
        tasks.insert(task, at: 0)
        saveTasks(tasks)
    }
    
    public func updateTask(_ task: TaskItem) {
        var tasks = getTasks()
        if let index = tasks.firstIndex(where: { $0.id == task.id }) {
            tasks[index] = task
            saveTasks(tasks)
        } else {
            addTask(task)
        }
    }
    
    public func deleteTask(id: String) {
        var tasks = getTasks()
        tasks.removeAll(where: { $0.id == id })
        saveTasks(tasks)
    }
    
    // MARK: - Reminders
    public func saveReminders(_ reminders: [ReminderItem]) {
        if let data = try? encoder.encode(reminders) {
            defaults.set(data, forKey: remindersKey)
        }
    }
    
    public func getReminders() -> [ReminderItem] {
        guard let data = defaults.data(forKey: remindersKey) ?? defaults.data(forKey: legacyRemindersKey),
              let reminders = try? decoder.decode([ReminderItem].self, from: data) else {
            return []
        }
        return reminders
    }
    
    public func addReminder(_ reminder: ReminderItem) {
        var reminders = getReminders()
        reminders.removeAll(where: { $0.id == reminder.id })
        reminders.insert(reminder, at: 0)
        saveReminders(reminders)
    }
    
    public func updateReminder(_ reminder: ReminderItem) {
        var reminders = getReminders()
        if let index = reminders.firstIndex(where: { $0.id == reminder.id }) {
            reminders[index] = reminder
            saveReminders(reminders)
        } else {
            addReminder(reminder)
        }
    }
    
    public func deleteReminder(id: String) {
        var reminders = getReminders()
        reminders.removeAll(where: { $0.id == id })
        saveReminders(reminders)
    }
    
    // MARK: - Hydration
    public func saveHydrationLogs(_ logs: [HydrationLog]) {
        if let data = try? encoder.encode(logs) {
            defaults.set(data, forKey: hydrationKey)
        }
    }
    
    public func getHydrationLogs() -> [HydrationLog] {
        guard let data = defaults.data(forKey: hydrationKey) ?? defaults.data(forKey: legacyHydrationKey),
              let logs = try? decoder.decode([HydrationLog].self, from: data) else {
            return []
        }
        return logs
    }
    
    public func addHydrationLog(_ log: HydrationLog) {
        var logs = getHydrationLogs()
        logs.insert(log, at: 0)
        saveHydrationLogs(logs)
    }
    
    public func getTodayHydrationTotal() -> Int {
        let calendar = Calendar.current
        let todayLogs = getHydrationLogs().filter { calendar.isDateInToday($0.loggedAt) }
        return todayLogs.reduce(0) { $0 + $1.amountMl }
    }
    
    public var isHydrationPaused: Bool {
        get { defaults.bool(forKey: hydrationPausedKey) || defaults.bool(forKey: legacyHydrationPausedKey) }
        set { 
            defaults.set(newValue, forKey: hydrationPausedKey)
            defaults.removeObject(forKey: legacyHydrationPausedKey)
        }
    }
    
    // MARK: - Preferences
    public func savePreferences(_ preferences: UserPreferences) {
        if let data = try? encoder.encode(preferences) {
            defaults.set(data, forKey: preferencesKey)
        }
    }
    
    public func getPreferences() -> UserPreferences {
        guard let data = defaults.data(forKey: preferencesKey) ?? defaults.data(forKey: legacyPreferencesKey),
              let prefs = try? decoder.decode(UserPreferences.self, from: data) else {
            return UserPreferences.default
        }
        return prefs
    }
    
    // MARK: - Clear All Cache (Logout)
    public func clearAll() {
        defaults.removeObject(forKey: tasksKey)
        defaults.removeObject(forKey: remindersKey)
        defaults.removeObject(forKey: hydrationKey)
        defaults.removeObject(forKey: preferencesKey)
        defaults.removeObject(forKey: userKey)
        defaults.removeObject(forKey: tokenKey)
        defaults.removeObject(forKey: hydrationPausedKey)
        
        defaults.removeObject(forKey: legacyTasksKey)
        defaults.removeObject(forKey: legacyRemindersKey)
        defaults.removeObject(forKey: legacyHydrationKey)
        defaults.removeObject(forKey: legacyPreferencesKey)
        defaults.removeObject(forKey: legacyUserKey)
        defaults.removeObject(forKey: legacyTokenKey)
        defaults.removeObject(forKey: legacyHydrationPausedKey)
    }
}
