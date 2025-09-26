import Foundation

struct StockScreeningCriteria {
    let minMarketCap: Double?
    let maxPE: Double?
    let minROE: Double?
    let minRevenueGrowth: Double?
    let maxDebtToEquity: Double?
    let technicalTrend: String? // "上升", "下跌", "橫盤"
    let rsiRange: ClosedRange<Double>?
    let sector: String?
    let minDividendYield: Double?
}

struct StockScreeningResult: Identifiable {
    let id = UUID()
    let symbol: String
    let companyName: String
    let price: Double
    let score: Double
    let recommendation: String
    let reasons: [String]
    let riskLevel: String
    let technicalScore: Double
    let fundamentalScore: Double
    let sentimentScore: Double
}

class AIStockScreener {
    static let shared = AIStockScreener()
    
    // 預設的優質股票池
    private let stockUniverse = [
        // 科技股
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "NFLX",
        "ADBE", "CRM", "ORCL", "INTC", "AMD", "QCOM", "AVGO", "NOW",
        
        // 金融股
        "JPM", "BAC", "WFC", "GS", "MS", "C", "USB", "PNC",
        
        // 醫療保健
        "JNJ", "PFE", "UNH", "ABBV", "MRK", "TMO", "DHR", "AMGN",
        
        // 消費品
        "PG", "KO", "PEP", "WMT", "HD", "MCD", "NKE", "SBUX",
        
        // 工業股
        "BA", "CAT", "GE", "MMM", "HON", "UPS", "FDX", "LMT",
        
        // 中概股
        "BABA", "JD", "PDD", "BIDU", "NIO", "XPEV", "LI", "BILI"
    ]
    
    // AI 驅動的智能篩選
    func performIntelligentScreening(criteria: StockScreeningCriteria? = nil,
                                   marketCondition: String = "normal",
                                   investmentStyle: String = "balanced",
                                   completion: @escaping ([StockScreeningResult]) -> Void) {
        
        DispatchQueue.global(qos: .userInitiated).async {
            var results: [StockScreeningResult] = []
            let group = DispatchGroup()
            let lock = NSLock()
            
            // 根據市場條件和投資風格調整股票池
            let selectedStocks = self.selectStocksForCondition(
                marketCondition: marketCondition,
                investmentStyle: investmentStyle
            )
            
            for symbol in selectedStocks.prefix(20) { // 限制並發數量
                group.enter()
                
                self.analyzeStockForScreening(symbol: symbol, criteria: criteria) { result in
                    if let result = result {
                        lock.lock()
                        results.append(result)
                        lock.unlock()
                    }
                    group.leave()
                }
            }
            
            group.notify(queue: .main) {
                // 根據綜合得分排序
                let sortedResults = results.sorted { $0.score > $1.score }
                completion(Array(sortedResults.prefix(10)))
            }
        }
    }
    
    // 根據市場條件選擇股票
    private func selectStocksForCondition(marketCondition: String, investmentStyle: String) -> [String] {
        switch marketCondition.lowercased() {
        case "bull", "上漲":
            // 牛市選擇高成長股
            return ["NVDA", "TSLA", "AMZN", "GOOGL", "META", "AMD", "NFLX", "CRM", "ADBE", "NOW"] + stockUniverse.shuffled().prefix(10)
        case "bear", "下跌":
            // 熊市選擇防禦型股票
            return ["JNJ", "PG", "KO", "WMT", "UNH", "PFE", "MCD", "HD", "PEP", "MMM"] + stockUniverse.shuffled().prefix(10)
        case "volatile", "波動":
            // 波動市場選擇低波動股票
            return ["MSFT", "AAPL", "JPM", "BAC", "UNH", "HD", "PG", "JNJ", "KO", "PEP"] + stockUniverse.shuffled().prefix(10)
        default:
            // 正常市場根據投資風格選擇
            switch investmentStyle.lowercased() {
            case "growth", "成長":
                return ["NVDA", "TSLA", "AMZN", "GOOGL", "META", "NFLX", "CRM", "NOW", "ADBE", "AMD"] + stockUniverse.shuffled().prefix(10)
            case "value", "價值":
                return ["JPM", "BAC", "WFC", "WMT", "HD", "PG", "KO", "JNJ", "PFE", "INTC"] + stockUniverse.shuffled().prefix(10)
            case "dividend", "股息":
                return ["JNJ", "PG", "KO", "PEP", "WMT", "HD", "MCD", "UNH", "ABBV", "PFE"] + stockUniverse.shuffled().prefix(10)
            default:
                return stockUniverse.shuffled()
            }
        }
    }
    
