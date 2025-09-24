import Foundation

class LocalizationManager: ObservableObject {
    static let shared = LocalizationManager()
    @Published var locale: Locale = Locale.current
    
    func setLanguage(_ lang: String) {
        locale = Locale(identifier: lang)
        UserDefaults.standard.set(lang, forKey: "AppLanguage")
    }
    
    func currentLanguage() -> String {
        UserDefaults.standard.string(forKey: "AppLanguage") ?? Locale.current.identifier
    }
}

extension String {
    func localized(_ lang: String? = nil) -> String {
        let lang = lang ?? LocalizationManager.shared.currentLanguage()
        guard let path = Bundle.main.path(forResource: lang, ofType: "lproj"),
              let bundle = Bundle(path: path) else {
            return self
        }
        return NSLocalizedString(self, tableName: nil, bundle: bundle, value: self, comment: "")
    }
}
