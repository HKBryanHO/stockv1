#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
高級交易策略
包含多因子模型、配對交易、均值回歸、動量策略等
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
from scipy.optimize import minimize
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
import talib
import yfinance as yf
from typing import List, Dict, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

class MultiFactorModel:
    """多因子模型"""
    
    def __init__(self):
        self.factors = {}
        self.factor_loadings = {}
        self.scaler = StandardScaler()
    
    def add_factor(self, name: str, factor_data: pd.Series):
        """
        添加因子
        
        Args:
            name: 因子名稱
            factor_data: 因子數據
        """
        self.factors[name] = factor_data
    
    def calculate_factor_returns(self, returns: pd.Series) -> pd.DataFrame:
        """
        計算因子收益率
        
        Args:
            returns: 股票收益率
            
        Returns:
            DataFrame: 因子收益率
        """
        factor_returns = pd.DataFrame(index=returns.index)
        
        for name, factor in self.factors.items():
            # 計算因子收益率
            factor_returns[name] = factor.pct_change()
        
        return factor_returns.dropna()
    
    def fit_model(self, returns: pd.Series, factor_returns: pd.DataFrame):
        """
        擬合多因子模型
        
        Args:
            returns: 股票收益率
            factor_returns: 因子收益率
        """
        # 對齊數據
        aligned_data = pd.concat([returns, factor_returns], axis=1, join='inner')
        aligned_data = aligned_data.dropna()
        
        if len(aligned_data) < 10:
            raise ValueError("數據不足，無法擬合模型")
        
        # 標準化因子
        factor_data_scaled = self.scaler.fit_transform(aligned_data.iloc[:, 1:])
        
        # 線性回歸
        from sklearn.linear_model import LinearRegression
        model = LinearRegression()
        model.fit(factor_data_scaled, aligned_data.iloc[:, 0])
        
        # 保存因子載荷
        self.factor_loadings = dict(zip(factor_returns.columns, model.coef_))
        self.alpha = model.intercept_
        
        return model
    
    def predict_returns(self, factor_returns: pd.DataFrame) -> np.ndarray:
        """
        預測收益率
        
        Args:
            factor_returns: 因子收益率
            
        Returns:
            np.ndarray: 預測收益率
        """
        factor_data_scaled = self.scaler.transform(factor_returns)
        predicted_returns = self.alpha + np.dot(factor_data_scaled, list(self.factor_loadings.values()))
        
        return predicted_returns

