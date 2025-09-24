import Foundation

struct AISummaryRequest: Codable {
    let symbol: String
    let quote: QuoteResponse?
    let ma20: Double?
    let rsi: Double?
    let profile: FMPProfile?
    let sentiment: SentimentResponse?
    let simulation: SimulationResult?
}

struct AISummaryResponse: Codable {
    let summary: String
    let suggestion: String?
    let technicalScore: Double
    let fundamentalScore: Double
    let sentimentScore: Double
    let overallRating: String
    let riskLevel: String
    let keyPoints: [String]
    let warnings: [String]
    let opportunities: [String]
}

struct AIAnalysisResult {
    let technicalAnalysis: TechnicalAnalysis
    let fundamentalAnalysis: FundamentalAnalysis
    let sentimentAnalysis: SentimentAnalysis
    let riskAssessment: RiskAssessment
    let recommendation: Recommendation
}

struct TechnicalAnalysis {
    let trendDirection: String
    let momentum: String
    let support: Double?
    let resistance: Double?
    let signals: [String]
    let score: Double
}

struct FundamentalAnalysis {
    let valuation: String
    let growth: String
    let profitability: String
    let financial_health: String
    let score: Double
}

struct SentimentAnalysis {
    let marketSentiment: String
    let newsSentiment: String
    let socialSentiment: String
    let score: Double
}

struct RiskAssessment {
    let level: String
    let factors: [String]
    let score: Double
}

struct Recommendation {
    let action: String
    let confidence: Double
    let timeHorizon: String
    let targetPrice: Double?
    let stopLoss: Double?
}

class AISummaryAPI {
    static let shared = AISummaryAPI()
    private let baseURL = "https://www.bma-hk.com"
    
    // 本地化 AI 分析引擎
    func performLocalAIAnalysis(symbol: String,
                               quote: QuoteResponse?,
                               ma20: Double?,
                               rsi: Double?,
                               profile: FMPProfile?,
                               sentiment: SentimentResponse?,
                               simulation: SimulationResult?) -> AIAnalysisResult {
        
        let technicalAnalysis = analyzeTechnical(quote: quote, ma20: ma20, rsi: rsi)
        let fundamentalAnalysis = analyzeFundamental(profile: profile, quote: quote)
        let sentimentAnalysis = analyzeSentiment(sentiment: sentiment, symbol: symbol)
        let riskAssessment = assessRisk(technicalAnalysis: technicalAnalysis, 
                                      fundamentalAnalysis: fundamentalAnalysis,
                                      sentimentAnalysis: sentimentAnalysis,
                                      simulation: simulation)
        let recommendation = generateRecommendation(
            technical: technicalAnalysis,
            fundamental: fundamentalAnalysis,
            sentiment: sentimentAnalysis,
            risk: riskAssessment,
            quote: quote
        )
        
        return AIAnalysisResult(
            technicalAnalysis: technicalAnalysis,
            fundamentalAnalysis: fundamentalAnalysis,
            sentimentAnalysis: sentimentAnalysis,
            riskAssessment: riskAssessment,
            recommendation: recommendation
        )
    }
    
