import Foundation

struct PortfolioOptimizationRequest {
    let symbols: [String]
    let riskTolerance: RiskTolerance
    let investmentHorizon: InvestmentHorizon
    let targetReturn: Double?
    let constraints: PortfolioConstraints?
}

struct PortfolioConstraints {
    let maxSingleWeight: Double // 單一股票最大權重
    let minSingleWeight: Double // 單一股票最小權重
    let sectorLimits: [String: Double]? // 行業限制
    let excludeSymbols: [String]? // 排除股票
    let includeSymbols: [String]? // 必須包含的股票
}

enum RiskTolerance: String, CaseIterable {
    case conservative = "保守"
    case moderate = "穩健"
    case aggressive = "積極"
    
    var volatilityTarget: Double {
        switch self {
        case .conservative: return 0.12 // 12% 年化波動率
        case .moderate: return 0.18     // 18% 年化波動率
        case .aggressive: return 0.25   // 25% 年化波動率
        }
    }
    
    var returnTarget: Double {
        switch self {
        case .conservative: return 0.08 // 8% 年化報酬率
        case .moderate: return 0.12     // 12% 年化報酬率
        case .aggressive: return 0.18   // 18% 年化報酬率
        }
    }
}

enum InvestmentHorizon: String, CaseIterable {
    case shortTerm = "短期 (1年內)"
    case mediumTerm = "中期 (1-5年)"
    case longTerm = "長期 (5年以上)"
    
    var rebalancingFrequency: Int {
        switch self {
        case .shortTerm: return 30  // 每月
        case .mediumTerm: return 90 // 每季
        case .longTerm: return 180  // 每半年
        }
    }
}

struct OptimizedPortfolio {
    let weights: [String: Double] // 股票權重
    let expectedReturn: Double
    let expectedVolatility: Double
    let sharpeRatio: Double
    let maxDrawdown: Double
    let diversificationScore: Double
    let riskMetrics: PortfolioRiskMetrics
    let rebalancingAdvice: [RebalancingAdvice]
}

struct PortfolioRiskMetrics {
    let var95: Double // 95% VaR
    let cvar95: Double // 95% CVaR
    let beta: Double
    let alpha: Double
    let informationRatio: Double
    let trackingError: Double
}

struct RebalancingAdvice {
    let symbol: String
    let currentWeight: Double
    let targetWeight: Double
    let action: String // "增加", "減少", "維持"
    let reason: String
}

class AIPortfolioOptimizer {
    static let shared = AIPortfolioOptimizer()
    
    // Monte Carlo 模擬次數
    private let monteCarloIterations = 10000
    
    // 無風險利率
    private let riskFreeRate = 0.02
    