class PairsTrading:
    """配對交易策略"""
    
    def __init__(self, lookback_period=252):
        self.lookback_period = lookback_period
        self.pairs = {}
        self.cointegration_results = {}
    
    def find_cointegrated_pairs(self, price_data: pd.DataFrame, significance_level=0.05) -> List[Tuple[str, str]]:
        """
        尋找協整對
        
        Args:
            price_data: 價格數據 DataFrame
            significance_level: 顯著性水平
            
        Returns:
            List[Tuple[str, str]]: 協整對列表
        """
        symbols = price_data.columns
        cointegrated_pairs = []
        
        for i, symbol1 in enumerate(symbols):
            for symbol2 in symbols[i+1:]:
                try:
                    # 計算協整檢驗
                    result = self._cointegration_test(
                        price_data[symbol1].dropna(),
                        price_data[symbol2].dropna()
                    )
                    
                    if result['p_value'] < significance_level:
                        cointegrated_pairs.append((symbol1, symbol2))
                        self.cointegration_results[(symbol1, symbol2)] = result
                        
                except Exception as e:
                    print(f"協整檢驗失敗 {symbol1}-{symbol2}: {e}")
                    continue
        
        return cointegrated_pairs
    
    def _cointegration_test(self, series1: pd.Series, series2: pd.Series) -> Dict:
        """
        協整檢驗
        
        Args:
            series1: 第一個時間序列
            series2: 第二個時間序列
            
        Returns:
            Dict: 協整檢驗結果
        """
        from statsmodels.tsa.stattools import coint
        
        # 對齊數據
        aligned_data = pd.concat([series1, series2], axis=1, join='inner').dropna()
        
        if len(aligned_data) < 30:
            return {'p_value': 1.0, 'statistic': 0, 'critical_values': {}}
        
        # 協整檢驗
        statistic, p_value, critical_values = coint(aligned_data.iloc[:, 0], aligned_data.iloc[:, 1])
        
        return {
            'statistic': statistic,
            'p_value': p_value,
            'critical_values': critical_values
        }
    
    def calculate_spread(self, price1: pd.Series, price2: pd.Series, hedge_ratio: float) -> pd.Series:
        """
        計算價差
        
        Args:
            price1: 第一個價格序列
            price2: 第二個價格序列
            hedge_ratio: 對沖比率
            
        Returns:
            pd.Series: 價差序列
        """
        spread = price1 - hedge_ratio * price2
        return spread
    
    def calculate_hedge_ratio(self, price1: pd.Series, price2: pd.Series) -> float:
        """
        計算對沖比率
        
        Args:
            price1: 第一個價格序列
            price2: 第二個價格序列
            
        Returns:
            float: 對沖比率
        """
        # 對齊數據
        aligned_data = pd.concat([price1, price2], axis=1, join='inner').dropna()
        
        if len(aligned_data) < 10:
            return 1.0
        
        # 使用 OLS 回歸計算對沖比率
        from sklearn.linear_model import LinearRegression
        model = LinearRegression()
        model.fit(aligned_data.iloc[:, 1].values.reshape(-1, 1), aligned_data.iloc[:, 0])
        
        return model.coef_[0]
    
    def generate_signals(self, price1: pd.Series, price2: pd.Series, 
                        entry_threshold=2.0, exit_threshold=0.5) -> pd.DataFrame:
        """
        生成配對交易信號
        
        Args:
            price1: 第一個價格序列
            price2: 第二個價格序列
            entry_threshold: 入場閾值（標準差倍數）
            exit_threshold: 出場閾值（標準差倍數）
            
        Returns:
            pd.DataFrame: 交易信號
        """
        # 計算對沖比率
        hedge_ratio = self.calculate_hedge_ratio(price1, price2)
        
        # 計算價差
        spread = self.calculate_spread(price1, price2, hedge_ratio)
        
        # 計算價差的統計量
        spread_mean = spread.rolling(window=self.lookback_period).mean()
        spread_std = spread.rolling(window=self.lookback_period).std()
        
        # 標準化價差
        z_score = (spread - spread_mean) / spread_std
        
        # 生成信號
        signals = pd.DataFrame(index=price1.index)
        signals['z_score'] = z_score
        signals['spread'] = spread
        signals['hedge_ratio'] = hedge_ratio
        
        # 交易信號
        signals['signal'] = 0
        signals['position'] = 0
        
        position = 0
        for i in range(len(signals)):
            if pd.isna(z_score.iloc[i]):
                continue
                
            if z_score.iloc[i] > entry_threshold and position == 0:
                # 價差過高，賣出價差（賣出第一個，買入第二個）
                signals.iloc[i, signals.columns.get_loc('signal')] = -1
                position = -1
                
            elif z_score.iloc[i] < -entry_threshold and position == 0:
                # 價差過低，買入價差（買入第一個，賣出第二個）
                signals.iloc[i, signals.columns.get_loc('signal')] = 1
                position = 1
                
            elif abs(z_score.iloc[i]) < exit_threshold and position != 0:
                # 價差回歸，平倉
                signals.iloc[i, signals.columns.get_loc('signal')] = -position
                position = 0
            
            signals.iloc[i, signals.columns.get_loc('position')] = position
        
        return signals

class MeanReversionStrategy:
    """均值回歸策略"""
    
    def __init__(self, lookback_period=20, entry_threshold=2.0, exit_threshold=0.5):
        self.lookback_period = lookback_period
        self.entry_threshold = entry_threshold
        self.exit_threshold = exit_threshold
    
    def calculate_bollinger_bands(self, prices: pd.Series, period: int = 20, std_dev: float = 2.0) -> pd.DataFrame:
        """
        計算布林帶
        
        Args:
            prices: 價格序列
            period: 週期
            std_dev: 標準差倍數
            
        Returns:
            pd.DataFrame: 布林帶數據
        """
        bb_upper, bb_middle, bb_lower = talib.BBANDS(prices, timeperiod=period, nbdevup=std_dev, nbdevdn=std_dev)
        
        bb_data = pd.DataFrame(index=prices.index)
        bb_data['upper'] = bb_upper
        bb_data['middle'] = bb_middle
        bb_data['lower'] = bb_lower
        bb_data['price'] = prices
        bb_data['position'] = (prices - bb_lower) / (bb_upper - bb_lower)
        
        return bb_data
    
    def generate_signals(self, prices: pd.Series) -> pd.DataFrame:
        """
        生成均值回歸信號
        
        Args:
            prices: 價格序列
            
        Returns:
            pd.DataFrame: 交易信號
        """
        # 計算布林帶
        bb_data = self.calculate_bollinger_bands(prices, self.lookback_period)
        
        # 生成信號
        signals = pd.DataFrame(index=prices.index)
        signals['price'] = prices
        signals['bb_upper'] = bb_data['upper']
        signals['bb_middle'] = bb_data['middle']
        signals['bb_lower'] = bb_data['lower']
        signals['position'] = bb_data['position']
        signals['signal'] = 0
        signals['trade_position'] = 0
        
        position = 0
        for i in range(len(signals)):
            if pd.isna(bb_data['position'].iloc[i]):
                continue
            
            pos = bb_data['position'].iloc[i]
            
            if pos < 0.1 and position == 0:  # 接近下軌，買入
                signals.iloc[i, signals.columns.get_loc('signal')] = 1
                position = 1
                
            elif pos > 0.9 and position == 0:  # 接近上軌，賣出
                signals.iloc[i, signals.columns.get_loc('signal')] = -1
                position = -1
                
            elif 0.3 < pos < 0.7 and position != 0:  # 回歸中軌，平倉
                signals.iloc[i, signals.columns.get_loc('signal')] = -position
                position = 0
            
            signals.iloc[i, signals.columns.get_loc('trade_position')] = position
        
        return signals

