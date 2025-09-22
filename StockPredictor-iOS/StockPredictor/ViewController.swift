import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate {
    var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Initialize WKWebView configuration
        let webConfiguration = WKWebViewConfiguration()
        
        // Allow inline media playback
        webConfiguration.allowsInlineMediaPlayback = true
        
        // Set up the web view
        webView = WKWebView(frame: .zero, configuration: webConfiguration)
        webView.navigationDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        self.view.addSubview(webView)
        
        // Set constraints to make the web view full screen
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: self.view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: self.view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: self.view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: self.view.trailingAnchor)
        ])
        
        // URL of the web app to load
        let urlString = "https://www.bma-hk.com/predictor"
        if let url = URL(string: urlString) {
            let request = URLRequest(url: url)
            webView.load(request)
        }
    }
    
    // Hide the status bar for a full-screen experience
    override var prefersStatusBarHidden: Bool {
        return true
    }
}
