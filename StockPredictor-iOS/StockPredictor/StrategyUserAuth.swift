import Foundation
import CloudKit

class StrategyUserAuth: ObservableObject {
    static let shared = StrategyUserAuth()
    @Published var isLoggedIn: Bool = false
    @Published var userId: String = ""
    private let container = CKContainer.default()
    
    func login(completion: @escaping (Bool) -> Void) {
        container.accountStatus { status, error in
            DispatchQueue.main.async {
                if status == .available {
                    self.isLoggedIn = true
                    self.fetchUserId()
                    completion(true)
                } else {
                    self.isLoggedIn = false
                    completion(false)
                }
            }
        }
    }
    func logout() {
        isLoggedIn = false
        userId = ""
    }
    private func fetchUserId() {
        container.fetchUserRecordID { id, error in
            DispatchQueue.main.async {
                if let id = id {
                    self.userId = id.recordName
                }
            }
        }
    }
}
