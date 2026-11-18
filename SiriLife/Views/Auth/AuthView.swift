import SwiftUI

public struct AuthView: View {
    @ObservedObject private var authManager = AuthManager.shared
    
    @State private var isRegisterMode: Bool = false
    @State private var name: String = ""
    @State private var email: String = ""
    @State private var password: String = ""
    
    public init() {}
    
    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {
                    // Hero Branding
                    VStack(spacing: 12) {
                        Image("SynvyLogo")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 96, height: 96)
                            .clipShape(Circle())
                            .overlay(
                                Circle()
                                    .stroke(
                                        LinearGradient(
                                            colors: [Color.white.opacity(0.8), Color.blue.opacity(0.4)],
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        ),
                                        lineWidth: 1.5
                                    )
                            )
                            .shadow(color: Color.blue.opacity(0.5), radius: 16, x: 0, y: 8)
                        
                        Text("Synvy")
                            .font(.system(.largeTitle, design: .rounded).weight(.heavy))
                        
                        Text("Smart Daily Reminders & Personal Assistant")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 24)
                    
                    // Error Banner
                    if let err = authManager.errorMessage {
                        Text(err)
                            .font(.caption)
                            .foregroundColor(.red)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(Color.red.opacity(0.1))
                            .cornerRadius(8)
                    }
                    
                    // Form Card
                    VStack(spacing: 16) {
                        if isRegisterMode {
                            TextField("Full Name", text: $name)
                                .textContentType(.name)
                                .padding()
                                .background(Color(.secondarySystemBackground))
                                .cornerRadius(12)
                        }
                        
                        TextField("Email Address", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .padding()
                            .background(Color(.secondarySystemBackground))
                            .cornerRadius(12)
                        
                        SecureField("Password", text: $password)
                            .textContentType(isRegisterMode ? .newPassword : .password)
                            .padding()
                            .background(Color(.secondarySystemBackground))
                            .cornerRadius(12)
                        
                        Button(action: {
                            Task {
                                if isRegisterMode {
                                    _ = await authManager.register(name: name, email: email, password: password)
                                } else {
                                    _ = await authManager.login(email: email, password: password)
                                }
                            }
                        }) {
                            HStack {
                                if authManager.isLoading {
                                    ProgressView().tint(.white)
                                } else {
                                    Text(isRegisterMode ? "Create Account" : "Sign In")
                                        .fontWeight(.bold)
                                }
                            }
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.blue)
                            .cornerRadius(12)
                        }
                        .disabled(email.isEmpty || password.isEmpty || (isRegisterMode && name.isEmpty) || authManager.isLoading)
                    }
                    .glassCard(cornerRadius: 20, padding: 20)
                    
                    // Toggle mode
                    Button(action: {
                        isRegisterMode.toggle()
                        authManager.errorMessage = nil
                    }) {
                        Text(isRegisterMode ? "Already have an account? Sign In" : "Don't have an account? Create One")
                            .font(.subheadline)
                            .foregroundColor(.blue)
                    }
                    
                    Divider().padding(.horizontal, 40)
                    
                    // Continue as Guest / Offline Demo
                    Button(action: {
                        authManager.continueAsGuest()
                    }) {
                        HStack {
                            Image(systemName: "person.crop.circle.badge.checkmark")
                            Text("Continue as Guest (Instant Preview)")
                        }
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)
                        .padding(.vertical, 10)
                        .padding(.horizontal, 20)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(Capsule())
                    }
                }
                .padding(.horizontal, 20)
            }
        }
    }
}