    // 技術分析引擎
    private func analyzeTechnical(quote: QuoteResponse?, ma20: Double?, rsi: Double?) -> TechnicalAnalysis {
        var signals: [String] = []
        var score: Double = 50 // 中性分數
        var trendDirection = "中性"
        var momentum = "中性"
        var support: Double?
        var resistance: Double?
        
        if let quote = quote, let currentPrice = Double(quote.price ?? "0") {
            // MA20 趨勢分析
            if let ma20 = ma20, ma20 > 0 {
                if currentPrice > ma20 {
                    let uptrend = (currentPrice - ma20) / ma20
                    if uptrend > 0.05 {
                        trendDirection = "強勢上升"
                        score += 20
                        signals.append("價格強勢突破20日均線")
                    } else if uptrend > 0.02 {
                        trendDirection = "溫和上升"
                        score += 10
                        signals.append("價格位於20日均線上方")
                    }
                    support = ma20 * 0.98
                    resistance = ma20 * 1.05
                } else {
                    let downtrend = (ma20 - currentPrice) / ma20
                    if downtrend > 0.05 {
                        trendDirection = "強勢下跌"
                        score -= 20
                        signals.append("價格跌破20日均線支撐")
                    } else if downtrend > 0.02 {
                        trendDirection = "溫和下跌"
                        score -= 10
                        signals.append("價格位於20日均線下方")
                    }
                    resistance = ma20 * 1.02
                    support = ma20 * 0.95
                }
            }
            
            // RSI 動量分析
            if let rsi = rsi {
                if rsi > 70 {
                    momentum = "超買"
                    score -= 15
                    signals.append("RSI超買信號 (\(String(format: "%.1f", rsi)))")
                } else if rsi > 60 {
                    momentum = "偏強"
                    score += 5
                    signals.append("RSI顯示動量偏強")
                } else if rsi < 30 {
                    momentum = "超賣"
                    score += 15
                    signals.append("RSI超賣反彈機會 (\(String(format: "%.1f", rsi)))")
                } else if rsi < 40 {
                    momentum = "偏弱"
                    score -= 5
                    signals.append("RSI顯示動量偏弱")
                }
            }
            
            // 價格波動分析
            if let changePercent = Double(quote.changesPercentage?.replacingOccurrences(of: "%", with: "") ?? "0") {
                if abs(changePercent) > 5 {
                    signals.append("今日波動較大 (\(String(format: "%.2f", changePercent))%)")
                    if changePercent > 0 {
                        score += 5
                    } else {
                        score -= 5
                    }
                }
            }
        }
        
        // 確保分數在 0-100 範圍內
        score = max(0, min(100, score))
        
        return TechnicalAnalysis(
            trendDirection: trendDirection,
            momentum: momentum,
            support: support,
            resistance: resistance,
            signals: signals,
            score: score
        )
    }
    
    // 基本面分析引擎
    private func analyzeFundamental(profile: FMPProfile?, quote: QuoteResponse?) -> FundamentalAnalysis {
        var score: Double = 50
        var valuation = "中性"
        var growth = "未知"
        var profitability = "未知"
        var financial_health = "未知"
        
        if let profile = profile {
            // P/E 比率分析
            if let pe = profile.pe, pe > 0 {
                if pe < 10 {
                    valuation = "低估"
                    score += 15
                } else if pe < 20 {
                    valuation = "合理"
                    score += 5
                } else if pe < 30 {
                    valuation = "偏高"
                    score -= 5
                } else {
                    valuation = "高估"
                    score -= 15
                }
            }
            
            // 成長性分析
            if let revenueGrowth = profile.revenueGrowth {
                if revenueGrowth > 0.2 {
                    growth = "高成長"
                    score += 20
                } else if revenueGrowth > 0.1 {
                    growth = "穩定成長"
                    score += 10
                } else if revenueGrowth > 0 {
                    growth = "緩慢成長"
                    score += 5
                } else {
                    growth = "衰退"
                    score -= 15
                }
            }
            
            // 獲利能力分析
            if let roe = profile.roe {
                if roe > 0.2 {
                    profitability = "優秀"
                    score += 15
                } else if roe > 0.15 {
                    profitability = "良好"
                    score += 10
                } else if roe > 0.1 {
                    profitability = "一般"
                    score += 5
                } else if roe > 0 {
                    profitability = "偏弱"
                    score -= 5
                } else {
                    profitability = "虧損"
                    score -= 20
                }
            }
            
            // 財務健康分析
            if let debtToEquity = profile.debtToEquity {
                if debtToEquity < 0.3 {
                    financial_health = "健康"
                    score += 10
                } else if debtToEquity < 0.6 {
                    financial_health = "穩健"
                    score += 5
                } else if debtToEquity < 1.0 {
                    financial_health = "一般"
                } else {
                    financial_health = "高債務"
                    score -= 10
                }
            }
        }
        
        score = max(0, min(100, score))
        
        return FundamentalAnalysis(
            valuation: valuation,
            growth: growth,
            profitability: profitability,
            financial_health: financial_health,
            score: score
        )
    }
    
