import Foundation
import Combine

struct UserProfile: Codable {
    let id: String
    let email: String
}

class AuthManager: ObservableObject {
    static let shared = AuthManager()
    @Published var user: UserProfile?
    @Published var isLoggedIn: Bool = false
    private let key = "UserProfile"
    
    func login(email: String, password: String, completion: @escaping (Bool) -> Void) {
        // 假設API: /api/auth/login
        guard let url = URL(string: "https://www.bma-hk.com/api/auth/login") else { completion(false); return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = ["email": email, "password": password]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: req) { data, _, _ in
            guard let data = data,
                  let user = try? JSONDecoder().decode(UserProfile.self, from: data) else {
                DispatchQueue.main.async { completion(false) }
                return
            }
            DispatchQueue.main.async {
                self.user = user
                self.isLoggedIn = true
                self.save()
                completion(true)
            }
        }.resume()
    }
    func logout() {
        user = nil
        isLoggedIn = false
        UserDefaults.standard.removeObject(forKey: key)
    }
    func save() {
        if let user = user, let data = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
    func load() {
        if let data = UserDefaults.standard.data(forKey: key),
           let user = try? JSONDecoder().decode(UserProfile.self, from: data) {
            self.user = user
            self.isLoggedIn = true
        }
    }
}
