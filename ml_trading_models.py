#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
機器學習交易模型
包含 LSTM、Random Forest、SVM 等模型用於股票預測和交易信號生成
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.svm import SVC, SVR
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, classification_report, mean_squared_error
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout, Conv1D, MaxPooling1D
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
import talib
import yfinance as yf
import warnings
warnings.filterwarnings('ignore')

class FeatureEngineer:
    """特徵工程類"""
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.feature_names = []
    
    def create_technical_features(self, df):
        """
        創建技術指標特徵
        
        Args:
            df: 包含 OHLCV 數據的 DataFrame
            
        Returns:
            DataFrame: 包含技術指標的 DataFrame
        """
        # 基本價格特徵
        df['price_change'] = df['close'].pct_change()
        df['high_low_ratio'] = df['high'] / df['low']
        df['close_open_ratio'] = df['close'] / df['open']
        
        # 移動平均線
        for period in [5, 10, 20, 50, 100]:
            df[f'ma_{period}'] = talib.SMA(df['close'], timeperiod=period)
            df[f'ma_{period}_ratio'] = df['close'] / df[f'ma_{period}']
        
        # 指數移動平均線
        for period in [12, 26]:
            df[f'ema_{period}'] = talib.EMA(df['close'], timeperiod=period)
            df[f'ema_{period}_ratio'] = df['close'] / df[f'ema_{period}']
        
        # RSI
        df['rsi'] = talib.RSI(df['close'], timeperiod=14)
        df['rsi_oversold'] = (df['rsi'] < 30).astype(int)
        df['rsi_overbought'] = (df['rsi'] > 70).astype(int)
        
        # MACD
        macd, macd_signal, macd_hist = talib.MACD(df['close'])
        df['macd'] = macd
        df['macd_signal'] = macd_signal
        df['macd_histogram'] = macd_hist
        
        # 布林帶
        bb_upper, bb_middle, bb_lower = talib.BBANDS(df['close'])
        df['bb_upper'] = bb_upper
        df['bb_middle'] = bb_middle
        df['bb_lower'] = bb_lower
        df['bb_width'] = (bb_upper - bb_lower) / bb_middle
        df['bb_position'] = (df['close'] - bb_lower) / (bb_upper - bb_lower)
        
        # 成交量指標
        df['volume_sma'] = talib.SMA(df['volume'], timeperiod=20)
        df['volume_ratio'] = df['volume'] / df['volume_sma']
        
        # 波動率
        df['volatility'] = df['close'].rolling(window=20).std()
        df['volatility_ratio'] = df['volatility'] / df['volatility'].rolling(window=50).mean()
        
        # 價格位置
        df['price_position_20'] = (df['close'] - df['close'].rolling(20).min()) / (df['close'].rolling(20).max() - df['close'].rolling(20).min())
        df['price_position_50'] = (df['close'] - df['close'].rolling(50).min()) / (df['close'].rolling(50).max() - df['close'].rolling(50).min())
        
        return df
    
    def create_lag_features(self, df, target_col='close', lags=[1, 2, 3, 5, 10]):
        """
        創建滯後特徵
        
        Args:
            df: DataFrame
            target_col: 目標列名
            lags: 滯後期數列表
            
        Returns:
            DataFrame: 包含滯後特徵的 DataFrame
        """
        for lag in lags:
            df[f'{target_col}_lag_{lag}'] = df[target_col].shift(lag)
            df[f'{target_col}_change_lag_{lag}'] = df[target_col].pct_change(lag)
        
        return df
    
    def create_rolling_features(self, df, windows=[5, 10, 20]):
        """
        創建滾動窗口特徵
        
        Args:
            df: DataFrame
            windows: 窗口大小列表
            
        Returns:
            DataFrame: 包含滾動特徵的 DataFrame
        """
        for window in windows:
            # 滾動統計
            df[f'close_mean_{window}'] = df['close'].rolling(window).mean()
            df[f'close_std_{window}'] = df['close'].rolling(window).std()
            df[f'close_min_{window}'] = df['close'].rolling(window).min()
            df[f'close_max_{window}'] = df['close'].rolling(window).max()
            
            # 滾動分位數
            df[f'close_quantile_25_{window}'] = df['close'].rolling(window).quantile(0.25)
            df[f'close_quantile_75_{window}'] = df['close'].rolling(window).quantile(0.75)
            
            # 滾動偏度和峰度
            df[f'close_skew_{window}'] = df['close'].rolling(window).skew()
            df[f'close_kurt_{window}'] = df['close'].rolling(window).kurt()
        
        return df
    
    def create_target_variable(self, df, method='classification', threshold=0.02):
        """
        創建目標變量
        
        Args:
            df: DataFrame
            method: 'classification' 或 'regression'
            threshold: 分類閾值
            
        Returns:
            DataFrame: 包含目標變量的 DataFrame
        """
        if method == 'classification':
            # 分類：1=上漲，0=下跌
            df['target'] = (df['close'].shift(-1) > df['close'] * (1 + threshold)).astype(int)
        else:
            # 回歸：未來收益率
            df['target'] = df['close'].shift(-1) / df['close'] - 1
        
        return df
    
    def prepare_features(self, df, target_method='classification'):
        """
        準備所有特徵
        
        Args:
            df: 原始數據
            target_method: 目標變量方法
            
        Returns:
            tuple: (X, y, feature_names)
        """
        # 創建特徵
        df = self.create_technical_features(df)
        df = self.create_lag_features(df)
        df = self.create_rolling_features(df)
        df = self.create_target_variable(df, method=target_method)
        
        # 選擇特徵列
        feature_cols = [col for col in df.columns if col not in ['target', 'date', 'open', 'high', 'low', 'close', 'volume']]
        
        # 移除 NaN 值
        df_clean = df.dropna()
        
        X = df_clean[feature_cols]
        y = df_clean['target']
        
        # 保存特徵名稱
        self.feature_names = feature_cols
        
        return X, y, self.feature_names