    // 分析單一股票
    private func analyzeStockForScreening(symbol: String, 
                                        criteria: StockScreeningCriteria?,
                                        completion: @escaping (StockScreeningResult?) -> Void) {
        
        // 模擬數據獲取（實際應用中應該調用真實 API）
        let group = DispatchGroup()
        var quote: QuoteResponse?
        var profile: FMPProfile?
        var sentiment: SentimentResponse?
        
        // 獲取報價數據
        group.enter()
        MultiSourceQuoteAPI.shared.fetchQuote(symbol: symbol) { result in
            if case .success(let q) = result {
                quote = q
            }
            group.leave()
        }
        
        // 獲取基本面數據
        group.enter()
        FundamentalAPI.shared.fetchProfile(symbol: symbol) { result in
            if case .success(let p) = result {
                profile = p
            }
            group.leave()
        }
        
        // 獲取情緒數據
        group.enter()
        SentimentAPI.shared.fetchSentiment(symbol: symbol) { result in
            if case .success(let s) = result {
                sentiment = s
            }
            group.leave()
        }
        
        group.notify(queue: .global(qos: .userInitiated)) {
            guard let quote = quote else {
                completion(nil)
                return
            }
            
            let analysis = AISummaryAPI.shared.performLocalAIAnalysis(
                symbol: symbol,
                quote: quote,
                ma20: nil, // 可以從技術 API 獲取
                rsi: nil,  // 可以從技術 API 獲取
                profile: profile,
                sentiment: sentiment,
                simulation: nil
            )
            
            let screeningResult = self.evaluateStockForScreening(
                symbol: symbol,
                quote: quote,
                profile: profile,
                analysis: analysis,
                criteria: criteria
            )
            
            completion(screeningResult)
        }
    }
    
    // 評估股票篩選結果
    private func evaluateStockForScreening(symbol: String,
                                         quote: QuoteResponse,
                                         profile: FMPProfile?,
                                         analysis: AIAnalysisResult,
                                         criteria: StockScreeningCriteria?) -> StockScreeningResult? {
        
        guard let priceString = quote.price,
              let price = Double(priceString) else {
            return nil
        }
        
        var score: Double = 50 // 基礎分數
        var reasons: [String] = []
        var passedCriteria = true
        
        // 檢查篩選條件
        if let criteria = criteria {
            if let minMarketCap = criteria.minMarketCap, 
               let marketCap = profile?.marketCap,
               Double(marketCap) < minMarketCap {
                passedCriteria = false
            }
            
            if let maxPE = criteria.maxPE,
               let pe = profile?.pe,
               pe > maxPE {
                passedCriteria = false
            }
            
            if let minROE = criteria.minROE,
               let roe = profile?.roe,
               roe < minROE {
                passedCriteria = false
            }
        }
        
        // 如果不符合基本篩選條件，直接返回 nil
        if !passedCriteria {
            return nil
        }
        
        // 技術分析評分
        let technicalScore = analysis.technicalAnalysis.score
        if technicalScore > 70 {
            score += 20
            reasons.append("技術指標積極")
        } else if technicalScore < 30 {
            score -= 15
            reasons.append("技術指標疲軟")
        }
        
        // 基本面評分
        let fundamentalScore = analysis.fundamentalAnalysis.score
        if fundamentalScore > 70 {
            score += 25
            reasons.append("基本面優異")
        } else if fundamentalScore < 30 {
            score -= 20
            reasons.append("基本面存在問題")
        }
        
        // 情緒評分
        let sentimentScore = analysis.sentimentAnalysis.score
        if sentimentScore > 65 {
            score += 10
            reasons.append("市場情緒積極")
        } else if sentimentScore < 35 {
            score -= 10
            reasons.append("市場情緒謹慎")
        }
        
        // 風險調整
        let riskScore = analysis.riskAssessment.score
        if riskScore > 70 {
            score -= 25
            reasons.append("風險水平較高")
        } else if riskScore < 30 {
            score += 15
            reasons.append("風險控制良好")
        }
        
        // 特殊加分項
        if let profile = profile {
            // 成長性加分
            if let revenueGrowth = profile.revenueGrowth, revenueGrowth > 0.15 {
                score += 10
                reasons.append("營收高速成長")
            }
            
            // 獲利能力加分
            if let roe = profile.roe, roe > 0.2 {
                score += 10
                reasons.append("ROE 表現優異")
            }
            
            // 估值合理性
            if let pe = profile.pe, pe > 0 && pe < 25 {
                score += 8
                reasons.append("估值相對合理")
            }
        }
        
        // 確保分數在合理範圍內
        score = max(0, min(100, score))
        
        // 生成推薦等級
        let recommendation: String
        if score > 80 {
            recommendation = "強力推薦"
        } else if score > 65 {
            recommendation = "推薦"
        } else if score > 50 {
            recommendation = "中性"
        } else if score > 35 {
            recommendation = "謹慎"
        } else {
            recommendation = "不推薦"
        }
        
        return StockScreeningResult(
            symbol: symbol,
            companyName: profile?.companyName ?? symbol,
            price: price,
            score: score,
            recommendation: recommendation,
            reasons: reasons,
            riskLevel: analysis.riskAssessment.level,
            technicalScore: technicalScore,
            fundamentalScore: fundamentalScore,
            sentimentScore: sentimentScore
        )
    }
    