class MomentumStrategy:
    """動量策略"""
    
    def __init__(self, lookback_period=20, entry_threshold=0.02):
        self.lookback_period = lookback_period
        self.entry_threshold = entry_threshold
    
    def calculate_momentum_indicators(self, prices: pd.Series) -> pd.DataFrame:
        """
        計算動量指標
        
        Args:
            prices: 價格序列
            
        Returns:
            pd.DataFrame: 動量指標
        """
        indicators = pd.DataFrame(index=prices.index)
        indicators['price'] = prices
        
        # 收益率
        indicators['returns'] = prices.pct_change()
        
        # 移動平均
        indicators['ma_short'] = talib.SMA(prices, timeperiod=10)
        indicators['ma_long'] = talib.SMA(prices, timeperiod=20)
        
        # MACD
        macd, macd_signal, macd_hist = talib.MACD(prices)
        indicators['macd'] = macd
        indicators['macd_signal'] = macd_signal
        indicators['macd_histogram'] = macd_hist
        
        # RSI
        indicators['rsi'] = talib.RSI(prices, timeperiod=14)
        
        # 動量
        indicators['momentum'] = prices / prices.shift(self.lookback_period) - 1
        
        # 價格位置
        indicators['price_position'] = (prices - prices.rolling(20).min()) / (prices.rolling(20).max() - prices.rolling(20).min())
        
        return indicators
    
    def generate_signals(self, prices: pd.Series) -> pd.DataFrame:
        """
        生成動量信號
        
        Args:
            prices: 價格序列
            
        Returns:
            pd.DataFrame: 交易信號
        """
        indicators = self.calculate_momentum_indicators(prices)
        
        signals = pd.DataFrame(index=prices.index)
        signals['price'] = prices
        signals['momentum'] = indicators['momentum']
        signals['macd'] = indicators['macd']
        signals['macd_signal'] = indicators['macd_signal']
        signals['rsi'] = indicators['rsi']
        signals['signal'] = 0
        signals['position'] = 0
        
        position = 0
        for i in range(len(signals)):
            if pd.isna(indicators['momentum'].iloc[i]):
                continue
            
            momentum = indicators['momentum'].iloc[i]
            macd = indicators['macd'].iloc[i]
            macd_signal = indicators['macd_signal'].iloc[i]
            rsi = indicators['rsi'].iloc[i]
            
            # 動量策略邏輯
            if (momentum > self.entry_threshold and 
                macd > macd_signal and 
                rsi < 70 and 
                position == 0):
                # 強勢動量，買入
                signals.iloc[i, signals.columns.get_loc('signal')] = 1
                position = 1
                
            elif (momentum < -self.entry_threshold and 
                  macd < macd_signal and 
                  rsi > 30 and 
                  position == 0):
                # 弱勢動量，賣出
                signals.iloc[i, signals.columns.get_loc('signal')] = -1
                position = -1
                
            elif (abs(momentum) < self.entry_threshold / 2 and position != 0):
                # 動量減弱，平倉
                signals.iloc[i, signals.columns.get_loc('signal')] = -position
                position = 0
            
            signals.iloc[i, signals.columns.get_loc('position')] = position
        
        return signals

