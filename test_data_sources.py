#!/usr/bin/env python3
"""
Financial Data Sources Test
"""

import yfinance as yf
import pandas as pd

def test_yfinance():
    """Test yfinance data source"""
    print("Testing yfinance data source...")
    
    try:
        # Test AAPL data
        ticker = yf.Ticker("AAPL")
        data = ticker.history(period="1mo")
        
        if not data.empty:
            print(f"  [OK] yfinance: Successfully retrieved {len(data)} records")
            print(f"  Latest price: ${data['Close'].iloc[-1]:.2f}")
            return True
        else:
            print("  [FAIL] yfinance: No data returned")
            return False
            
    except Exception as e:
        print(f"  [ERROR] yfinance: Error - {e}")
        return False

def test_multiple_symbols():
    """Test multiple stock data retrieval"""
    print("Testing multiple stock data retrieval...")
    
    symbols = ['AAPL', 'MSFT', 'GOOGL']
    results = {}
    
    for symbol in symbols:
        try:
            print(f"  Getting {symbol} data...")
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="1mo")
            
            if not data.empty:
                latest_price = data['Close'].iloc[-1]
                results[symbol] = {
                    'success': True,
                    'price': latest_price,
                    'records': len(data)
                }
                print(f"    [OK] {symbol}: ${latest_price:.2f} ({len(data)} records)")
            else:
                results[symbol] = {'success': False, 'error': 'No data'}
                print(f"    [FAIL] {symbol}: No data")
                
        except Exception as e:
            results[symbol] = {'success': False, 'error': str(e)}
            print(f"    [ERROR] {symbol}: Error - {e}")
    
    successful = sum(1 for r in results.values() if r['success'])
    print(f"\nMulti-stock test results: {successful}/{len(symbols)} successful")
    return results

def main():
    """Main function"""
    print("Financial Data Sources Test Tool\n")
    
    # Test yfinance
    print("=" * 50)
    yfinance_success = test_yfinance()
    
    print("\n" + "=" * 50)
    multi_results = test_multiple_symbols()
    
    # Summary
    print("\n" + "=" * 50)
    print("Test Summary:")
    print(f"  yfinance: {'[OK] Available' if yfinance_success else '[FAIL] Not available'}")
    
    if yfinance_success:
        print("\nMain data source (yfinance) is working!")
        print("Recommendation: You can start using the trading system")
    else:
        print("\nMain data source is not available, will use simulated data")
        print("Recommendation: Check network connection")

if __name__ == "__main__":
    main()