    // 市場情緒分析引擎
    private func analyzeSentiment(sentiment: SentimentResponse?, symbol: String) -> SentimentAnalysis {
        var score: Double = 50
        var marketSentiment = "中性"
        var newsSentiment = "中性"
        var socialSentiment = "中性"
        
        if let sentiment = sentiment {
            // 新聞情緒分析
            if let sentimentScore = sentiment.score {
                if sentimentScore > 0.3 {
                    newsSentiment = "正面"
                    score += 15
                } else if sentimentScore > 0.1 {
                    newsSentiment = "偏正面"
                    score += 8
                } else if sentimentScore < -0.3 {
                    newsSentiment = "負面"
                    score -= 15
                } else if sentimentScore < -0.1 {
                    newsSentiment = "偏負面"
                    score -= 8
                }
            }
        }
        
        // 根據股票類型判斷市場情緒
        let techStocks = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META"]
        let cryptoStocks = ["MSTR", "COIN", "RIOT", "MARA"]
        let chinaStocks = ["BABA", "JD", "PDD", "BIDU", "NIO", "XPEV", "LI"]
        
        if techStocks.contains(symbol) {
            marketSentiment = "科技股看好"
            score += 5
        } else if cryptoStocks.contains(symbol) {
            marketSentiment = "加密貨幣相關"
            // 加密貨幣波動性較高
            score += 0
        } else if chinaStocks.contains(symbol) {
            marketSentiment = "中概股謹慎"
            score -= 5
        }
        
        score = max(0, min(100, score))
        
        return SentimentAnalysis(
            marketSentiment: marketSentiment,
            newsSentiment: newsSentiment,
            socialSentiment: socialSentiment,
            score: score
        )
    }
    
    // 風險評估引擎
    private func assessRisk(technicalAnalysis: TechnicalAnalysis,
                           fundamentalAnalysis: FundamentalAnalysis,
                           sentimentAnalysis: SentimentAnalysis,
                           simulation: SimulationResult?) -> RiskAssessment {
        var riskFactors: [String] = []
        var riskScore: Double = 0
        
        // 技術風險
        if technicalAnalysis.momentum == "超買" {
            riskFactors.append("技術指標顯示超買")
            riskScore += 20
        }
        if technicalAnalysis.trendDirection.contains("下跌") {
            riskFactors.append("技術趨勢偏空")
            riskScore += 15
        }
        
        // 基本面風險
        if fundamentalAnalysis.valuation == "高估" {
            riskFactors.append("估值偏高")
            riskScore += 25
        }
        if fundamentalAnalysis.financial_health == "高債務" {
            riskFactors.append("債務比率偏高")
            riskScore += 20
        }
        if fundamentalAnalysis.growth == "衰退" {
            riskFactors.append("營收成長衰退")
            riskScore += 30
        }
        
        // 情緒風險
        if sentimentAnalysis.newsSentiment == "負面" {
            riskFactors.append("新聞情緒偏負面")
            riskScore += 15
        }
        
        // 模擬分析風險
        if let simulation = simulation {
            if let downside = simulation.downsideRisk, downside > 0.2 {
                riskFactors.append("模擬分析顯示高下行風險")
                riskScore += 20
            }
        }
        
        let riskLevel: String
        if riskScore < 20 {
            riskLevel = "低風險"
        } else if riskScore < 40 {
            riskLevel = "中低風險"
        } else if riskScore < 60 {
            riskLevel = "中等風險"
        } else if riskScore < 80 {
            riskLevel = "中高風險"
        } else {
            riskLevel = "高風險"
        }
        
        return RiskAssessment(
            level: riskLevel,
            factors: riskFactors,
            score: min(100, riskScore)
        )
    }
    
    // 投資建議生成引擎
    private func generateRecommendation(technical: TechnicalAnalysis,
                                       fundamental: FundamentalAnalysis,
                                       sentiment: SentimentAnalysis,
                                       risk: RiskAssessment,
                                       quote: QuoteResponse?) -> Recommendation {
        
        let overallScore = (technical.score + fundamental.score + sentiment.score) / 3
        let riskAdjustedScore = overallScore - (risk.score * 0.3)
        
        let action: String
        let confidence: Double
        let timeHorizon: String
        var targetPrice: Double?
        var stopLoss: Double?
        
        if let quote = quote, let currentPrice = Double(quote.price ?? "0"), currentPrice > 0 {
            if riskAdjustedScore > 70 {
                action = "強力買入"
                confidence = 0.85
                timeHorizon = "中長期 (3-12個月)"
                targetPrice = currentPrice * 1.2
                stopLoss = currentPrice * 0.9
            } else if riskAdjustedScore > 60 {
                action = "買入"
                confidence = 0.7
                timeHorizon = "中期 (1-6個月)"
                targetPrice = currentPrice * 1.15
                stopLoss = currentPrice * 0.92
            } else if riskAdjustedScore > 40 {
                action = "持有"
                confidence = 0.6
                timeHorizon = "短中期 (1-3個月)"
                targetPrice = currentPrice * 1.05
                stopLoss = currentPrice * 0.95
            } else if riskAdjustedScore > 30 {
                action = "減持"
                confidence = 0.65
                timeHorizon = "短期 (1個月內)"
                stopLoss = currentPrice * 0.93
            } else {
                action = "賣出"
                confidence = 0.75
                timeHorizon = "立即"
                stopLoss = currentPrice * 0.95
            }
        } else {
            action = "持有"
            confidence = 0.5
            timeHorizon = "待定"
        }
        
        return Recommendation(
            action: action,
            confidence: confidence,
            timeHorizon: timeHorizon,
            targetPrice: targetPrice,
            stopLoss: stopLoss
        )
    }

