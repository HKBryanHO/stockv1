#!/usr/bin/env python3
"""
測試 API Keys 配置
"""

import requests
import json

# 您提供的 API Keys
API_KEYS = {
    'fmp': 'Pp5qwzCD9YinmB3vd2a5cJEA967BqxBt',
    'finnhub': 'd38fgr1r01qlbdj58hqgd38fgr1r01qlbdj58hr0',
    'polygon': 'mAXs9GUK8uhrfrLlFRcJzV72xmJBupJt'
}

def test_fmp():
    print('🔍 測試 FMP API...')
    try:
        url = f"https://financialmodelingprep.com/api/v3/quote/AAPL?apikey={API_KEYS['fmp']}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                print('✅ FMP API 工作正常:', data[0])
                return True
            else:
                print('❌ FMP API 返回空數據:', data)
                return False
        else:
            print(f'❌ FMP API HTTP 錯誤: {response.status_code}')
            return False
    except Exception as error:
        print(f'❌ FMP API 錯誤: {error}')
        return False

def test_finnhub():
    print('🔍 測試 Finnhub API...')
    try:
        url = f"https://finnhub.io/api/v1/quote?symbol=AAPL&token={API_KEYS['finnhub']}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data and 'c' in data:
                print('✅ Finnhub API 工作正常:', data)
                return True
            else:
                print('❌ Finnhub API 返回空數據:', data)
                return False
        else:
            print(f'❌ Finnhub API HTTP 錯誤: {response.status_code}')
            return False
    except Exception as error:
        print(f'❌ Finnhub API 錯誤: {error}')
        return False

def test_polygon():
    print('🔍 測試 Polygon API...')
    try:
        url = f"https://api.polygon.io/v2/aggs/ticker/AAPL/prev?adjusted=true&apikey={API_KEYS['polygon']}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data and 'results' in data:
                print('✅ Polygon API 工作正常:', data['results'])
                return True
            else:
                print('❌ Polygon API 返回空數據:', data)
                return False
        else:
            print(f'❌ Polygon API HTTP 錯誤: {response.status_code}')
            return False
    except Exception as error:
        print(f'❌ Polygon API 錯誤: {error}')
        return False

def main():
    print('🚀 開始測試 API Keys...\n')
    
    results = {
        'fmp': test_fmp(),
        'finnhub': test_finnhub(),
        'polygon': test_polygon()
    }
    
    print('\n📊 測試結果:')
    print(f"FMP: {'✅ 正常' if results['fmp'] else '❌ 失敗'}")
    print(f"Finnhub: {'✅ 正常' if results['finnhub'] else '❌ 失敗'}")
    print(f"Polygon: {'✅ 正常' if results['polygon'] else '❌ 失敗'}")
    
    working_apis = sum(results.values())
    print(f'\n🎯 總計: {working_apis}/3 個 API 正常工作')
    
    if working_apis == 0:
        print('⚠️ 所有 API 都失敗，可能的原因:')
        print('1. API Keys 無效或過期')
        print('2. 網絡連接問題')
        print('3. API 服務暫時不可用')
    elif working_apis < 3:
        print('⚠️ 部分 API 失敗，但系統應該能正常工作')
    else:
        print('🎉 所有 API 都正常工作！')

if __name__ == '__main__':
    main()
