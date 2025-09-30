#!/usr/bin/env python3
"""
測試 API Keys 配置 - 簡化版本
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
    print('Testing FMP API...')
    try:
        url = f"https://financialmodelingprep.com/api/v3/quote/AAPL?apikey={API_KEYS['fmp']}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                print('FMP API OK:', data[0])
                return True
            else:
                print('FMP API empty data:', data)
                return False
        else:
            print(f'FMP API HTTP error: {response.status_code}')
            return False
    except Exception as error:
        print(f'FMP API error: {error}')
        return False

def test_finnhub():
    print('Testing Finnhub API...')
    try:
        url = f"https://finnhub.io/api/v1/quote?symbol=AAPL&token={API_KEYS['finnhub']}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data and 'c' in data:
                print('Finnhub API OK:', data)
                return True
            else:
                print('Finnhub API empty data:', data)
                return False
        else:
            print(f'Finnhub API HTTP error: {response.status_code}')
            return False
    except Exception as error:
        print(f'Finnhub API error: {error}')
        return False

def test_polygon():
    print('Testing Polygon API...')
    try:
        url = f"https://api.polygon.io/v2/aggs/ticker/AAPL/prev?adjusted=true&apikey={API_KEYS['polygon']}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data and 'results' in data:
                print('Polygon API OK:', data['results'])
                return True
            else:
                print('Polygon API empty data:', data)
                return False
        else:
            print(f'Polygon API HTTP error: {response.status_code}')
            return False
    except Exception as error:
        print(f'Polygon API error: {error}')
        return False

def main():
    print('Starting API Keys test...\n')
    
    results = {
        'fmp': test_fmp(),
        'finnhub': test_finnhub(),
        'polygon': test_polygon()
    }
    
    print('\nTest Results:')
    print(f"FMP: {'OK' if results['fmp'] else 'FAILED'}")
    print(f"Finnhub: {'OK' if results['finnhub'] else 'FAILED'}")
    print(f"Polygon: {'OK' if results['polygon'] else 'FAILED'}")
    
    working_apis = sum(results.values())
    print(f'\nTotal: {working_apis}/3 APIs working')
    
    if working_apis == 0:
        print('All APIs failed - check keys and network')
    elif working_apis < 3:
        print('Some APIs failed but system should work')
    else:
        print('All APIs working!')

if __name__ == '__main__':
    main()