class LSTMModel:
    """LSTM 深度學習模型"""
    
    def __init__(self, sequence_length=60, features_count=50):
        self.sequence_length = sequence_length
        self.features_count = features_count
        self.model = None
        self.scaler = MinMaxScaler()
    
    def prepare_sequences(self, X, y):
        """
        準備 LSTM 序列數據
        
        Args:
            X: 特徵數據
            y: 目標數據
            
        Returns:
            tuple: (X_seq, y_seq)
        """
        X_scaled = self.scaler.fit_transform(X)
        
        X_seq = []
        y_seq = []
        
        for i in range(self.sequence_length, len(X_scaled)):
            X_seq.append(X_scaled[i-self.sequence_length:i])
            y_seq.append(y.iloc[i])
        
        return np.array(X_seq), np.array(y_seq)
    
    def build_model(self, dropout_rate=0.2):
        """
        構建 LSTM 模型
        
        Args:
            dropout_rate: Dropout 比率
            
        Returns:
            model: 編譯好的模型
        """
        model = Sequential([
            LSTM(50, return_sequences=True, input_shape=(self.sequence_length, self.features_count)),
            Dropout(dropout_rate),
            LSTM(50, return_sequences=True),
            Dropout(dropout_rate),
            LSTM(50),
            Dropout(dropout_rate),
            Dense(25, activation='relu'),
            Dense(1, activation='sigmoid')
        ])
        
        model.compile(
            optimizer=Adam(learning_rate=0.001),
            loss='binary_crossentropy',
            metrics=['accuracy']
        )
        
        self.model = model
        return model
    
    def train(self, X_train, y_train, X_val, y_val, epochs=100, batch_size=32):
        """
        訓練模型
        
        Args:
            X_train: 訓練特徵
            y_train: 訓練目標
            X_val: 驗證特徵
            y_val: 驗證目標
            epochs: 訓練輪數
            batch_size: 批次大小
            
        Returns:
            history: 訓練歷史
        """
        # 準備序列數據
        X_train_seq, y_train_seq = self.prepare_sequences(X_train, y_train)
        X_val_seq, y_val_seq = self.prepare_sequences(X_val, y_val)
        
        # 構建模型
        if self.model is None:
            self.build_model()
        
        # 設置回調
        callbacks = [
            EarlyStopping(patience=10, restore_best_weights=True),
            ReduceLROnPlateau(factor=0.5, patience=5)
        ]
        
        # 訓練模型
        history = self.model.fit(
            X_train_seq, y_train_seq,
            validation_data=(X_val_seq, y_val_seq),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1
        )
        
        return history
    
    def predict(self, X):
        """
        預測
        
        Args:
            X: 特徵數據
            
        Returns:
            predictions: 預測結果
        """
        X_scaled = self.scaler.transform(X)
        X_seq = []
        
        for i in range(self.sequence_length, len(X_scaled) + 1):
            X_seq.append(X_scaled[i-self.sequence_length:i])
        
        X_seq = np.array(X_seq)
        predictions = self.model.predict(X_seq)
        
        return predictions.flatten()

