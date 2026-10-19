import Foundation

public enum APIError: LocalizedError {
    case invalidURL
    case networkError(String)
    case serverError(Int, String)
    case decodingError(String)
    case unauthorized
    
    public var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid server URL"
        case .networkError(let msg): return "Network connection error: \(msg)"
        case .serverError(let code, let msg): return "Server error (\(code)): \(msg)"
        case .decodingError(let msg): return "Failed to process data: \(msg)"
        case .unauthorized: return "Session expired. Please sign in again."
        }
    }
}

public struct GenericResponse<T: Codable>: Codable {
    public var success: Bool
    public var data: T?
    public var message: String?
    public var error: String?
}

public final class APIClient {
    public static let shared = APIClient()
    
    // Configurable base URL; defaults to local or cloud, and persists user custom server
    public var baseURLString: String {
        get {
            if let custom = UserDefaults.standard.string(forKey: "luphonix_backend_url"), !custom.isEmpty {
                return custom
            }
            return _defaultBaseURL
        }
        set {
            _defaultBaseURL = newValue
            UserDefaults.standard.set(newValue, forKey: "luphonix_backend_url")
        }
    }
    private var _defaultBaseURL: String = "https://luphonix-web.vercel.app"
    
    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    
    public init(session: URLSession = .shared) {
        self.session = session
        
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
        
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
    }
    
    // MARK: - Generic Request Runner
    private func request<T: Codable>(
        endpoint: String,
        method: String = "GET",
        body: Data? = nil,
        requiresAuth: Bool = true
    ) async throws -> T {
        guard let url = URL(string: "\(baseURLString)\(endpoint)") else {
            throw APIError.invalidURL
        }
        
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if requiresAuth {
            if let token = StorageManager.shared.getAuthToken() {
                req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
        }
        
        if let body = body {
            req.httpBody = body
        }
        
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.networkError(error.localizedDescription)
        }
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError("Invalid HTTP response")
        }
        
        if httpResponse.statusCode == 401 {
            throw APIError.unauthorized
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown server response"
            throw APIError.serverError(httpResponse.statusCode, errorMsg)
        }
        