    // 主題投資篩選
    func screenByTheme(theme: String, completion: @escaping ([StockScreeningResult]) -> Void) {
        let themeStocks: [String]
        
        switch theme.lowercased() {
        case "ai", "人工智能", "人工智慧":
            themeStocks = ["NVDA", "AMD", "GOOGL", "MSFT", "AMZN", "META", "ORCL", "CRM", "NOW", "PLTR"]
        case "電動車", "ev", "electric vehicle":
            themeStocks = ["TSLA", "NIO", "XPEV", "LI", "RIVN", "LCID", "F", "GM"]
        case "雲計算", "cloud", "雲端":
            themeStocks = ["AMZN", "MSFT", "GOOGL", "CRM", "NOW", "SNOW", "CRWD", "ZS"]
        case "生技醫療", "biotech", "healthcare":
            themeStocks = ["JNJ", "PFE", "UNH", "ABBV", "MRK", "TMO", "DHR", "AMGN", "GILD", "BIIB"]
        case "金融科技", "fintech":
            themeStocks = ["SQ", "PYPL", "MA", "V", "COIN", "SOFI", "AFRM", "LC"]
        case "清潔能源", "green energy", "再生能源":
            themeStocks = ["TSLA", "ENPH", "SEDG", "FSLR", "NEE", "BEP", "ICLN"]
        case "網路安全", "cybersecurity":
            themeStocks = ["CRWD", "ZS", "OKTA", "NET", "S", "CYBR", "FTNT"]
        default:
            themeStocks = stockUniverse.shuffled().prefix(10).map { String($0) }
        }
        
        performIntelligentScreening(
            criteria: nil,
            marketCondition: "normal",
            investmentStyle: "growth"
        ) { allResults in
            let themeResults = allResults.filter { themeStocks.contains($0.symbol) }
            completion(themeResults)
        }
    }
    
    // 市場情緒驅動的篩選
    func screenBySentiment(sentiment: String, completion: @escaping ([StockScreeningResult]) -> Void) {
        let criteria: StockScreeningCriteria?
        let marketCondition: String
        let investmentStyle: String
        
        switch sentiment.lowercased() {
        case "樂觀", "bullish", "積極":
            criteria = StockScreeningCriteria(
                minMarketCap: 1_000_000_000, // 10億美元以上
                maxPE: nil,
                minROE: 0.1,
                minRevenueGrowth: 0.05,
                maxDebtToEquity: nil,
                technicalTrend: "上升",
                rsiRange: 30...70,
                sector: nil,
                minDividendYield: nil
            )
            marketCondition = "bull"
            investmentStyle = "growth"
            
        case "謹慎", "bearish", "保守":
            criteria = StockScreeningCriteria(
                minMarketCap: 5_000_000_000, // 50億美元以上
                maxPE: 20,
                minROE: 0.15,
                minRevenueGrowth: nil,
                maxDebtToEquity: 0.5,
                technicalTrend: nil,
                rsiRange: nil,
                sector: nil,
                minDividendYield: 0.02
            )
            marketCondition = "bear"
            investmentStyle = "value"
            
        default:
            criteria = nil
            marketCondition = "normal"
            investmentStyle = "balanced"
        }
        
        performIntelligentScreening(
            criteria: criteria,
            marketCondition: marketCondition,
            investmentStyle: investmentStyle,
            completion: completion
        )
    }
}