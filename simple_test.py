#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
簡單的金融數據源測試
"""

import yfinance as yf
import pandas as pd

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

def test_multiple_symbols():
    """測試多隻股票數據獲取"""
    print("測試多隻股票數據獲取...")
    
    symbols = ['AAPL', 'MSFT', 'GOOGL']
    results = {}
    
    for symbol in symbols:
        try:
            print(f"  獲取 {symbol} 數據...")
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="1mo")
            
            if not data.empty:
                latest_price = data['Close'].iloc[-1]
                results[symbol] = {
                    'success': True,
                    'price': latest_price,
                    'records': len(data)
                }
                print(f"    [OK] {symbol}: ${latest_price:.2f} ({len(data)} 條記錄)")
            else:
                results[symbol] = {'success': False, 'error': '無數據'}
                print(f"    [FAIL] {symbol}: 無數據")
                
        except Exception as e:
            results[symbol] = {'success': False, 'error': str(e)}
            print(f"    [ERROR] {symbol}: 錯誤 - {e}")
    
    successful = sum(1 for r in results.values() if r['success'])
    print(f"\n多股票測試結果: {successful}/{len(symbols)} 成功")
    return results

def main():
    """主函數"""
    print("金融數據源測試工具\n")
    
    # 測試 yfinance
    print("=" * 50)
    yfinance_success = test_yfinance()
    
    print("\n" + "=" * 50)
    multi_results = test_multiple_symbols()
    
    # 總結
    print("\n" + "=" * 50)
    print("測試總結:")
    print(f"  yfinance: {'[OK] 可用' if yfinance_success else '[FAIL] 不可用'}")
    
    if yfinance_success:
        print("\n主要數據源 (yfinance) 正常工作！")
        print("建議: 可以開始使用交易系統了")
    else:
        print("\n主要數據源不可用，將使用模擬數據")
        print("建議: 檢查網絡連接")

if __name__ == "__main__":
    main()
