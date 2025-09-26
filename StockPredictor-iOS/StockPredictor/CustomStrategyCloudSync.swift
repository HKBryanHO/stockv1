import Foundation
import CloudKit

class CustomStrategyCloudSync: ObservableObject {
    static let shared = CustomStrategyCloudSync()
    private let container = CKContainer.default()
    private let recordType = "CustomStrategy"
    
    func save(strategies: [CustomStrategy], completion: @escaping (Result<Void, Error>) -> Void) {
        let db = container.privateCloudDatabase
        let records = strategies.map { s -> CKRecord in
            let r = CKRecord(recordType: recordType, recordID: CKRecord.ID(recordName: s.id.uuidString))
            r["name"] = s.name as CKRecordValue
            r["formula"] = s.formula as CKRecordValue
            return r
        }
        let op = CKModifyRecordsOperation(recordsToSave: records, recordIDsToDelete: nil)
        op.modifyRecordsCompletionBlock = { _, _, error in
            DispatchQueue.main.async {
                if let error = error { completion(.failure(error)) }
                else { completion(.success(())) }
            }
        }
        db.add(op)
    }
    func load(completion: @escaping (Result<[CustomStrategy], Error>) -> Void) {
        let db = container.privateCloudDatabase
        let q = CKQuery(recordType: recordType, predicate: NSPredicate(value: true))
        db.perform(q, inZoneWith: nil) { recs, error in
            DispatchQueue.main.async {
                if let error = error { completion(.failure(error)); return }
                let strategies = recs?.compactMap { r in
                    guard let name = r["name"] as? String, let formula = r["formula"] as? String else { return nil }
                    let id = UUID(uuidString: r.recordID.recordName) ?? UUID()
                    return CustomStrategy(id: id, name: name, formula: formula)
                } ?? []
                completion(.success(strategies))
            }
        }
    }
}