class EnsembleModel:
    """集成學習模型"""
    
    def __init__(self):
        self.models = {}
        self.weights = {}
        self.scaler = StandardScaler()
    
    def add_model(self, name, model, weight=1.0):
        """
        添加模型
        
        Args:
            name: 模型名稱
            model: 模型對象
            weight: 模型權重
        """
        self.models[name] = model
        self.weights[name] = weight
    
    def train_models(self, X_train, y_train, X_val, y_val):
        """
        訓練所有模型
        
        Args:
            X_train: 訓練特徵
            y_train: 訓練目標
            X_val: 驗證特徵
            y_val: 驗證目標
        """
        # 標準化特徵
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_val_scaled = self.scaler.transform(X_val)
        
        for name, model in self.models.items():
            print(f"訓練模型: {name}")
            
            if name == 'lstm':
                # LSTM 需要特殊處理
                model.train(X_train, y_train, X_val, y_val)
            else:
                # 其他模型
                model.fit(X_train_scaled, y_train)
                
                # 計算權重（基於驗證集性能）
                if hasattr(model, 'predict_proba'):
                    y_pred_proba = model.predict_proba(X_val_scaled)[:, 1]
                else:
                    y_pred_proba = model.predict(X_val_scaled)
                
                # 計算 AUC 作為權重
                from sklearn.metrics import roc_auc_score
                try:
                    auc = roc_auc_score(y_val, y_pred_proba)
                    self.weights[name] = max(0.1, auc)  # 最小權重 0.1
                except:
                    self.weights[name] = 0.1
    
    def predict(self, X):
        """
        集成預測
        
        Args:
            X: 特徵數據
            
        Returns:
            predictions: 集成預測結果
        """
        X_scaled = self.scaler.transform(X)
        predictions = []
        weights = []
        
        for name, model in self.models.items():
            if name == 'lstm':
                pred = model.predict(X)
            else:
                if hasattr(model, 'predict_proba'):
                    pred = model.predict_proba(X_scaled)[:, 1]
                else:
                    pred = model.predict(X_scaled)
            
            predictions.append(pred)
            weights.append(self.weights[name])
        
        # 加權平均
        predictions = np.array(predictions)
        weights = np.array(weights)
        weights = weights / weights.sum()  # 歸一化權重
        
        ensemble_pred = np.average(predictions, axis=0, weights=weights)
        
        return ensemble_pred

