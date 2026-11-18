import Foundation
import Combine

@MainActor
public final class AuthManager: ObservableObject {
    public static let shared = AuthManager()
    
    @Published public var isAuthenticated: Bool = false
    @Published public var currentUser: User? = nil
    @Published public var isLoading: Bool = false
    @Published public var errorMessage: String? = nil
    
    private init() {
        checkCurrentSession()
    }
    
    public func checkCurrentSession() {
        if let token = StorageManager.shared.getAuthToken(), !token.isEmpty {
            self.isAuthenticated = true
            self.currentUser = StorageManager.shared.getUser() ?? User(name: "Synvy User", email: "user@synvy.app")
        } else {
            self.isAuthenticated = false
            self.currentUser = nil
        }
    }
    
    public func login(email: String, password: String) async -> Bool {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        
        do {
            let res = try await APIClient.shared.login(email: email, password: password)
            self.currentUser = res.user
            self.isAuthenticated = true
            HapticFeedback.shared.notification(.success)
            return true
        } catch {
            self.errorMessage = error.localizedDescription
            HapticFeedback.shared.notification(.error)
            return false
        }
    }
    
    public func register(name: String, email: String, password: String) async -> Bool {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        
        do {
            let res = try await APIClient.shared.register(name: name, email: email, password: password)
            self.currentUser = res.user
            self.isAuthenticated = true
            HapticFeedback.shared.notification(.success)
            return true
        } catch {
            self.errorMessage = error.localizedDescription
            HapticFeedback.shared.notification(.error)
            return false
        }
    }
    
    public func continueAsGuest() {
        let guestUser = User(
            id: "guest_\(UUID().uuidString.prefix(8))",
            name: "Guest Explorer",
            email: "guest@synvy.app"
        )
        StorageManager.shared.saveUser(guestUser)
        StorageManager.shared.saveAuthToken("guest_token_synvy_offline")
        self.currentUser = guestUser
        self.isAuthenticated = true
        HapticFeedback.shared.notification(.success)
    }
    
    public func logout() {
        StorageManager.shared.clearAll()
        self.currentUser = nil
        self.isAuthenticated = false
        HapticFeedback.shared.impact(.medium)
    }
}