        do {
            let decoded = try decoder.decode(T.self, from: data)
            return decoded
        } catch {
            throw APIError.decodingError(error.localizedDescription)
        }
    }
    
    // MARK: - Authentication Endpoints
    public func register(name: String, email: String, password: String, timezone: String = TimeZone.current.identifier) async throws -> AuthResponse {
        let payload: [String: Any] = [
            "name": name,
            "email": email,
            "password": password,
            "timezone": timezone
        ]
        let body = try JSONSerialization.data(withJSONObject: payload)
        
        struct RegisterWrapper: Codable {
            var success: Bool
            var data: AuthResponse
        }
        
        let wrapper: RegisterWrapper = try await request(endpoint: "/api/auth/register", method: "POST", body: body, requiresAuth: false)
        StorageManager.shared.saveAuthToken(wrapper.data.token)
        StorageManager.shared.saveUser(wrapper.data.user)
        return wrapper.data
    }
    
    public func login(email: String, password: String) async throws -> AuthResponse {
        let payload: [String: Any] = [
            "email": email,
            "password": password
        ]
        let body = try JSONSerialization.data(withJSONObject: payload)
        
        struct LoginWrapper: Codable {
            var success: Bool
            var data: AuthResponse
        }
        
        let wrapper: LoginWrapper = try await request(endpoint: "/api/auth/login", method: "POST", body: body, requiresAuth: false)
        StorageManager.shared.saveAuthToken(wrapper.data.token)
        StorageManager.shared.saveUser(wrapper.data.user)
        return wrapper.data
    }
    
    public func fetchCurrentUser() async throws -> User {
        struct UserWrapper: Codable {
            var success: Bool
            var data: User
        }
        let wrapper: UserWrapper = try await request(endpoint: "/api/auth/me")
        StorageManager.shared.saveUser(wrapper.data)
        return wrapper.data
    }
    
    public func exportUserData() async throws -> String {
        guard let url = URL(string: "\(baseURLString)/api/auth/export") else {
            throw APIError.invalidURL
        }
        var req = URLRequest(url: url)
        if let token = StorageManager.shared.getAuthToken() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, _) = try await session.data(for: req)
        return String(data: data, encoding: .utf8) ?? "{}"
    }
    
    public func deleteAccount() async throws {
        struct GenericEmpty: Codable { var success: Bool }
        let _: GenericEmpty = try await request(endpoint: "/api/auth/delete", method: "DELETE")
        StorageManager.shared.clearAll()
    }
    
    // MARK: - Tasks Endpoints
    public func fetchTasks(filter: String? = nil) async throws -> [TaskItem] {
        var query = ""
        if let filter = filter {
            query = "?filter=\(filter)"
        }
        struct TasksWrapper: Codable {
            var success: Bool
            var data: [BackendTask]
        }
        
        // Backend task format mapper with robust type-tolerant decoding
        struct BackendTask: Codable {
            var id: String
            var user_id: String
            var title: String
            var description: String?
            var due_at: String?
            var priority: String
            var category: String
            var is_completed: Bool
            var recurrence_rule: String?
            var assigned_to_user_id: String?
            var assigned_by_user_id: String?
            var assigned_to_username: String?
            var assigned_by_username: String?
            var created_at: String
            var updated_at: String

            enum CodingKeys: String, CodingKey {
                case id, user_id, title, description, due_at, priority, category, is_completed, recurrence_rule
                case assigned_to_user_id, assigned_by_user_id, assigned_to_username, assigned_by_username
                case created_at, updated_at
            }

            init(from decoder: Decoder) throws {
                let container = try decoder.container(keyedBy: CodingKeys.self)
                id = try container.decode(String.self, forKey: .id)
                user_id = (try? container.decode(String.self, forKey: .user_id)) ?? ""
                title = try container.decode(String.self, forKey: .title)
                description = try? container.decode(String.self, forKey: .description)
                due_at = try? container.decode(String.self, forKey: .due_at)
                priority = (try? container.decode(String.self, forKey: .priority)) ?? "medium"
                category = (try? container.decode(String.self, forKey: .category)) ?? "other"
                recurrence_rule = try? container.decode(String.self, forKey: .recurrence_rule)
                assigned_to_user_id = try? container.decode(String.self, forKey: .assigned_to_user_id)
                assigned_by_user_id = try? container.decode(String.self, forKey: .assigned_by_user_id)
                assigned_to_username = try? container.decode(String.self, forKey: .assigned_to_username)
                assigned_by_username = try? container.decode(String.self, forKey: .assigned_by_username)
                created_at = (try? container.decode(String.self, forKey: .created_at)) ?? ""
                updated_at = (try? container.decode(String.self, forKey: .updated_at)) ?? ""

                if let boolVal = try? container.decode(Bool.self, forKey: .is_completed) {
                    is_completed = boolVal
                } else if let intVal = try? container.decode(Int.self, forKey: .is_completed) {
                    is_completed = (intVal == 1)
                } else {
                    is_completed = false
                }
            }
        }
        
        do {
            let wrapper: TasksWrapper = try await request(endpoint: "/api/tasks\(query)")
            let isoFormatter = ISO8601DateFormatter()
            
            let tasks: [TaskItem] = wrapper.data.map { bt in
                TaskItem(
                    id: bt.id,
                    userId: bt.user_id,
                    title: bt.title,
                    description: bt.description,
                    dueAt: bt.due_at.flatMap { isoFormatter.date(from: $0) },
                    priority: Priority(rawValue: bt.priority) ?? .medium,
                    category: ItemCategory(rawValue: bt.category) ?? .other,
                    isCompleted: bt.is_completed,
                    recurrenceRule: RecurrenceRule(rawValue: bt.recurrence_rule ?? "none") ?? .none,
                    assignedToUserId: bt.assigned_to_user_id,
                    assignedByUserId: bt.assigned_by_user_id,
                    assignedToUsername: bt.assigned_to_username,
                    assignedByUsername: bt.assigned_by_username,
                    createdAt: isoFormatter.date(from: bt.created_at) ?? Date(),
                    updatedAt: isoFormatter.date(from: bt.updated_at) ?? Date()
                )
            }
            StorageManager.shared.saveTasks(tasks)
            return tasks
        } catch {
            // Graceful fallback to cached offline tasks
            return StorageManager.shared.getTasks()
        }
    }
    
    public func createTask(_ task: TaskItem) async throws -> TaskItem {
        let isoFormatter = ISO8601DateFormatter()
        let payload: [String: Any?] = [
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "due_at": task.dueAt.map { isoFormatter.string(from: $0) },
            "priority": task.priority.rawValue,
            "category": task.category.rawValue,
            "recurrence_rule": task.recurrenceRule.rawValue,
            "is_completed": task.isCompleted
        ]
        
        // Save locally first
        StorageManager.shared.addTask(task)
        
        let body = try JSONSerialization.data(withJSONObject: payload.compactMapValues { $0 })
        struct SingleTaskWrapper: Codable {
            var success: Bool
        }
        let _: SingleTaskWrapper? = try? await request(endpoint: "/api/tasks", method: "POST", body: body)
        return task
    }
    
    public func updateTask(_ task: TaskItem) async throws {
        StorageManager.shared.updateTask(task)
        let isoFormatter = ISO8601DateFormatter()
        let payload: [String: Any?] = [
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "due_at": task.dueAt.map { isoFormatter.string(from: $0) },
            "priority": task.priority.rawValue,
            "category": task.category.rawValue,
            "is_completed": task.isCompleted,
            "recurrence_rule": task.recurrenceRule.rawValue
        ]
        let body = try JSONSerialization.data(withJSONObject: payload.compactMapValues { $0 })
        struct Res: Codable { var success: Bool }
        do {
            let _: Res = try await request(endpoint: "/api/tasks/\(task.id)", method: "PATCH", body: body)
        } catch {
            // Fall back to upsert POST /api/tasks if task not found on server
            _ = try? await createTask(task)
        }
    }
    
    public func completeTask(query: String) async throws -> TaskItem {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        struct CompleteTaskWrapper: Codable {
            var success: Bool
            var message: String
            var data: TaskResponseData?
        }
        struct TaskResponseData: Codable {
            var id: String
            var title: String
            var user_id: String?
            var is_completed: Bool?
        }
        let res: CompleteTaskWrapper = try await request(endpoint: "/api/tasks/complete?q=\(encoded)&format=json")
        var task = TaskItem(
            id: res.data?.id ?? UUID().uuidString,
            userId: res.data?.user_id ?? "",
            title: res.data?.title ?? query,
            isCompleted: true
        )
        StorageManager.shared.updateTask(task)
        return task
    }
    
    public func deleteTask(id: String) async throws {
        StorageManager.shared.deleteTask(id: id)
        struct Res: Codable { var success: Bool }
        let _: Res? = try? await request(endpoint: "/api/tasks/\(id)", method: "DELETE")
    }
    
    // MARK: - Reminders Endpoints
    public func fetchReminders() async throws -> [ReminderItem] {
        struct BackendReminder: Codable {
            var id: String
            var user_id: String
            var title: String
            var description: String?
            var scheduled_at: String
            var recurrence_rule: String?
            var category: String
            var is_enabled: Int
            var created_at: String
            var updated_at: String
        }
        struct RemindersWrapper: Codable {
            var success: Bool
            var data: [BackendReminder]
        }
        
        do {
            let wrapper: RemindersWrapper = try await request(endpoint: "/api/reminders")
            let isoFormatter = ISO8601DateFormatter()
            let reminders: [ReminderItem] = wrapper.data.map { br in
                ReminderItem(
                    id: br.id,
                    userId: br.user_id,
                    title: br.title,
                    description: br.description,
                    scheduledAt: isoFormatter.date(from: br.scheduled_at) ?? Date(),
                    recurrenceRule: RecurrenceRule(rawValue: br.recurrence_rule ?? "none") ?? .none,
                    category: ItemCategory(rawValue: br.category) ?? .other,
                    isEnabled: br.is_enabled == 1,
                    createdAt: isoFormatter.date(from: br.created_at) ?? Date(),
                    updatedAt: isoFormatter.date(from: br.updated_at) ?? Date()
                )
            }
            StorageManager.shared.saveReminders(reminders)
            return reminders
        } catch {
            return StorageManager.shared.getReminders()
        }
    }
    
    public func createReminder(_ reminder: ReminderItem) async throws -> ReminderItem {
        let isoFormatter = ISO8601DateFormatter()
        let payload: [String: Any?] = [
            "id": reminder.id,
            "title": reminder.title,
            "description": reminder.description,
            "scheduled_at": isoFormatter.string(from: reminder.scheduledAt),
            "recurrence_rule": reminder.recurrenceRule.rawValue,
            "category": reminder.category.rawValue,
            "is_enabled": reminder.isEnabled
        ]
        
        StorageManager.shared.addReminder(reminder)
        NotificationManager.shared.scheduleReminderNotification(for: reminder)
        
        let body = try JSONSerialization.data(withJSONObject: payload.compactMapValues { $0 })
        struct Res: Codable { var success: Bool }
        let _: Res? = try? await request(endpoint: "/api/reminders", method: "POST", body: body)
        return reminder
    }
    
    public func updateReminder(_ reminder: ReminderItem) async throws {
        StorageManager.shared.updateReminder(reminder)
        NotificationManager.shared.scheduleReminderNotification(for: reminder)
        
        let isoFormatter = ISO8601DateFormatter()
        let payload: [String: Any?] = [
            "title": reminder.title,
            "description": reminder.description,
            "scheduled_at": isoFormatter.string(from: reminder.scheduledAt),
            "recurrence_rule": reminder.recurrenceRule.rawValue,
            "category": reminder.category.rawValue,
            "is_enabled": reminder.isEnabled
        ]
        let body = try JSONSerialization.data(withJSONObject: payload.compactMapValues { $0 })
        struct Res: Codable { var success: Bool }
        let _: Res? = try? await request(endpoint: "/api/reminders/\(reminder.id)", method: "PATCH", body: body)
    }
    
    public func deleteReminder(id: String) async throws {
        StorageManager.shared.deleteReminder(id: id)
        NotificationManager.shared.cancelReminderNotification(id: id)
        struct Res: Codable { var success: Bool }
        let _: Res? = try? await request(endpoint: "/api/reminders/\(id)", method: "DELETE")
    }
    
    public func snoozeReminder(id: String, minutes: Int = 15) async throws {
        NotificationManager.shared.snoozeReminder(id: id, minutes: minutes)
        let payload: [String: Any] = ["minutes": minutes]
        let body = try JSONSerialization.data(withJSONObject: payload)
        struct Res: Codable { var success: Bool }
        let _: Res? = try? await request(endpoint: "/api/reminders/\(id)/snooze", method: "POST", body: body)
    }
    
    // MARK: - Hydration Endpoints
    public func logHydration(amountMl: Int) async throws -> HydrationLog {
        let log = HydrationLog(amountMl: amountMl)
        StorageManager.shared.addHydrationLog(log)
        
        let isoFormatter = ISO8601DateFormatter()
        let payload: [String: Any] = [
            "id": log.id,
            "amount_ml": amountMl,
            "logged_at": isoFormatter.string(from: log.loggedAt)
        ]
        let body = try JSONSerialization.data(withJSONObject: payload)
        struct Res: Codable { var success: Bool }
        let _: Res? = try? await request(endpoint: "/api/hydration", method: "POST", body: body)
        return log
    }
    
    public func fetchTodayHydration() async throws -> DailyHydrationSummary {
        struct BackendSummary: Codable {
            var total_ml: Int
            var daily_goal_ml: Int
            var remaining_ml: Int
            var progress_percentage: Double
            var logs: [BackendHydrationLog]
        }
        struct BackendHydrationLog: Codable {
            var id: String
            var user_id: String
            var amount_ml: Int
            var logged_at: String
        }
        struct Wrapper: Codable {
            var success: Bool
            var data: BackendSummary
        }
        
        do {
            let wrapper: Wrapper = try await request(endpoint: "/api/hydration/today")
            let isoFormatter = ISO8601DateFormatter()
            let logs: [HydrationLog] = wrapper.data.logs.map {
                HydrationLog(id: $0.id, userId: $0.user_id, amountMl: $0.amount_ml, loggedAt: isoFormatter.date(from: $0.logged_at) ?? Date())
            }
            StorageManager.shared.saveHydrationLogs(logs)
            return DailyHydrationSummary(
                totalMl: wrapper.data.total_ml,
                dailyGoalMl: wrapper.data.daily_goal_ml,
                remainingMl: wrapper.data.remaining_ml,
                progressPercentage: wrapper.data.progress_percentage,
                logs: logs
            )
        } catch {
            // Local calculation
            let total = StorageManager.shared.getTodayHydrationTotal()
            let prefs = StorageManager.shared.getPreferences()
            let goal = prefs.dailyWaterGoalMl
            let remaining = max(0, goal - total)
            let pct = goal > 0 ? min(1.0, Double(total) / Double(goal)) : 0.0
            return DailyHydrationSummary(
                totalMl: total,
                dailyGoalMl: goal,
                remainingMl: remaining,
                progressPercentage: pct,
                logs: StorageManager.shared.getHydrationLogs()
            )
        }
    }
    
    // MARK: - User Preferences Endpoints
    public func fetchPreferences() async throws -> UserPreferences {
        struct BackendPrefs: Codable {
            var user_id: String
            var daily_water_goal_ml: Int
            var water_reminder_interval_minutes: Int
            var waking_time: String
            var sleeping_time: String
            var quiet_hours_enabled: Int
            var notification_preferences: String
            var updated_at: String
        }
        struct Wrapper: Codable {
            var success: Bool
            var data: BackendPrefs
        }
        
        do {
            let wrapper: Wrapper = try await request(endpoint: "/api/preferences")
            let bp = wrapper.data
            var notifPrefs = NotificationPreferences()
            if let notifData = bp.notification_preferences.data(using: .utf8),
               let parsed = try? JSONDecoder().decode(NotificationPreferences.self, from: notifData) {
                notifPrefs = parsed
            }
            let prefs = UserPreferences(
                userId: bp.user_id,
                dailyWaterGoalMl: bp.daily_water_goal_ml,
                waterReminderIntervalMinutes: bp.water_reminder_interval_minutes,
                wakingTime: bp.waking_time,
                sleepingTime: bp.sleeping_time,
                quietHoursEnabled: bp.quiet_hours_enabled == 1,
                notificationPreferences: notifPrefs
            )
            StorageManager.shared.savePreferences(prefs)
            return prefs
        } catch {
            return StorageManager.shared.getPreferences()
        }
    }
    
    public func updatePreferences(_ prefs: UserPreferences) async throws {
        StorageManager.shared.savePreferences(prefs)
        HydrationScheduler.shared.rescheduleHydrationReminders()
        
        let notifJson = (try? String(data: JSONEncoder().encode(prefs.notificationPreferences), encoding: .utf8)) ?? "{}"
        let payload: [String: Any] = [
            "daily_water_goal_ml": prefs.dailyWaterGoalMl,
            "water_reminder_interval_minutes": prefs.waterReminderIntervalMinutes,
            "waking_time": prefs.wakingTime,
            "sleeping_time": prefs.sleepingTime,
            "quiet_hours_enabled": prefs.quietHoursEnabled,
            "notification_preferences": notifJson
        ]
        let body = try JSONSerialization.data(withJSONObject: payload)
        struct Res: Codable { var success: Bool }
        let _: Res? = try? await request(endpoint: "/api/preferences", method: "PUT", body: body)
    }
    
    // MARK: - Push Notifications
    public func registerAPNsToken(_ token: String) async throws {
        struct PushSubPayload: Codable {
            var endpoint: String
            var apnsToken: String
            var deviceType: String
            var keys: PushKeys
        }
        struct PushKeys: Codable {
            var p256dh: String
            var auth: String
        }
        let payload = PushSubPayload(
            endpoint: "https://api.push.apple.com/3/device/\(token)",
            apnsToken: token,
            deviceType: "ios-native",
            keys: PushKeys(p256dh: "apns_key", auth: "apns_auth")
        )
        let body = try JSONEncoder().encode(payload)
        struct Res: Codable { var success: Bool }
        let _: Res? = try? await request(endpoint: "/api/notifications/subscribe", method: "POST", body: body)
    }
}