    func fetchAISummary(symbol: String,
                        quote: QuoteResponse?,
                        ma20: Double?,
                        rsi: Double?,
                        profile: FMPProfile?,
                        sentiment: SentimentResponse?,
                        simulation: SimulationResult?,
                        completion: @escaping (Result<AISummaryResponse, Error>) -> Void) {
        
        // 優先使用本地化 AI 分析
        DispatchQueue.global(qos: .userInitiated).async {
            let analysis = self.performLocalAIAnalysis(
                symbol: symbol,
                quote: quote,
                ma20: ma20,
                rsi: rsi,
                profile: profile,
                sentiment: sentiment,
                simulation: simulation
            )
            
            let summary = self.generateSummaryText(analysis: analysis, symbol: symbol)
            let suggestion = self.generateSuggestionText(analysis: analysis)
            let keyPoints = self.generateKeyPoints(analysis: analysis)
            let warnings = self.generateWarnings(analysis: analysis)
            let opportunities = self.generateOpportunities(analysis: analysis)
            
            let response = AISummaryResponse(
                summary: summary,
                suggestion: suggestion,
                technicalScore: analysis.technicalAnalysis.score,
                fundamentalScore: analysis.fundamentalAnalysis.score,
                sentimentScore: analysis.sentimentAnalysis.score,
                overallRating: self.calculateOverallRating(analysis: analysis),
                riskLevel: analysis.riskAssessment.level,
                keyPoints: keyPoints,
                warnings: warnings,
                opportunities: opportunities
            )
            
            DispatchQueue.main.async {
                completion(.success(response))
            }
        }
    }
    
    // 生成分析摘要文本
    private func generateSummaryText(analysis: AIAnalysisResult, symbol: String) -> String {
        let technical = analysis.technicalAnalysis
        let fundamental = analysis.fundamentalAnalysis
        let sentiment = analysis.sentimentAnalysis
        let risk = analysis.riskAssessment
        let recommendation = analysis.recommendation
        
        var summary = "🤖 AI 智能分析報告 - \(symbol)\n\n"
        
        summary += "📊 技術分析 (得分: \(String(format: "%.0f", technical.score))/100)\n"
        summary += "• 趨勢方向: \(technical.trendDirection)\n"
        summary += "• 動量狀態: \(technical.momentum)\n"
        if let support = technical.support {
            summary += "• 支撐位: $\(String(format: "%.2f", support))\n"
        }
        if let resistance = technical.resistance {
            summary += "• 阻力位: $\(String(format: "%.2f", resistance))\n"
        }
        
        summary += "\n💰 基本面分析 (得分: \(String(format: "%.0f", fundamental.score))/100)\n"
        summary += "• 估值水平: \(fundamental.valuation)\n"
        summary += "• 成長性: \(fundamental.growth)\n"
        summary += "• 獲利能力: \(fundamental.profitability)\n"
        summary += "• 財務健康: \(fundamental.financial_health)\n"
        
        summary += "\n📰 市場情緒 (得分: \(String(format: "%.0f", sentiment.score))/100)\n"
        summary += "• 市場情緒: \(sentiment.marketSentiment)\n"
        summary += "• 新聞情緒: \(sentiment.newsSentiment)\n"
        
        summary += "\n⚠️ 風險評估: \(risk.level)\n"
        if !risk.factors.isEmpty {
            summary += "主要風險因子:\n"
            for factor in risk.factors.prefix(3) {
                summary += "• \(factor)\n"
            }
        }
        
        summary += "\n🎯 投資建議: \(recommendation.action)\n"
        summary += "信心水平: \(String(format: "%.0f", recommendation.confidence * 100))%\n"
        summary += "建議持有期間: \(recommendation.timeHorizon)\n"
        
        if let targetPrice = recommendation.targetPrice {
            summary += "目標價位: $\(String(format: "%.2f", targetPrice))\n"
        }
        if let stopLoss = recommendation.stopLoss {
            summary += "止損價位: $\(String(format: "%.2f", stopLoss))\n"
        }
        
        return summary
    }
    