class PortfolioOptimizer:
    """投資組合優化器"""
    
    def __init__(self):
        self.weights = None
        self.expected_returns = None
        self.covariance_matrix = None
    
    def calculate_expected_returns(self, returns: pd.DataFrame) -> pd.Series:
        """
        計算預期收益率
        
        Args:
            returns: 收益率數據
            
        Returns:
            pd.Series: 預期收益率
        """
        return returns.mean() * 252  # 年化收益率
    
    def calculate_covariance_matrix(self, returns: pd.DataFrame) -> pd.DataFrame:
        """
        計算協方差矩陣
        
        Args:
            returns: 收益率數據
            
        Returns:
            pd.DataFrame: 協方差矩陣
        """
        return returns.cov() * 252  # 年化協方差
    
    def optimize_portfolio(self, returns: pd.DataFrame, method='max_sharpe', 
                          risk_free_rate=0.02) -> Dict:
        """
        優化投資組合
        
        Args:
            returns: 收益率數據
            method: 優化方法 ('max_sharpe', 'min_variance', 'max_return')
            risk_free_rate: 無風險利率
            
        Returns:
            Dict: 優化結果
        """
        self.expected_returns = self.calculate_expected_returns(returns)
        self.covariance_matrix = self.calculate_covariance_matrix(returns)
        
        n_assets = len(returns.columns)
        
        # 約束條件
        constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1})  # 權重和為1
        bounds = tuple((0, 1) for _ in range(n_assets))  # 權重非負
        
        # 初始權重
        x0 = np.array([1/n_assets] * n_assets)
        
        if method == 'max_sharpe':
            # 最大化夏普比率
            def negative_sharpe(weights):
                portfolio_return = np.sum(weights * self.expected_returns)
                portfolio_std = np.sqrt(np.dot(weights.T, np.dot(self.covariance_matrix, weights)))
                sharpe_ratio = (portfolio_return - risk_free_rate) / portfolio_std
                return -sharpe_ratio
            
            result = minimize(negative_sharpe, x0, method='SLSQP', bounds=bounds, constraints=constraints)
            
        elif method == 'min_variance':
            # 最小化方差
            def portfolio_variance(weights):
                return np.dot(weights.T, np.dot(self.covariance_matrix, weights))
            
            result = minimize(portfolio_variance, x0, method='SLSQP', bounds=bounds, constraints=constraints)
            
        elif method == 'max_return':
            # 最大化收益率
            def negative_return(weights):
                return -np.sum(weights * self.expected_returns)
            
            result = minimize(negative_return, x0, method='SLSQP', bounds=bounds, constraints=constraints)
        
        self.weights = result.x
        
        # 計算投資組合統計量
        portfolio_return = np.sum(self.weights * self.expected_returns)
        portfolio_std = np.sqrt(np.dot(self.weights.T, np.dot(self.covariance_matrix, self.weights)))
        sharpe_ratio = (portfolio_return - risk_free_rate) / portfolio_std
        
        return {
            'weights': dict(zip(returns.columns, self.weights)),
            'expected_return': portfolio_return,
            'volatility': portfolio_std,
            'sharpe_ratio': sharpe_ratio
        }

def load_multiple_stocks(symbols: List[str], period: str = '1y') -> pd.DataFrame:
    """
    載入多隻股票數據 - 使用專業金融數據源
    
    Args:
        symbols: 股票代號列表
        period: 時間週期
        
    Returns:
        pd.DataFrame: 股票價格數據
    """
    data = {}
    
    for symbol in symbols:
        try:
            print(f"📊 載入 {symbol} 數據...")
            
            # 優先使用 yfinance (免費且可靠)
            ticker = yf.Ticker(symbol)
            stock_data = ticker.history(period=period)
            
            if not stock_data.empty:
                data[symbol] = stock_data['Close']
                print(f"✅ {symbol}: 載入 {len(stock_data)} 條記錄")
            else:
                print(f"⚠️ yfinance 無法獲取 {symbol}，嘗試其他數據源...")
                # 嘗試其他數據源
                alt_data = load_single_stock_alternative(symbol, period)
                if alt_data is not None:
                    data[symbol] = alt_data
                    print(f"✅ {symbol}: 使用替代數據源載入 {len(alt_data)} 條記錄")
                else:
                    print(f"❌ {symbol}: 所有數據源都失敗，跳過此股票")
                    continue
                
        except Exception as e:
            print(f"❌ 載入 {symbol} 失敗: {e}")
            # 嘗試替代數據源
            try:
                alt_data = load_single_stock_alternative(symbol, period)
                if alt_data is not None:
                    data[symbol] = alt_data
                    print(f"✅ {symbol}: 使用替代數據源載入 {len(alt_data)} 條記錄")
                else:
                    print(f"❌ {symbol}: 所有數據源都失敗，跳過此股票")
                    continue
            except Exception as e2:
                print(f"❌ {symbol}: 替代數據源也失敗: {e2}")
                continue
    
    if not data:
        print("❌ 無法載入任何股票數據，生成模擬數據...")
        return generate_simulated_multiple_stocks(symbols, period)
    
    return pd.DataFrame(data).dropna()

