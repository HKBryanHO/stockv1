#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
測試富途 API 集成
"""

import sys
import json
from futu_api_integration import FutuAPIManager

def test_futu_connection():
    """測試富途 API 連接"""
    print("🔗 測試富途 API 連接...")
    
    manager = FutuAPIManager()
    
    # 測試連接（需要真實的用戶名和密碼）
    print("請輸入富途賬戶信息：")
    username = input("用戶名: ").strip()
    password = input("密碼: ").strip()
    
    if not username or not password:
        print("❌ 用戶名和密碼不能為空")
        return False
    
    try:
        result = manager.connect(username, password)
        if result.get('success'):
            print("✅ 富途 API 連接成功")
            return True
        else:
            print(f"❌ 富途 API 連接失敗: {result.get('error')}")
            return False
    except Exception as e:
        print(f"❌ 連接異常: {e}")
        return False

def test_historical_data():
    """測試歷史數據獲取"""
    print("\n📊 測試歷史數據獲取...")
    
    manager = FutuAPIManager()
    
    # 測試港股騰訊
    symbol = "HK.00700"
    start_date = "2023-01-01"
    end_date = "2024-01-01"
    
    try:
        result = manager.get_historical_data(symbol, start_date, end_date)
        if result.get('success'):
            data = result.get('data', [])
            print(f"✅ 成功獲取 {symbol} 歷史數據: {len(data)} 條記錄")
            if data:
                print(f"   最新價格: {data[-1]['close']}")
                print(f"   日期範圍: {data[0]['date']} 到 {data[-1]['date']}")
            return True
        else:
            print(f"❌ 獲取歷史數據失敗: {result.get('error')}")
            return False
    except Exception as e:
        print(f"❌ 歷史數據獲取異常: {e}")
        return False

def test_realtime_quote():
    """測試實時行情獲取"""
    print("\n📈 測試實時行情獲取...")
    
    manager = FutuAPIManager()
    
    # 測試港股騰訊
    symbol = "HK.00700"
    
    try:
        result = manager.get_realtime_quote([symbol])
        if result:
            print(f"✅ 成功獲取 {symbol} 實時行情")
            print(f"   數據: {result}")
            return True
        else:
            print(f"❌ 獲取實時行情失敗")
            return False
    except Exception as e:
        print(f"❌ 實時行情獲取異常: {e}")
        return False

def test_stock_basic_info():
    """測試股票基本信息獲取"""
    print("\n📋 測試股票基本信息獲取...")
    
    manager = FutuAPIManager()
    
    # 測試多個股票
    symbols = ["HK.00700", "US.AAPL", "SH.600036"]
    
    try:
        result = manager.get_stock_basic_info(symbols)
        if result.get('success'):
            data = result.get('data', [])
            print(f"✅ 成功獲取股票基本信息: {len(data)} 個股票")
            for stock in data:
                print(f"   {stock.get('code', 'N/A')}: {stock.get('name', 'N/A')}")
            return True
        else:
            print(f"❌ 獲取股票基本信息失敗: {result.get('error')}")
            return False
    except Exception as e:
        print(f"❌ 股票基本信息獲取異常: {e}")
        return False

def main():
    """主測試函數"""
    print("🚀 富途 API 集成測試")
    print("=" * 50)
    
    # 測試連接
    if not test_futu_connection():
        print("\n❌ 連接測試失敗，無法繼續其他測試")
        return
    
    # 測試歷史數據
    test_historical_data()
    
    # 測試實時行情
    test_realtime_quote()
    
    # 測試股票基本信息
    test_stock_basic_info()
    
    print("\n🎉 測試完成！")
    print("\n📝 注意事項：")
    print("1. 確保富途 OpenD 正在運行")
    print("2. 確保網絡連接正常")
    print("3. 確保富途賬戶有效")

if __name__ == "__main__":
    main()