    // 生成投資建議文本
    private func generateSuggestionText(analysis: AIAnalysisResult) -> String {
        let recommendation = analysis.recommendation
        let risk = analysis.riskAssessment
        
        var suggestion = "基於綜合分析，建議採取「\(recommendation.action)」策略。"
        
        switch recommendation.action {
        case "強力買入":
            suggestion += "技術面和基本面都顯示積極信號，但請注意風險管理。"
        case "買入":
            suggestion += "整體表現良好，適合逐步建倉。"
        case "持有":
            suggestion += "當前時點保持觀望，等待更明確的方向性信號。"
        case "減持":
            suggestion += "建議降低倉位，規避潛在風險。"
        case "賣出":
            suggestion += "多項指標顯示風險，建議及時退出。"
        default:
            suggestion += "請謹慎評估投資決策。"
        }
        
        if risk.score > 60 {
            suggestion += " ⚠️ 注意：當前風險水平較高，建議嚴格執行風險管理策略。"
        }
        
        return suggestion
    }
    
    // 生成關鍵要點
    private func generateKeyPoints(analysis: AIAnalysisResult) -> [String] {
        var keyPoints: [String] = []
        
        // 技術面關鍵點
        for signal in analysis.technicalAnalysis.signals.prefix(2) {
            keyPoints.append("📈 \(signal)")
        }
        
        // 基本面關鍵點
        if analysis.fundamentalAnalysis.score > 70 {
            keyPoints.append("💎 基本面表現優異")
        } else if analysis.fundamentalAnalysis.score < 30 {
            keyPoints.append("⚠️ 基本面存在隱憂")
        }
        
        // 情緒面關鍵點
        if analysis.sentimentAnalysis.score > 65 {
            keyPoints.append("📢 市場情緒積極")
        } else if analysis.sentimentAnalysis.score < 35 {
            keyPoints.append("😰 市場情緒謹慎")
        }
        
        return keyPoints
    }
    
    // 生成風險警告
    private func generateWarnings(analysis: AIAnalysisResult) -> [String] {
        var warnings: [String] = []
        
        for factor in analysis.riskAssessment.factors {
            warnings.append("⚠️ \(factor)")
        }
        
        if analysis.technicalAnalysis.momentum == "超買" {
            warnings.append("📊 技術指標過熱，注意回調風險")
        }
        
        return warnings
    }
    
    // 生成投資機會
    private func generateOpportunities(analysis: AIAnalysisResult) -> [String] {
        var opportunities: [String] = []
        
        if analysis.technicalAnalysis.momentum == "超賣" {
            opportunities.append("🎯 技術超賣，存在反彈機會")
        }
        
        if analysis.fundamentalAnalysis.valuation == "低估" {
            opportunities.append("💰 估值偏低，具備價值投資機會")
        }
        
        if analysis.fundamentalAnalysis.growth == "高成長" {
            opportunities.append("🚀 高成長股，具備長期投資潛力")
        }
        
        if analysis.sentimentAnalysis.score > 70 {
            opportunities.append("📈 市場情緒樂觀，有利股價表現")
        }
        
        return opportunities
    }
    
    // 計算綜合評級
    private func calculateOverallRating(analysis: AIAnalysisResult) -> String {
        let overallScore = (analysis.technicalAnalysis.score + 
                           analysis.fundamentalAnalysis.score + 
                           analysis.sentimentAnalysis.score) / 3
        let riskAdjustedScore = overallScore - (analysis.riskAssessment.score * 0.2)
        
        if riskAdjustedScore > 80 {
            return "A+ 優秀"
        } else if riskAdjustedScore > 70 {
            return "A 良好"
        } else if riskAdjustedScore > 60 {
            return "B+ 中等偏上"
        } else if riskAdjustedScore > 50 {
            return "B 中等"
        } else if riskAdjustedScore > 40 {
            return "C+ 中等偏下"
        } else if riskAdjustedScore > 30 {
            return "C 偏弱"
        } else {
            return "D 不佳"
        }
    }
}