def load_single_stock_alternative(symbol: str, period: str) -> Optional[pd.Series]:
    """
    從替代數據源載入單隻股票數據
    
    Args:
        symbol: 股票代號
        period: 時間週期
        
    Returns:
        pd.Series: 股票價格數據
    """
    try:
        # 嘗試使用 Alpha Vantage
        import requests
        import os
        
        api_key = os.getenv('ALPHA_VANTAGE_KEY', '')
        if api_key:
            url = f"https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={symbol}&apikey={api_key}&outputsize=full"
            response = requests.get(url)
            data = response.json()
            
            if 'Time Series (Daily)' in data:
                time_series = data['Time Series (Daily)']
                prices = []
                dates = []
                
                for date, values in time_series.items():
                    dates.append(pd.to_datetime(date))
                    prices.append(float(values['4. close']))
                
                series = pd.Series(prices, index=dates)
                series.sort_index(inplace=True)
                return series
        
        return None
        
    except Exception as e:
        print(f"替代數據源載入 {symbol} 失敗: {e}")
        return None

def generate_simulated_multiple_stocks(symbols: List[str], period: str) -> pd.DataFrame:
    """
    生成多隻股票的模擬數據
    
    Args:
        symbols: 股票代號列表
        period: 時間週期
        
    Returns:
        pd.DataFrame: 模擬股票價格數據
    """
    print("🎲 生成多隻股票的模擬數據...")
    
    # 計算天數
    days = 365 if period == '1y' else 730 if period == '2y' else 180 if period == '6m' else 365
    
    # 生成日期範圍
    dates = pd.date_range(end=pd.Timestamp.now(), periods=days, freq='D')
    
    data = {}
    for symbol in symbols:
        # 基於股票代號生成基礎價格
        base_price = 100 + hash(symbol) % 50
        prices = [base_price]
        
        for i in range(1, days):
            # 模擬價格變動
            change = (hash(f"{symbol}{dates[i]}") % 100 - 50) / 1000  # -5% 到 +5% 的變動
            new_price = prices[-1] * (1 + change)
            prices.append(new_price)
        
        data[symbol] = pd.Series(prices, index=dates)
    
    print(f"✅ 生成 {len(symbols)} 隻股票的模擬數據")
    return pd.DataFrame(data)

def main():
    """主函數示例"""
    print("載入股票數據...")
    symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']
    price_data = load_multiple_stocks(symbols, period='2y')
    
    if price_data.empty:
        print("無法載入數據")
        return
    
    print("執行多因子分析...")
    # 多因子模型
    mf_model = MultiFactorModel()
    
    # 添加因子
    for symbol in symbols:
        returns = price_data[symbol].pct_change()
        mf_model.add_factor(f'{symbol}_momentum', returns.rolling(20).mean())
        mf_model.add_factor(f'{symbol}_volatility', returns.rolling(20).std())
    
    # 配對交易
    print("執行配對交易分析...")
    pairs_trading = PairsTrading()
    cointegrated_pairs = pairs_trading.find_cointegrated_pairs(price_data)
    print(f"找到 {len(cointegrated_pairs)} 個協整對")
    
    # 均值回歸策略
    print("執行均值回歸策略...")
    mean_reversion = MeanReversionStrategy()
    signals = mean_reversion.generate_signals(price_data['AAPL'])
    
    # 動量策略
    print("執行動量策略...")
    momentum = MomentumStrategy()
    momentum_signals = momentum.generate_signals(price_data['AAPL'])
    
    # 投資組合優化
    print("執行投資組合優化...")
    returns = price_data.pct_change().dropna()
    optimizer = PortfolioOptimizer()
    optimal_portfolio = optimizer.optimize_portfolio(returns, method='max_sharpe')
    
    print("投資組合優化結果:")
    for symbol, weight in optimal_portfolio['weights'].items():
        print(f"{symbol}: {weight:.4f}")
    print(f"預期收益率: {optimal_portfolio['expected_return']:.4f}")
    print(f"波動率: {optimal_portfolio['volatility']:.4f}")
    print(f"夏普比率: {optimal_portfolio['sharpe_ratio']:.4f}")

if __name__ == "__main__":
    main()
