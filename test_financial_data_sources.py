#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
測試金融數據源
驗證 yfinance、Alpha Vantage 等數據源是否正常工作
"""

import yfinance as yf
import pandas as pd
import requests
import os
import time
from datetime import datetime, timedelta

def test_yfinance():
    """測試 yfinance 數據源"""
    print("測試 yfinance 數據源...")
    
    try:
        # 測試獲取 AAPL 數據
        ticker = yf.Ticker("AAPL")
        data = ticker.history(period="1mo")
        
        if not data.empty:
            print(f"  [OK] yfinance: 成功獲取 {len(data)} 條記錄")
            print(f"  最新價格: ${data['Close'].iloc[-1]:.2f}")
            return True
        else:
            print("  [FAIL] yfinance: 無數據返回")
            return False
            
    except Exception as e:
        print(f"  [ERROR] yfinance: 錯誤 - {e}")
        return False

def test_alpha_vantage():
    """測試 Alpha Vantage 數據源"""
    print("📊 測試 Alpha Vantage 數據源...")
    
    api_key = os.getenv('ALPHA_VANTAGE_KEY', '')
    if not api_key:
        print("  ⚠️ Alpha Vantage: API Key 未配置")
        return False
    
    try:
        url = f"https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=AAPL&apikey={api_key}&outputsize=compact"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if 'Time Series (Daily)' in data:
            time_series = data['Time Series (Daily)']
            print(f"  ✅ Alpha Vantage: 成功獲取 {len(time_series)} 條記錄")
            
            # 獲取最新價格
            latest_date = max(time_series.keys())
            latest_price = time_series[latest_date]['4. close']
            print(f"  📈 最新價格: ${latest_price}")
            return True
        else:
            print(f"  ❌ Alpha Vantage: 無數據返回 - {data}")
            return False
            
    except Exception as e:
        print(f"  ❌ Alpha Vantage: 錯誤 - {e}")
        return False

def test_multiple_symbols():
    """測試多隻股票數據獲取"""
    print("📊 測試多隻股票數據獲取...")
    
    symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']
    results = {}
    
    for symbol in symbols:
        try:
            print(f"  📈 獲取 {symbol} 數據...")
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="1mo")
            
            if not data.empty:
                latest_price = data['Close'].iloc[-1]
                results[symbol] = {
                    'success': True,
                    'price': latest_price,
                    'records': len(data)
                }
                print(f"    ✅ {symbol}: ${latest_price:.2f} ({len(data)} 條記錄)")
            else:
                results[symbol] = {'success': False, 'error': '無數據'}
                print(f"    ❌ {symbol}: 無數據")
                
        except Exception as e:
            results[symbol] = {'success': False, 'error': str(e)}
            print(f"    ❌ {symbol}: 錯誤 - {e}")
        
        # 避免請求過於頻繁
        time.sleep(1)
    
    successful = sum(1 for r in results.values() if r['success'])
    print(f"\n📊 多股票測試結果: {successful}/{len(symbols)} 成功")
    return results

def test_historical_data():
    """測試歷史數據獲取"""
    print("📊 測試歷史數據獲取...")
    
    try:
        ticker = yf.Ticker("AAPL")
        
        # 測試不同時間範圍
        periods = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y']
        
        for period in periods:
            try:
                data = ticker.history(period=period)
                if not data.empty:
                    print(f"  ✅ {period}: {len(data)} 條記錄")
                else:
                    print(f"  ❌ {period}: 無數據")
            except Exception as e:
                print(f"  ❌ {period}: 錯誤 - {e}")
                
    except Exception as e:
        print(f"  ❌ 歷史數據測試失敗: {e}")

def test_real_time_data():
    """測試實時數據獲取"""
    print("📊 測試實時數據獲取...")
    
    try:
        ticker = yf.Ticker("AAPL")
        info = ticker.info
        
        if info and 'currentPrice' in info:
            current_price = info['currentPrice']
            print(f"  ✅ 實時價格: ${current_price}")
            return True
        else:
            print("  ❌ 無法獲取實時價格")
            return False
            
    except Exception as e:
        print(f"  ❌ 實時數據測試失敗: {e}")
        return False

def performance_test():
    """性能測試"""
    print("⚡ 性能測試...")
    
    symbols = ['AAPL', 'MSFT', 'GOOGL']
    iterations = 3
    
    start_time = time.time()
    results = []
    
    for i in range(iterations):
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                data = ticker.history(period="1mo")
                
                if not data.empty:
                    results.append({
                        'symbol': symbol,
                        'success': True,
                        'records': len(data)
                    })
                else:
                    results.append({
                        'symbol': symbol,
                        'success': False,
                        'error': '無數據'
                    })
                    
            except Exception as e:
                results.append({
                    'symbol': symbol,
                    'success': False,
                    'error': str(e)
                })
            
            # 避免請求過於頻繁
            time.sleep(0.5)
    
    total_time = time.time() - start_time
    successful = sum(1 for r in results if r['success'])
    
    print(f"  📊 總時間: {total_time:.2f} 秒")
    print(f"  📊 成功請求: {successful}/{len(results)}")
    print(f"  📊 平均響應時間: {total_time/len(results):.2f} 秒")
    print(f"  📊 成功率: {successful/len(results)*100:.1f}%")

def main():
    """主函數"""
    print("金融數據源測試工具\n")
    
    # 測試各個數據源
    print("=" * 50)
    yfinance_success = test_yfinance()
    
    print("\n" + "=" * 50)
    alpha_success = test_alpha_vantage()
    
    print("\n" + "=" * 50)
    multi_results = test_multiple_symbols()
    
    print("\n" + "=" * 50)
    test_historical_data()
    
    print("\n" + "=" * 50)
    realtime_success = test_real_time_data()
    
    print("\n" + "=" * 50)
    performance_test()
    
    # 總結
    print("\n" + "=" * 50)
    print("📊 測試總結:")
    print(f"  yfinance: {'✅ 可用' if yfinance_success else '❌ 不可用'}")
    print(f"  Alpha Vantage: {'✅ 可用' if alpha_success else '❌ 不可用'}")
    print(f"  實時數據: {'✅ 可用' if realtime_success else '❌ 不可用'}")
    
    if yfinance_success:
        print("\n🎉 主要數據源 (yfinance) 正常工作！")
        print("💡 建議: 可以開始使用交易系統了")
    else:
        print("\n⚠️ 主要數據源不可用，將使用模擬數據")
        print("💡 建議: 檢查網絡連接或配置 API 密鑰")

if __name__ == "__main__":
    main()
