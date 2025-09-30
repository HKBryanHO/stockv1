#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
富途 OpenAPI 整合模組
支持港股、美股、A股等多市場的實時行情和自動交易
"""

import futu as ft
import pandas as pd
import json
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import threading
import queue

# 配置日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FutuAPIManager:
    """富途 API 管理器"""
    
    def __init__(self, host='127.0.0.1', port=11111, security_firm=ft.SecurityFirm.FUTUSECURITIES):
        """
        初始化富途 API 管理器
        
        Args:
            host: OpenD 網關地址
            port: OpenD 網關端口
            security_firm: 券商類型
        """
        self.host = host
        self.port = port
        self.security_firm = security_firm
        
        # API 連接對象
        self.quote_ctx = None
        self.trade_ctx = None
        
        # 連接狀態
        self.is_connected = False
        self.is_trading_connected = False
        
        # 實時數據緩存
        self.realtime_data = {}
        self.subscribed_stocks = set()
        
        # 回調函數
        self.quote_callback = None
        self.trade_callback = None
        
    def connect(self, username: str, password: str, is_encrypt: bool = True) -> bool:
        """
        連接到富途 OpenD 網關
        
        Args:
            username: 富途賬號
            password: 密碼
            is_encrypt: 是否加密
            
        Returns:
            bool: 連接是否成功
        """
        try:
            # 創建行情連接
            self.quote_ctx = ft.OpenQuoteContext(host=self.host, port=self.port, security_firm=self.security_firm)
            
            # 創建交易連接
            self.trade_ctx = ft.OpenSecTradeContext(
                host=self.host, 
                port=self.port, 
                security_firm=self.security_firm,
                is_encrypt=is_encrypt
            )
            
            # 登入交易賬戶
            ret, data = self.trade_ctx.unlock_trade(password=password)
            if ret != ft.RET_OK:
                logger.error(f"交易賬戶解鎖失敗: {data}")
                return False
            
            # 登入行情賬戶
            ret, data = self.quote_ctx.unlock_trade(password=password)
            if ret != ft.RET_OK:
                logger.error(f"行情賬戶解鎖失敗: {data}")
                return False
            
            self.is_connected = True
            self.is_trading_connected = True
            
            logger.info("富途 API 連接成功")
            return True
            
        except Exception as e:
            logger.error(f"富途 API 連接失敗: {e}")
            return False
    
    def disconnect(self):
        """斷開連接"""
        try:
            if self.quote_ctx:
                self.quote_ctx.close()
            if self.trade_ctx:
                self.trade_ctx.close()
            
            self.is_connected = False
            self.is_trading_connected = False
            logger.info("富途 API 已斷開")
            
        except Exception as e:
            logger.error(f"斷開連接時出錯: {e}")
    
    def get_market_snapshot(self, stock_codes: List[str]) -> Dict:
        """
        獲取市場快照
        
        Args:
            stock_codes: 股票代碼列表
            
        Returns:
            Dict: 市場快照數據
        """
        if not self.is_connected:
            return {}
        
        try:
            ret, data = self.quote_ctx.get_market_snapshot(stock_codes)
            if ret == ft.RET_OK:
                return data.to_dict('records')
            else:
                logger.error(f"獲取市場快照失敗: {data}")
                return {}
        except Exception as e:
            logger.error(f"獲取市場快照異常: {e}")
            return {}
    
    def get_historical_kl_data(self, stock_code: str, start_date: str, end_date: str, 
                              ktype: ft.KLType = ft.KLType.K_DAY) -> pd.DataFrame:
        """
        獲取歷史K線數據
        
        Args:
            stock_code: 股票代碼
            start_date: 開始日期 (YYYY-MM-DD)
            end_date: 結束日期 (YYYY-MM-DD)
            ktype: K線類型
            
        Returns:
            pd.DataFrame: 歷史K線數據
        """
        if not self.is_connected:
            return pd.DataFrame()
        
        try:
            ret, data = self.quote_ctx.get_cur_kline(
                stock_code=stock_code,
                num=1000,  # 獲取最近1000根K線
                ktype=ktype
            )
            
            if ret == ft.RET_OK:
                # 過濾日期範圍
                data['date'] = pd.to_datetime(data['time_key'])
                filtered_data = data[
                    (data['date'] >= start_date) & 
                    (data['date'] <= end_date)
                ]
                return filtered_data
            else:
                logger.error(f"獲取歷史K線失敗: {data}")
                return pd.DataFrame()
                
        except Exception as e:
            logger.error(f"獲取歷史K線異常: {e}")
            return pd.DataFrame()
    
    def get_realtime_quote(self, stock_codes: List[str]) -> Dict:
        """
        獲取實時報價
        
        Args:
            stock_codes: 股票代碼列表
            
        Returns:
            Dict: 實時報價數據
        """
        if not self.is_connected:
            return {}
        
        try:
            ret, data = self.quote_ctx.get_market_snapshot(stock_codes)
            if ret == ft.RET_OK:
                return data.to_dict('records')
            else:
                logger.error(f"獲取實時報價失敗: {data}")
                return {}
        except Exception as e:
            logger.error(f"獲取實時報價異常: {e}")
            return {}
    
    def subscribe_realtime_quote(self, stock_codes: List[str], callback_func=None):
        """
        訂閱實時報價
        
        Args:
            stock_codes: 股票代碼列表
            callback_func: 回調函數
        """
        if not self.is_connected:
            return False
        
        try:
            # 設置回調函數
            if callback_func:
                self.quote_callback = callback_func
                ret, err = self.quote_ctx.set_handler(ft.RevHandler.cur_kline, callback_func)
                if ret != ft.RET_OK:
                    logger.error(f"設置回調函數失敗: {err}")
                    return False
            
            # 訂閱股票
            for stock_code in stock_codes:
                ret, err = self.quote_ctx.subscribe(stock_code, [ft.SubType.QUOTE])
                if ret == ft.RET_OK:
                    self.subscribed_stocks.add(stock_code)
                    logger.info(f"成功訂閱 {stock_code}")
                else:
                    logger.error(f"訂閱 {stock_code} 失敗: {err}")
            
            return True
            
        except Exception as e:
            logger.error(f"訂閱實時報價異常: {e}")
            return False
    
    def place_order(self, stock_code: str, price: float, qty: int, 
                   trd_side: ft.TrdSide, order_type: ft.OrderType = ft.OrderType.NORMAL,
                   trd_env: ft.TrdEnv = ft.TrdEnv.SIMULATE) -> Dict:
        """
        下單
        
        Args:
            stock_code: 股票代碼
            price: 價格
            qty: 數量
            trd_side: 交易方向 (BUY/SELL)
            order_type: 訂單類型
            trd_env: 交易環境 (SIMULATE/REAL)
            
        Returns:
            Dict: 下單結果
        """
        if not self.is_trading_connected:
            return {"success": False, "error": "交易連接未建立"}
        
        try:
            ret, data = self.trade_ctx.place_order(
                price=price,
                qty=qty,
                code=stock_code,
                trd_side=trd_side,
                order_type=order_type,
                trd_env=trd_env
            )
            
            if ret == ft.RET_OK:
                logger.info(f"下單成功: {stock_code} {trd_side} {qty}股 @ ${price}")
                return {
                    "success": True,
                    "order_id": data,
                    "stock_code": stock_code,
                    "side": trd_side,
                    "qty": qty,
                    "price": price
                }
            else:
                logger.error(f"下單失敗: {data}")
                return {"success": False, "error": data}
                
        except Exception as e:
            logger.error(f"下單異常: {e}")
            return {"success": False, "error": str(e)}
    
    def get_position_list(self, trd_env: ft.TrdEnv = ft.TrdEnv.SIMULATE) -> List[Dict]:
        """
        獲取持倉列表
        
        Args:
            trd_env: 交易環境
            
        Returns:
            List[Dict]: 持倉列表
        """
        if not self.is_trading_connected:
            return []
        
        try:
            ret, data = self.trade_ctx.position_list_query(trd_env=trd_env)
            if ret == ft.RET_OK:
                return data.to_dict('records')
            else:
                logger.error(f"獲取持倉列表失敗: {data}")
                return []
        except Exception as e:
            logger.error(f"獲取持倉列表異常: {e}")
            return []
    
    def get_order_list(self, trd_env: ft.TrdEnv = ft.TrdEnv.SIMULATE) -> List[Dict]:
        """
        獲取訂單列表
        
        Args:
            trd_env: 交易環境
            
        Returns:
            List[Dict]: 訂單列表
        """
        if not self.is_trading_connected:
            return []
        
        try:
            ret, data = self.trade_ctx.order_list_query(trd_env=trd_env)
            if ret == ft.RET_OK:
                return data.to_dict('records')
            else:
                logger.error(f"獲取訂單列表失敗: {data}")
                return []
        except Exception as e:
            logger.error(f"獲取訂單列表異常: {e}")
            return []
    
    def cancel_order(self, order_id: str, trd_env: ft.TrdEnv = ft.TrdEnv.SIMULATE) -> bool:
        """
        撤銷訂單
        
        Args:
            order_id: 訂單ID
            trd_env: 交易環境
            
        Returns:
            bool: 撤銷是否成功
        """
        if not self.is_trading_connected:
            return False
        
        try:
            ret, data = self.trade_ctx.modify_order(
                modify_order_op=ft.ModifyOrderOp.CANCEL,
                order_id=order_id,
                trd_env=trd_env
            )
            
            if ret == ft.RET_OK:
                logger.info(f"撤銷訂單成功: {order_id}")
                return True
            else:
                logger.error(f"撤銷訂單失敗: {data}")
                return False
                
        except Exception as e:
            logger.error(f"撤銷訂單異常: {e}")
            return False

class FutuTradingBot:
    """富途自動交易機器人"""
    
    def __init__(self, api_manager: FutuAPIManager):
        """
        初始化交易機器人
        
        Args:
            api_manager: 富途 API 管理器
        """
        self.api = api_manager
        self.is_running = False
        self.trading_strategies = {}
        self.risk_management = RiskManager()
        
    def add_strategy(self, name: str, strategy_func):
        """
        添加交易策略
        
        Args:
            name: 策略名稱
            strategy_func: 策略函數
        """
        self.trading_strategies[name] = strategy_func
        logger.info(f"添加交易策略: {name}")
    
    def start_trading(self, symbols: List[str], interval: int = 5):
        """
        開始自動交易
        
        Args:
            symbols: 監控的股票列表
            interval: 檢查間隔（秒）
        """
        if not self.api.is_connected:
            logger.error("API 未連接，無法開始交易")
            return False
        
        self.is_running = True
        
        # 訂閱實時行情
        self.api.subscribe_realtime_quote(symbols, self._quote_callback)
        
        # 啟動交易循環
        trading_thread = threading.Thread(
            target=self._trading_loop, 
            args=(symbols, interval)
        )
        trading_thread.daemon = True
        trading_thread.start()
        
        logger.info(f"自動交易已啟動，監控股票: {symbols}")
        return True
    
    def stop_trading(self):
        """停止自動交易"""
        self.is_running = False
        logger.info("自動交易已停止")
    
    def _trading_loop(self, symbols: List[str], interval: int):
        """交易循環"""
        while self.is_running:
            try:
                # 獲取實時行情
                quotes = self.api.get_realtime_quote(symbols)
                
                for quote in quotes:
                    symbol = quote.get('code')
                    current_price = quote.get('cur_price', 0)
                    
                    # 執行交易策略
                    for strategy_name, strategy_func in self.trading_strategies.items():
                        try:
                            signal = strategy_func(symbol, current_price, quote)
                            if signal:
                                self._execute_signal(symbol, signal, current_price)
                        except Exception as e:
                            logger.error(f"策略 {strategy_name} 執行失敗: {e}")
                
                time.sleep(interval)
                
            except Exception as e:
                logger.error(f"交易循環異常: {e}")
                time.sleep(interval)
    
    def _quote_callback(self, quote_data):
        """行情回調函數"""
        try:
            # 處理實時行情數據
            for _, row in quote_data.iterrows():
                symbol = row['code']
                price = row['cur_price']
                
                # 更新實時數據緩存
                self.api.realtime_data[symbol] = {
                    'price': price,
                    'timestamp': datetime.now(),
                    'data': row.to_dict()
                }
                
        except Exception as e:
            logger.error(f"行情回調異常: {e}")
    
    def _execute_signal(self, symbol: str, signal: Dict, current_price: float):
        """
        執行交易信號
        
        Args:
            symbol: 股票代碼
            signal: 交易信號
            current_price: 當前價格
        """
        try:
            # 風險檢查
            if not self.risk_management.check_risk(symbol, signal):
                logger.warning(f"風險檢查未通過: {symbol}")
                return
            
            # 執行交易
            if signal['action'] == 'BUY':
                result = self.api.place_order(
                    stock_code=symbol,
                    price=current_price,
                    qty=signal['quantity'],
                    trd_side=ft.TrdSide.BUY,
                    trd_env=ft.TrdEnv.SIMULATE  # 使用模擬交易
                )
            elif signal['action'] == 'SELL':
                result = self.api.place_order(
                    stock_code=symbol,
                    price=current_price,
                    qty=signal['quantity'],
                    trd_side=ft.TrdSide.SELL,
                    trd_env=ft.TrdEnv.SIMULATE  # 使用模擬交易
                )
            
            if result.get('success'):
                logger.info(f"交易執行成功: {symbol} {signal['action']} {signal['quantity']}股")
            else:
                logger.error(f"交易執行失敗: {result.get('error')}")
                
        except Exception as e:
            logger.error(f"執行交易信號異常: {e}")

class RiskManager:
    """風險管理器"""
    
    def __init__(self):
        self.max_position_size = 10000  # 最大持倉金額
        self.max_daily_trades = 50     # 每日最大交易次數
        self.daily_trade_count = 0
        self.last_reset_date = datetime.now().date()
    
    def check_risk(self, symbol: str, signal: Dict) -> bool:
        """
        風險檢查
        
        Args:
            symbol: 股票代碼
            signal: 交易信號
            
        Returns:
            bool: 是否通過風險檢查
        """
        # 重置每日計數
        if datetime.now().date() != self.last_reset_date:
            self.daily_trade_count = 0
            self.last_reset_date = datetime.now().date()
        
        # 檢查每日交易次數
        if self.daily_trade_count >= self.max_daily_trades:
            logger.warning("達到每日最大交易次數限制")
            return False
        
        # 檢查持倉大小
        if signal.get('quantity', 0) * signal.get('price', 0) > self.max_position_size:
            logger.warning("超過最大持倉金額限制")
            return False
        
        return True

# 示例使用
if __name__ == "__main__":
    # 創建 API 管理器
    api_manager = FutuAPIManager()
    
    # 連接到富途（需要先啟動 OpenD）
    # success = api_manager.connect("your_username", "your_password")
    
    # 創建交易機器人
    # bot = FutuTradingBot(api_manager)
    
    # 添加交易策略
    # def simple_ma_strategy(symbol, price, quote_data):
    #     # 簡單移動平均策略示例
    #     return {"action": "BUY", "quantity": 100, "price": price}
    
    # bot.add_strategy("MA_Strategy", simple_ma_strategy)
    
    # 開始自動交易
    # bot.start_trading(["HK.00700", "US.AAPL"], interval=10)
    
    def get_historical_data(self, stock_code: str, start_date: str, end_date: str, ktype=ft.KLType.K_DAY) -> Dict:
        """
        獲取歷史K線數據
        
        Args:
            stock_code: 股票代碼
            start_date: 開始日期 (YYYY-MM-DD)
            end_date: 結束日期 (YYYY-MM-DD)
            ktype: K線類型
            
        Returns:
            Dict: 歷史K線數據
        """
        if not self.is_connected:
            return {"error": "未連接到富途 API"}
        
        try:
            # 獲取歷史K線
            ret, data = self.quote_ctx.get_cur_kline(
                stock_code, 
                1000,  # 獲取1000根K線
                ktype
            )
            if ret == ft.RET_OK:
                # 轉換為標準格式
                klines = []
                for _, row in data.iterrows():
                    klines.append({
                        'date': row['time_key'].strftime('%Y-%m-%d'),
                        'open': float(row['open']),
                        'high': float(row['high']),
                        'low': float(row['low']),
                        'close': float(row['close']),
                        'volume': int(row['volume']),
                        'turnover': float(row['turnover'])
                    })
                
                return {
                    "success": True,
                    "data": klines
                }
            else:
                return {
                    "success": False,
                    "error": data
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_stock_basic_info(self, stock_codes: List[str]) -> Dict:
        """
        獲取股票基本信息
        
        Args:
            stock_codes: 股票代碼列表
            
        Returns:
            Dict: 股票基本信息
        """
        if not self.is_connected:
            return {"error": "未連接到富途 API"}
        
        try:
            # 獲取股票基本信息
            ret, data = self.quote_ctx.get_stock_basicinfo(stock_codes)
            if ret == ft.RET_OK:
                return {
                    "success": True,
                    "data": data.to_dict('records')
                }
            else:
                return {
                    "success": False,
                    "error": data
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_market_cap(self, stock_codes: List[str]) -> Dict:
        """
        獲取市值信息
        
        Args:
            stock_codes: 股票代碼列表
            
        Returns:
            Dict: 市值信息
        """
        if not self.is_connected:
            return {"error": "未連接到富途 API"}
        
        try:
            # 獲取市值信息
            ret, data = self.quote_ctx.get_market_cap(stock_codes)
            if ret == ft.RET_OK:
                return {
                    "success": True,
                    "data": data.to_dict('records')
                }
            else:
                return {
                    "success": False,
                    "error": data
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    print("富途 API 整合模組已準備就緒")