class TradingStrategy:
    """交易策略類"""
    
    def __init__(self, model, threshold=0.5):
        self.model = model
        self.threshold = threshold
        self.positions = {}
    
    def generate_signals(self, X, prices):
        """
        生成交易信號
        
        Args:
            X: 特徵數據
            prices: 價格數據
            
        Returns:
            signals: 交易信號列表
        """
        predictions = self.model.predict(X)
        signals = []
        
        for i, (pred, price) in enumerate(zip(predictions, prices)):
            if pred > self.threshold:
                signals.append({
                    'action': 'BUY',
                    'confidence': pred,
                    'price': price,
                    'timestamp': i
                })
            elif pred < (1 - self.threshold):
                signals.append({
                    'action': 'SELL',
                    'confidence': 1 - pred,
                    'price': price,
                    'timestamp': i
                })
            else:
                signals.append({
                    'action': 'HOLD',
                    'confidence': 0.5,
                    'price': price,
                    'timestamp': i
                })
        
        return signals
    
    def backtest_strategy(self, signals, prices, initial_capital=100000):
        """
        回測策略
        
        Args:
            signals: 交易信號
            prices: 價格數據
            initial_capital: 初始資本
            
        Returns:
            dict: 回測結果
        """
        capital = initial_capital
        position = 0
        trades = []
        
        for signal in signals:
            if signal['action'] == 'BUY' and position == 0:
                # 買入
                shares = int(capital * 0.1 / signal['price'])  # 使用 10% 資本
                if shares > 0:
                    position = shares
                    capital -= shares * signal['price']
                    trades.append({
                        'action': 'BUY',
                        'shares': shares,
                        'price': signal['price'],
                        'timestamp': signal['timestamp']
                    })
            
            elif signal['action'] == 'SELL' and position > 0:
                # 賣出
                capital += position * signal['price']
                trades.append({
                    'action': 'SELL',
                    'shares': position,
                    'price': signal['price'],
                    'timestamp': signal['timestamp']
                })
                position = 0
        
        # 計算最終價值
        final_value = capital + (position * prices[-1] if position > 0 else 0)
        total_return = (final_value - initial_capital) / initial_capital
        
        return {
            'initial_capital': initial_capital,
            'final_value': final_value,
            'total_return': total_return,
            'trades': trades,
            'total_trades': len(trades)
        }

def load_stock_data(symbol, period='1y'):
    """
    載入股票數據 - 使用專業金融數據源
    
    Args:
        symbol: 股票代號
        period: 時間週期
        
    Returns:
        DataFrame: 股票數據
    """
    try:
        # 優先使用 yfinance (免費且可靠)
        print(f"📊 使用 yfinance 載入 {symbol} 數據...")
        ticker = yf.Ticker(symbol)
        data = ticker.history(period=period)
        
        if data.empty:
            print(f"⚠️ yfinance 無法獲取 {symbol} 數據，嘗試其他數據源...")
            # 嘗試使用其他數據源
            return load_from_alternative_sources(symbol, period)
        
        # 轉換為標準格式
        data.reset_index(inplace=True)
        data.columns = data.columns.str.lower()
        
        print(f"✅ 成功載入 {len(data)} 條記錄")
        return data
        
    except Exception as e:
        print(f"❌ yfinance 載入失敗: {e}")
        # 回退到其他數據源
        return load_from_alternative_sources(symbol, period)

def load_from_alternative_sources(symbol, period):
    """
    從其他數據源載入數據
    
    Args:
        symbol: 股票代號
        period: 時間週期
        
    Returns:
        DataFrame: 股票數據
    """
    try:
        # 嘗試使用 Alpha Vantage
        print(f"🔍 嘗試 Alpha Vantage API...")
        import requests
        import os
        
        api_key = os.getenv('ALPHA_VANTAGE_KEY', '')
        if api_key:
            url = f"https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={symbol}&apikey={api_key}&outputsize=full"
            response = requests.get(url)
            data = response.json()
            
            if 'Time Series (Daily)' in data:
                time_series = data['Time Series (Daily)']
                df_data = []
                for date, values in time_series.items():
                    df_data.append({
                        'date': pd.to_datetime(date),
                        'open': float(values['1. open']),
                        'high': float(values['2. high']),
                        'low': float(values['3. low']),
                        'close': float(values['4. close']),
                        'volume': int(values['5. volume'])
                    })
                
                df = pd.DataFrame(df_data)
                df.set_index('date', inplace=True)
                df.columns = df.columns.str.lower()
                print(f"✅ Alpha Vantage: 載入 {len(df)} 條記錄")
                return df
        
        print("⚠️ 所有數據源都失敗，使用模擬數據")
        return generate_simulated_data(symbol, period)
        
    except Exception as e:
        print(f"❌ 替代數據源失敗: {e}")
        return generate_simulated_data(symbol, period)

