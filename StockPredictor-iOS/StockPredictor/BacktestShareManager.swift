import Foundation
import CloudKit

struct SharedBacktest: Identifiable {
    let id: String
    let userId: String
    let strategyName: String
    let formula: String
    let cagr: Double
    let sharpe: Double
    let mdd: Double
    let winRate: Double
    let aiSummary: String
    let created: Date
    var likes: Int
    var comments: [String]
}

class BacktestShareManager: ObservableObject {
    static let shared = BacktestShareManager()
    private let container = CKContainer.default()
    private let recordType = "SharedBacktest"
    @Published var sharedBacktests: [SharedBacktest] = []

    func share(result: BatchBacktestResult, formula: String, aiSummary: String, userId: String, completion: @escaping (Result<Void, Error>) -> Void) {
        let db = container.publicCloudDatabase
        let r = CKRecord(recordType: recordType)
        r["userId"] = userId as CKRecordValue
        r["strategyName"] = result.strategy as CKRecordValue
        r["formula"] = formula as CKRecordValue
        r["cagr"] = result.cagr as CKRecordValue
        r["sharpe"] = result.sharpe as CKRecordValue
        r["mdd"] = result.mdd as CKRecordValue
        r["winRate"] = result.winRate as CKRecordValue
        r["aiSummary"] = aiSummary as CKRecordValue
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

    func fetchAll(completion: @escaping (Result<[SharedBacktest], Error>) -> Void) {
        let db = container.publicCloudDatabase
        let q = CKQuery(recordType: recordType, predicate: NSPredicate(value: true))
        db.perform(q, inZoneWith: nil) { recs, error in
            DispatchQueue.main.async {
                if let error = error { completion(.failure(error)); return }
                let arr = recs?.compactMap { r -> SharedBacktest? in
                    guard let userId = r["userId"] as? String,
                          let strategyName = r["strategyName"] as? String,
                          let formula = r["formula"] as? String,
                          let cagr = r["cagr"] as? Double,
                          let sharpe = r["sharpe"] as? Double,
                          let mdd = r["mdd"] as? Double,
                          let winRate = r["winRate"] as? Double,
                          let aiSummary = r["aiSummary"] as? String,
                          let created = r["created"] as? Date,
                          let likes = r["likes"] as? Int,
                          let comments = r["comments"] as? [String] else { return nil }
                    return SharedBacktest(id: r.recordID.recordName, userId: userId, strategyName: strategyName, formula: formula, cagr: cagr, sharpe: sharpe, mdd: mdd, winRate: winRate, aiSummary: aiSummary, created: created, likes: likes, comments: comments)
                } ?? []
                completion(.success(arr))
            }
        }
    }

    func like(backtestId: String, completion: @escaping (Result<Void, Error>) -> Void) {
        let db = container.publicCloudDatabase
        let id = CKRecord.ID(recordName: backtestId)
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

    func comment(backtestId: String, text: String, completion: @escaping (Result<Void, Error>) -> Void) {
        let db = container.publicCloudDatabase
        let id = CKRecord.ID(recordName: backtestId)
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
