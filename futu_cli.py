#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
富途 API 命令行接口
用於測試和調用富途 OpenAPI 功能
"""

import sys
import json
import argparse
from futu_api_integration import FutuAPIManager, FutuTradingBot

def main():
    parser = argparse.ArgumentParser(description='富途 API 命令行接口')
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    # 連接命令
    connect_parser = subparsers.add_parser('connect', help='連接到富途 API')
    connect_parser.add_argument('username', help='富途賬號')
    connect_parser.add_argument('password', help='密碼')
    connect_parser.add_argument('--host', default='127.0.0.1', help='OpenD 主機地址')
    connect_parser.add_argument('--port', type=int, default=11111, help='OpenD 端口')
    
    # 行情命令
    quote_parser = subparsers.add_parser('quote', help='獲取實時行情')
    quote_parser.add_argument('symbol', help='股票代碼')
    
    # 下單命令
    order_parser = subparsers.add_parser('order', help='下單')
    order_parser.add_argument('symbol', help='股票代碼')
    order_parser.add_argument('price', type=float, help='價格')
    order_parser.add_argument('quantity', type=int, help='數量')
    order_parser.add_argument('side', choices=['BUY', 'SELL'], help='交易方向')
    order_parser.add_argument('--order-type', default='NORMAL', help='訂單類型')
    order_parser.add_argument('--env', default='SIMULATE', choices=['SIMULATE', 'REAL'], help='交易環境')
    
    # 持倉命令
    positions_parser = subparsers.add_parser('positions', help='查詢持倉')
    positions_parser.add_argument('--env', default='SIMULATE', choices=['SIMULATE', 'REAL'], help='交易環境')
    
    # 訂單命令
    orders_parser = subparsers.add_parser('orders', help='查詢訂單')
    orders_parser.add_argument('--env', default='SIMULATE', choices=['SIMULATE', 'REAL'], help='交易環境')
    
    # 歷史數據命令
    history_parser = subparsers.add_parser('history', help='獲取歷史數據')
    history_parser.add_argument('symbol', help='股票代碼')
    history_parser.add_argument('--start', required=True, help='開始日期 (YYYY-MM-DD)')
    history_parser.add_argument('--end', required=True, help='結束日期 (YYYY-MM-DD)')
    history_parser.add_argument('--ktype', default='K_DAY', help='K線類型')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # 創建 API 管理器
    api_manager = FutuAPIManager(host=args.host, port=args.port)
    
    try:
        if args.command == 'connect':
            success = api_manager.connect(args.username, args.password)
            if success:
                print(json.dumps({"success": True, "message": "連接成功"}))
            else:
                print(json.dumps({"success": False, "error": "連接失敗"}))
                sys.exit(1)
        
        elif args.command == 'quote':
            quotes = api_manager.get_realtime_quote([args.symbol])
            if quotes:
                print(json.dumps(quotes[0], ensure_ascii=False, indent=2))
            else:
                print(json.dumps({"error": "獲取行情失敗"}))
                sys.exit(1)
        
        elif args.command == 'order':
            # 轉換交易方向
            from futu import TrdSide
            trd_side = TrdSide.BUY if args.side == 'BUY' else TrdSide.SELL
            
            # 轉換訂單類型
            from futu import OrderType
            order_type = getattr(OrderType, args.order_type, OrderType.NORMAL)
            
            # 轉換交易環境
            from futu import TrdEnv
            trd_env = getattr(TrdEnv, args.env, TrdEnv.SIMULATE)
            
            result = api_manager.place_order(
                stock_code=args.symbol,
                price=args.price,
                qty=args.quantity,
                trd_side=trd_side,
                order_type=order_type,
                trd_env=trd_env
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
        elif args.command == 'positions':
            # 轉換交易環境
            from futu import TrdEnv
            trd_env = getattr(TrdEnv, args.env, TrdEnv.SIMULATE)
            
            positions = api_manager.get_position_list(trd_env=trd_env)
            print(json.dumps(positions, ensure_ascii=False, indent=2, default=str))
        
        elif args.command == 'orders':
            # 轉換交易環境
            from futu import TrdEnv
            trd_env = getattr(TrdEnv, args.env, TrdEnv.SIMULATE)
            
            orders = api_manager.get_order_list(trd_env=trd_env)
            print(json.dumps(orders, ensure_ascii=False, indent=2, default=str))
        
        elif args.command == 'history':
            # 轉換K線類型
            from futu import KLType
            ktype = getattr(KLType, args.ktype, KLType.K_DAY)
            
            data = api_manager.get_historical_kl_data(
                stock_code=args.symbol,
                start_date=args.start,
                end_date=args.end,
                ktype=ktype
            )
            print(json.dumps(data.to_dict('records'), ensure_ascii=False, indent=2, default=str))
    
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
    
    finally:
        api_manager.disconnect()

if __name__ == '__main__':
    main()