def generate_simulated_data(symbol, period):
    """
    生成模擬數據
    
    Args:
        symbol: 股票代號
        period: 時間週期
        
    Returns:
        DataFrame: 模擬股票數據
    """
    print(f"🎲 生成 {symbol} 的模擬數據...")
    
    # 計算天數
    days = 365 if period == '1y' else 730 if period == '2y' else 180 if period == '6m' else 365
    
    # 生成模擬數據
    dates = pd.date_range(end=pd.Timestamp.now(), periods=days, freq='D')
    base_price = 100 + hash(symbol) % 50  # 基於股票代號生成基礎價格
    
    data = []
    current_price = base_price
    
    for i, date in enumerate(dates):
        # 模擬價格變動
        change = (hash(f"{symbol}{date}") % 100 - 50) / 1000  # -5% 到 +5% 的變動
        current_price = current_price * (1 + change)
        
        # 生成 OHLC 數據
        open_price = current_price * (1 + (hash(f"{symbol}{date}open") % 20 - 10) / 1000)
        high_price = max(open_price, current_price) * (1 + abs(hash(f"{symbol}{date}high") % 10) / 1000)
        low_price = min(open_price, current_price) * (1 - abs(hash(f"{symbol}{date}low") % 10) / 1000)
        volume = 100000 + hash(f"{symbol}{date}vol") % 900000
        
        data.append({
            'date': date,
            'open': round(open_price, 2),
            'high': round(high_price, 2),
            'low': round(low_price, 2),
            'close': round(current_price, 2),
            'volume': volume
        })
    
    df = pd.DataFrame(data)
    df.set_index('date', inplace=True)
    df.columns = df.columns.str.lower()
    
    print(f"✅ 生成 {len(df)} 條模擬記錄")
    return df

def main():
    """主函數示例"""
    # 載入數據
    print("載入股票數據...")
    df = load_stock_data('AAPL', period='2y')
    if df is None:
        print("無法載入數據")
        return
    
    # 特徵工程
    print("創建特徵...")
    fe = FeatureEngineer()
    X, y, feature_names = fe.prepare_features(df, target_method='classification')
    
    # 分割數據
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    X_train, X_val, y_train, y_val = train_test_split(X_train, y_train, test_size=0.2, random_state=42)
    
    # 創建集成模型
    print("創建集成模型...")
    ensemble = EnsembleModel()
    
    # 添加多個模型
    ensemble.add_model('random_forest', RandomForestClassifier(n_estimators=100, random_state=42))
    ensemble.add_model('svm', SVC(probability=True, random_state=42))
    ensemble.add_model('logistic', LogisticRegression(random_state=42))
    ensemble.add_model('lstm', LSTMModel())
    
    # 訓練模型
    print("訓練模型...")
    ensemble.train_models(X_train, y_train, X_val, y_val)
    
    # 預測
    print("生成預測...")
    predictions = ensemble.predict(X_test)
    
    # 評估
    y_pred = (predictions > 0.5).astype(int)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"準確率: {accuracy:.4f}")
    
    # 創建交易策略
    print("創建交易策略...")
    strategy = TradingStrategy(ensemble)
    signals = strategy.generate_signals(X_test, df['close'].iloc[-len(X_test):].values)
    
    # 回測
    print("執行回測...")
    backtest_results = strategy.backtest_strategy(signals, df['close'].iloc[-len(X_test):].values)
    print(f"總回報: {backtest_results['total_return']:.4f}")
    print(f"總交易次數: {backtest_results['total_trades']}")

if __name__ == "__main__":
    main()