    func optimizePortfolio(request: PortfolioOptimizationRequest,
                          completion: @escaping (Result<OptimizedPortfolio, Error>) -> Void) {
        
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                // 1. 獲取歷史數據
                let historicalData = try await self.fetchHistoricalData(symbols: request.symbols)
                
                // 2. 計算預期報酬率和協方差矩陣
                let (expectedReturns, covarianceMatrix) = self.calculateStatistics(data: historicalData)
                
                // 3. 進行均值方差優化
                let optimizedWeights = self.performMeanVarianceOptimization(
                    expectedReturns: expectedReturns,
                    covarianceMatrix: covarianceMatrix,
                    riskTolerance: request.riskTolerance,
                    constraints: request.constraints
                )
                
                // 4. 使用 Black-Litterman 模型調整
                let adjustedWeights = self.applyBlackLittermanModel(
                    weights: optimizedWeights,
                    expectedReturns: expectedReturns,
                    covarianceMatrix: covarianceMatrix,
                    symbols: request.symbols
                )
                
                // 5. 計算投資組合績效指標
                let portfolioMetrics = self.calculatePortfolioMetrics(
                    weights: adjustedWeights,
                    expectedReturns: expectedReturns,
                    covarianceMatrix: covarianceMatrix,
                    historicalData: historicalData
                )
                
                // 6. 生成再平衡建議
                let rebalancingAdvice = self.generateRebalancingAdvice(weights: adjustedWeights)
                
                let optimizedPortfolio = OptimizedPortfolio(
                    weights: adjustedWeights,
                    expectedReturn: portfolioMetrics.expectedReturn,
                    expectedVolatility: portfolioMetrics.expectedVolatility,
                    sharpeRatio: portfolioMetrics.sharpeRatio,
                    maxDrawdown: portfolioMetrics.maxDrawdown,
                    diversificationScore: portfolioMetrics.diversificationScore,
                    riskMetrics: portfolioMetrics.riskMetrics,
                    rebalancingAdvice: rebalancingAdvice
                )
                
                DispatchQueue.main.async {
                    completion(.success(optimizedPortfolio))
                }
                
            } catch {
                DispatchQueue.main.async {
                    completion(.failure(error))
                }
            }
        }
    }
    
    // 獲取歷史數據
    private func fetchHistoricalData(symbols: [String]) async throws -> [String: [Double]] {
        // 模擬歷史數據獲取
        // 實際應用中應該調用真實的歷史數據 API
        var historicalData: [String: [Double]] = [:]
        
        for symbol in symbols {
            // 生成模擬的歷史報酬率數據 (252個交易日)
            var returns: [Double] = []
            var price = 100.0
            
            for _ in 0..<252 {
                let randomReturn = Double.random(in: -0.05...0.05) // -5% 到 5% 的日報酬率
                returns.append(randomReturn)
                price *= (1 + randomReturn)
            }
            
            historicalData[symbol] = returns
        }
        
        return historicalData
    }
    
    // 計算統計數據
    private func calculateStatistics(data: [String: [Double]]) -> ([String: Double], [[Double]]) {
        var expectedReturns: [String: Double] = [:]
        let symbols = Array(data.keys)
        let n = symbols.count
        
        // 計算預期報酬率 (年化)
        for (symbol, returns) in data {
            let meanReturn = returns.reduce(0, +) / Double(returns.count)
            expectedReturns[symbol] = meanReturn * 252 // 年化
        }
        
        // 計算協方差矩陣
        var covarianceMatrix = Array(repeating: Array(repeating: 0.0, count: n), count: n)
        
        for i in 0..<n {
            for j in 0..<n {
                let symbol1 = symbols[i]
                let symbol2 = symbols[j]
                let returns1 = data[symbol1]!
                let returns2 = data[symbol2]!
                
                let mean1 = returns1.reduce(0, +) / Double(returns1.count)
                let mean2 = returns2.reduce(0, +) / Double(returns2.count)
                
                var covariance = 0.0
                for k in 0..<returns1.count {
                    covariance += (returns1[k] - mean1) * (returns2[k] - mean2)
                }
                covariance /= Double(returns1.count - 1)
                covariance *= 252 // 年化
                
                covarianceMatrix[i][j] = covariance
            }
        }
        
        return (expectedReturns, covarianceMatrix)
    }
    
    // 均值方差優化
    private func performMeanVarianceOptimization(expectedReturns: [String: Double],
                                               covarianceMatrix: [[Double]],
                                               riskTolerance: RiskTolerance,
                                               constraints: PortfolioConstraints?) -> [String: Double] {
        
        let symbols = Array(expectedReturns.keys)
        let n = symbols.count
        
        // 使用簡化的優化算法 (實際應用中可使用更複雜的二次規劃)
        var weights = Array(repeating: 1.0/Double(n), count: n) // 等權重開始
        
        // Monte Carlo 優化
        var bestWeights = weights
        var bestSharpe = -Double.infinity
        
        for _ in 0..<monteCarloIterations {
            // 生成隨機權重
            var randomWeights = (0..<n).map { _ in Double.random(in: 0...1) }
            let sum = randomWeights.reduce(0, +)
            randomWeights = randomWeights.map { $0 / sum } // 標準化使總和為1
            
            // 應用約束條件
            if let constraints = constraints {
                var validWeights = true
                for i in 0..<n {
                    if randomWeights[i] > constraints.maxSingleWeight || 
                       randomWeights[i] < constraints.minSingleWeight {
                        validWeights = false
                        break
                    }
                }
                if !validWeights { continue }
            }
            
            // 計算投資組合報酬率和波動率
            let portfolioReturn = zip(symbols, randomWeights).reduce(0.0) { result, pair in
                result + expectedReturns[pair.0]! * pair.1
            }
            
            var portfolioVariance = 0.0
            for i in 0..<n {
                for j in 0..<n {
                    portfolioVariance += randomWeights[i] * randomWeights[j] * covarianceMatrix[i][j]
                }
            }
            let portfolioVolatility = sqrt(portfolioVariance)
            
            // 計算 Sharpe 比率
            let sharpeRatio = (portfolioReturn - riskFreeRate) / portfolioVolatility
            
            // 風險調整
            let riskPenalty = abs(portfolioVolatility - riskTolerance.volatilityTarget) * 2
            let adjustedSharpe = sharpeRatio - riskPenalty
            
            if adjustedSharpe > bestSharpe {
                bestSharpe = adjustedSharpe
                bestWeights = randomWeights
            }
        }
        
        // 轉換為字典格式
        var optimizedWeights: [String: Double] = [:]
        for i in 0..<symbols.count {
            optimizedWeights[symbols[i]] = bestWeights[i]
        }
        
        return optimizedWeights
    }
    
    // Black-Litterman 模型調整
    private func applyBlackLittermanModel(weights: [String: Double],
                                        expectedReturns: [String: Double],
                                        covarianceMatrix: [[Double]],
                                        symbols: [String]) -> [String: Double] {
        
        // 簡化的 Black-Litterman 實現
        // 實際應用中應該包含投資者觀點和信心水平
        
        var adjustedWeights: [String: Double] = [:]
        
        // 根據市場情緒和 AI 分析調整權重
        for symbol in symbols {
            let currentWeight = weights[symbol] ?? 0
            
            // 模擬 AI 觀點調整
            let aiConfidence = Double.random(in: 0.5...1.0)
            let marketSentiment = getMarketSentiment(for: symbol)
            
            let adjustment = marketSentiment * aiConfidence * 0.1 // 最大10%調整
            let adjustedWeight = max(0, min(0.4, currentWeight + adjustment)) // 限制在0-40%之間
            
            adjustedWeights[symbol] = adjustedWeight
        }
        
        // 重新標準化權重
        let totalWeight = adjustedWeights.values.reduce(0, +)
        for symbol in symbols {
            adjustedWeights[symbol] = (adjustedWeights[symbol] ?? 0) / totalWeight
        }
        
        return adjustedWeights
    }
    
    // 獲取市場情緒 (簡化版)
    private func getMarketSentiment(for symbol: String) -> Double {
        // 根據股票類型返回模擬的市場情緒
        let techStocks = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META"]
        let defensiveStocks = ["JNJ", "PG", "KO", "WMT", "UNH"]
        
        if techStocks.contains(symbol) {
            return Double.random(in: -0.2...0.3) // 科技股波動較大
        } else if defensiveStocks.contains(symbol) {
            return Double.random(in: -0.1...0.1) // 防禦股較穩定
        } else {
            return Double.random(in: -0.15...0.15)
        }
    }
    
    // 計算投資組合指標
    private func calculatePortfolioMetrics(weights: [String: Double],
                                         expectedReturns: [String: Double],
                                         covarianceMatrix: [[Double]],
                                         historicalData: [String: [Double]]) -> (expectedReturn: Double, expectedVolatility: Double, sharpeRatio: Double, maxDrawdown: Double, diversificationScore: Double, riskMetrics: PortfolioRiskMetrics) {
        
        let symbols = Array(weights.keys)
        
        // 計算預期報酬率
        let expectedReturn = symbols.reduce(0.0) { result, symbol in
            result + (weights[symbol] ?? 0) * (expectedReturns[symbol] ?? 0)
        }
        
        // 計算預期波動率
        var portfolioVariance = 0.0
        for i in 0..<symbols.count {
            for j in 0..<symbols.count {
                let symbol1 = symbols[i]
                let symbol2 = symbols[j]
                let weight1 = weights[symbol1] ?? 0
                let weight2 = weights[symbol2] ?? 0
                portfolioVariance += weight1 * weight2 * covarianceMatrix[i][j]
            }
        }
        let expectedVolatility = sqrt(portfolioVariance)
        
        // 計算 Sharpe 比率
        let sharpeRatio = (expectedReturn - riskFreeRate) / expectedVolatility
        
        // 計算最大回撤
        let maxDrawdown = calculateMaxDrawdown(weights: weights, historicalData: historicalData)
        
        // 計算分散化分數
        let diversificationScore = calculateDiversificationScore(weights: weights)
        
        // 計算風險指標
        let riskMetrics = calculateRiskMetrics(
            weights: weights,
            expectedReturns: expectedReturns,
            historicalData: historicalData,
            expectedReturn: expectedReturn,
            expectedVolatility: expectedVolatility
        )
        
        return (expectedReturn, expectedVolatility, sharpeRatio, maxDrawdown, diversificationScore, riskMetrics)
    }
    
    // 計算最大回撤
    private func calculateMaxDrawdown(weights: [String: Double], historicalData: [String: [Double]]) -> Double {
        let symbols = Array(weights.keys)
        guard let firstSymbolData = historicalData[symbols[0]] else { return 0 }
        
        let periods = firstSymbolData.count
        var portfolioValues: [Double] = [1.0] // 起始值為1
        
        // 計算投資組合價值序列
        for i in 0..<periods {
            var periodReturn = 0.0
            for symbol in symbols {
                if let returns = historicalData[symbol], i < returns.count {
                    periodReturn += (weights[symbol] ?? 0) * returns[i]
                }
            }
            let newValue = portfolioValues.last! * (1 + periodReturn)
            portfolioValues.append(newValue)
        }
        
        // 計算最大回撤
        var peak = portfolioValues[0]
        var maxDrawdown = 0.0
        
        for value in portfolioValues {
            if value > peak {
                peak = value
            } else {
                let drawdown = (peak - value) / peak
                maxDrawdown = max(maxDrawdown, drawdown)
            }
        }
        
        return maxDrawdown
    }
    
    // 計算分散化分數
    private func calculateDiversificationScore(weights: [String: Double]) -> Double {
        // 使用 Herfindahl-Hirschman 指數的逆數作為分散化指標
        let hhi = weights.values.map { $0 * $0 }.reduce(0, +)
        return 1.0 / hhi / Double(weights.count) * 100 // 標準化到0-100
    }
    
    // 計算風險指標
    private func calculateRiskMetrics(weights: [String: Double],
                                    expectedReturns: [String: Double],
                                    historicalData: [String: [Double]],
                                    expectedReturn: Double,
                                    expectedVolatility: Double) -> PortfolioRiskMetrics {
        
        // 計算投資組合歷史報酬序列
        let symbols = Array(weights.keys)
        guard let firstSymbolData = historicalData[symbols[0]] else {
            return PortfolioRiskMetrics(var95: 0, cvar95: 0, beta: 1, alpha: 0, informationRatio: 0, trackingError: 0)
        }
        
        let periods = firstSymbolData.count
        var portfolioReturns: [Double] = []
        
        for i in 0..<periods {
            var periodReturn = 0.0
            for symbol in symbols {
                if let returns = historicalData[symbol], i < returns.count {
                    periodReturn += (weights[symbol] ?? 0) * returns[i]
                }
            }
            portfolioReturns.append(periodReturn)
        }
        
        // 計算 VaR (95%)
        let sortedReturns = portfolioReturns.sorted()
        let var95Index = Int(Double(sortedReturns.count) * 0.05)
        let var95 = abs(sortedReturns[var95Index]) * sqrt(252) // 年化
        
        // 計算 CVaR (95%)
        let tailReturns = Array(sortedReturns[0...var95Index])
        let cvar95 = abs(tailReturns.reduce(0, +) / Double(tailReturns.count)) * sqrt(252)
        
        // 簡化的 Beta、Alpha 計算 (相對於市場)
        let beta = 1.0 // 簡化假設
        let alpha = expectedReturn - riskFreeRate - beta * 0.1 // 假設市場報酬率10%
        
        // Information Ratio 和 Tracking Error
        let benchmarkReturn = 0.1 // 假設基準報酬率
        let excessReturns = portfolioReturns.map { $0 * 252 - benchmarkReturn }
        let trackingError = sqrt(excessReturns.map { $0 * $0 }.reduce(0, +) / Double(excessReturns.count - 1))
        let informationRatio = trackingError > 0 ? (expectedReturn - benchmarkReturn) / trackingError : 0
        
        return PortfolioRiskMetrics(
            var95: var95,
            cvar95: cvar95,
            beta: beta,
            alpha: alpha,
            informationRatio: informationRatio,
            trackingError: trackingError
        )
    }
    
    // 生成再平衡建議
    private func generateRebalancingAdvice(weights: [String: Double]) -> [RebalancingAdvice] {
        var advice: [RebalancingAdvice] = []
        
        for (symbol, targetWeight) in weights {
            // 模擬當前權重 (實際應用中從用戶投資組合獲取)
            let currentWeight = Double.random(in: max(0, targetWeight - 0.1)...min(1, targetWeight + 0.1))
            let difference = targetWeight - currentWeight
            
            let action: String
            let reason: String
            
            if abs(difference) > 0.05 { // 差異超過5%才建議調整
                if difference > 0 {
                    action = "增加"
                    reason = "權重低於最佳配置，建議增加投資"
                } else {
                    action = "減少"
                    reason = "權重高於最佳配置，建議減少投資"
                }
            } else {
                action = "維持"
                reason = "權重接近最佳配置"
            }
            
            advice.append(RebalancingAdvice(
                symbol: symbol,
                currentWeight: currentWeight,
                targetWeight: targetWeight,
                action: action,
                reason: reason
            ))
        }
        
        return advice.sorted { $0.symbol < $1.symbol }
    }
    
    // 動態再平衡建議
    func generateDynamicRebalancingAdvice(currentPortfolio: [String: Double],
                                        marketConditions: [String: Any],
                                        completion: @escaping ([RebalancingAdvice]) -> Void) {
        
        DispatchQueue.global(qos: .userInitiated).async {
            var advice: [RebalancingAdvice] = []
            
            for (symbol, currentWeight) in currentPortfolio {
                // 根據市場條件調整建議
                let marketSentiment = self.getMarketSentiment(for: symbol)
                let volatility = Double.random(in: 0.15...0.35) // 模擬波動率
                
                var targetWeight = currentWeight
                var reason = "維持當前配置"
                var action = "維持"
                
                // 基於市場情緒調整
                if marketSentiment > 0.2 {
                    targetWeight = min(0.3, currentWeight * 1.1)
                    action = "增加"
                    reason = "市場情緒積極，建議增加配置"
                } else if marketSentiment < -0.2 {
                    targetWeight = max(0.05, currentWeight * 0.9)
                    action = "減少"
                    reason = "市場情緒謹慎，建議減少配置"
                }
                
                // 基於波動率調整
                if volatility > 0.3 {
                    targetWeight *= 0.95
                    reason += " (高波動風險調整)"
                }
                
                advice.append(RebalancingAdvice(
                    symbol: symbol,
                    currentWeight: currentWeight,
                    targetWeight: targetWeight,
                    action: action,
                    reason: reason
                ))
            }
            
            DispatchQueue.main.async {
                completion(advice)
            }
        }
    }
}