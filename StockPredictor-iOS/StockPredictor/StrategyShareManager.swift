import Foundation
import CloudKit

struct SharedStrategy: Identifiable {
    let id: String
    let userId: String
    let name: String
    let formula: String
    let created: Date
    var likes: Int
    var comments: [String]
}

class StrategyShareManager: ObservableObject {
    static let shared = StrategyShareManager()
    private let container = CKContainer.default()
    private let recordType = "SharedStrategy"
    @Published var sharedStrategies: [SharedStrategy] = []

    func share(strategy: CustomStrategy, userId: String, completion: @escaping (Result<Void, Error>) -> Void) {
        let db = container.publicCloudDatabase
        let r = CKRecord(recordType: recordType)
        r["userId"] = userId as CKRecordValue
        r["name"] = strategy.name as CKRecordValue
        r["formula"] = strategy.formula as CKRecordValue
        r["created"] = Date() as CKRecordValue
        r["likes"] = 0 as CKRecordValue
        r["comments"] = [] as CKRecordValue
        db.save(r) { _, error in
            DispatchQueue.main.async {
                if let error = error { completion(.failure(error)) }
                else { completion(.success(())) }
            }
        }
    }

    func fetchAll(completion: @escaping (Result<[SharedStrategy], Error>) -> Void) {
        let db = container.publicCloudDatabase
        let q = CKQuery(recordType: recordType, predicate: NSPredicate(value: true))
        db.perform(q, inZoneWith: nil) { recs, error in
            DispatchQueue.main.async {
                if let error = error { completion(.failure(error)); return }
                let arr = recs?.compactMap { r -> SharedStrategy? in
                    guard let userId = r["userId"] as? String,
                          let name = r["name"] as? String,
                          let formula = r["formula"] as? String,
                          let created = r["created"] as? Date,
                          let likes = r["likes"] as? Int,
                          let comments = r["comments"] as? [String] else { return nil }
                    return SharedStrategy(id: r.recordID.recordName, userId: userId, name: name, formula: formula, created: created, likes: likes, comments: comments)
                } ?? []
                completion(.success(arr))
            }
        }
    }

    func like(strategyId: String, completion: @escaping (Result<Void, Error>) -> Void) {
        let db = container.publicCloudDatabase
        let id = CKRecord.ID(recordName: strategyId)
        db.fetch(withRecordID: id) { rec, error in
            guard let rec = rec, error == nil else { completion(.failure(error!)); return }
            let likes = (rec["likes"] as? Int ?? 0) + 1
            rec["likes"] = likes as CKRecordValue
            db.save(rec) { _, error in
                DispatchQueue.main.async {
                    if let error = error { completion(.failure(error)) }
                    else { completion(.success(())) }
                }
            }
        }
    }

    func comment(strategyId: String, text: String, completion: @escaping (Result<Void, Error>) -> Void) {
        let db = container.publicCloudDatabase
        let id = CKRecord.ID(recordName: strategyId)
        db.fetch(withRecordID: id) { rec, error in
            guard let rec = rec, error == nil else { completion(.failure(error!)); return }
            var comments = rec["comments"] as? [String] ?? []
            comments.append(text)
            rec["comments"] = comments as CKRecordValue
            db.save(rec) { _, error in
                DispatchQueue.main.async {
                    if let error = error { completion(.failure(error)) }
                    else { completion(.success(())) }
                }
            }
        }
    }
}
