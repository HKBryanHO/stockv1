#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
金融數據源模組
使用 Polygon.io、Finnhub、FMP 作為主要數據源
"""

const https = require('https');
const http = require('http');

class FinancialDataSources {
    constructor() {
        this.apiKeys = {
            polygon: process.env.POLYGON_API_KEY || '',
            finnhub: process.env.FINNHUB_API_KEY || '',
            fmp: process.env.FMP_API_KEY || ''
        };
        
        this.baseUrls = {
            polygon: 'https://api.polygon.io',
            finnhub: 'https://finnhub.io/api/v1',
            fmp: 'https://financialmodelingprep.com/api/v3'
        };
    }
    
    /**
     * 獲取歷史數據 - 優先使用 FMP，然後 Polygon，最後 Finnhub
     */
    async getHistoricalData(symbol, days = 365) {
        console.log(`📊 獲取 ${symbol} 的歷史數據 (${days} 天)`);
        
        // 1. 嘗試 FMP API (最可靠)
        if (this.apiKeys.fmp) {
            try {
                console.log('🔍 嘗試 FMP API...');
                const data = await this.fetchFromFMP(symbol, days);
                if (data && data.length > 0) {
                    console.log(`✅ FMP: 獲取到 ${data.length} 條記錄`);
                    return {
                        success: true,
                        data: data,
                        source: 'FMP',
                        symbol: symbol,
                        count: data.length
                    };
                }
            } catch (error) {
                console.warn('FMP API 失敗:', error.message);
            }
        }
        
        // 2. 嘗試 Polygon API
        if (this.apiKeys.polygon) {
            try {
                console.log('🔍 嘗試 Polygon API...');
                const data = await this.fetchFromPolygon(symbol, days);
                if (data && data.length > 0) {
                    console.log(`✅ Polygon: 獲取到 ${data.length} 條記錄`);
                    return {
                        success: true,
                        data: data,
                        source: 'Polygon',
                        symbol: symbol,
                        count: data.length
                    };
                }
            } catch (error) {
                console.warn('Polygon API 失敗:', error.message);
            }
        }
        
        // 3. 嘗試 Finnhub API
        if (this.apiKeys.finnhub) {
            try {
                console.log('🔍 嘗試 Finnhub API...');
                const data = await this.fetchFromFinnhub(symbol, days);
                if (data && data.length > 0) {
                    console.log(`✅ Finnhub: 獲取到 ${data.length} 條記錄`);
                    return {
                        success: true,
                        data: data,
                        source: 'Finnhub',
                        symbol: symbol,
                        count: data.length
                    };
                }
            } catch (error) {
                console.warn('Finnhub API 失敗:', error.message);
            }
        }
        
        // 4. 所有 API 都失敗，返回模擬數據
        console.log('⚠️ 所有 API 都失敗，使用模擬數據');
        return {
            success: true,
            data: this.generateSimulatedData(symbol, days),
            source: 'Simulated',
            symbol: symbol,
            count: days,
            warning: '所有數據源都不可用，使用模擬數據'
        };
    }
    
    /**
     * 獲取實時數據 - 優先使用 Finnhub，然後 Polygon
     */
    async getRealtimeData(symbol) {
        console.log(`📈 獲取 ${symbol} 的實時數據`);
        
        // 1. 嘗試 Finnhub API (實時數據最好)
        if (this.apiKeys.finnhub) {
            try {
                console.log('🔍 嘗試 Finnhub API...');
                const data = await this.fetchRealtimeFromFinnhub(symbol);
                if (data && data.price) {
                    console.log(`✅ Finnhub: 獲取到實時價格 ${data.price}`);
                    return {
                        success: true,
                        data: data,
                        source: 'Finnhub'
                    };
                }
            } catch (error) {
                console.warn('Finnhub API 失敗:', error.message);
            }
        }
        
        // 2. 嘗試 Polygon API
        if (this.apiKeys.polygon) {
            try {
                console.log('🔍 嘗試 Polygon API...');
                const data = await this.fetchRealtimeFromPolygon(symbol);
                if (data && data.price) {
                    console.log(`✅ Polygon: 獲取到實時價格 ${data.price}`);
                    return {
                        success: true,
                        data: data,
                        source: 'Polygon'
                    };
                }
            } catch (error) {
                console.warn('Polygon API 失敗:', error.message);
            }
        }
        
        // 3. 所有 API 都失敗，返回模擬數據
        console.log('⚠️ 所有 API 都失敗，使用模擬數據');
        return {
            success: true,
            data: this.generateSimulatedRealtimeData(symbol),
            source: 'Simulated',
            warning: '所有數據源都不可用，使用模擬數據'
        };
    }
    
    /**
     * 從 FMP 獲取歷史數據
     */
    async fetchFromFMP(symbol, days) {
        const url = `${this.baseUrls.fmp}/historical-price-full/${encodeURIComponent(symbol)}?apikey=${this.apiKeys.fmp}`;
        const response = await this.makeRequest(url);
        const data = JSON.parse(response);
        
        if (data && data.historical && Array.isArray(data.historical)) {
            return data.historical.slice(0, days).reverse().map(item => ({
                date: item.date,
                open: parseFloat(item.open),
                high: parseFloat(item.high),
                low: parseFloat(item.low),
                close: parseFloat(item.close),
                volume: parseFloat(item.volume)
            }));
        }
        return null;
    }
    
    /**
     * 從 Polygon 獲取歷史數據
     */
    async fetchFromPolygon(symbol, days) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const url = `${this.baseUrls.polygon}/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${startDate.toISOString().split('T')[0]}/${endDate.toISOString().split('T')[0]}?apikey=${this.apiKeys.polygon}`;
        const response = await this.makeRequest(url);
        const data = JSON.parse(response);
        
        if (data && data.results && Array.isArray(data.results)) {
            return data.results.map(item => ({
                date: new Date(item.t).toISOString().split('T')[0],
                open: item.o,
                high: item.h,
                low: item.l,
                close: item.c,
                volume: item.v
            }));
        }
        return null;
    }
    
    /**
     * 從 Finnhub 獲取歷史數據
     */
    async fetchFromFinnhub(symbol, days) {
        const endTimestamp = Math.floor(Date.now() / 1000);
        const startTimestamp = endTimestamp - (days * 24 * 60 * 60);
        
        const url = `${this.baseUrls.finnhub}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${startTimestamp}&to=${endTimestamp}&token=${this.apiKeys.finnhub}`;
        const response = await this.makeRequest(url);
        const data = JSON.parse(response);
        
        if (data && data.s === 'ok' && data.c && data.c.length > 0) {
            const result = [];
            for (let i = 0; i < data.c.length; i++) {
                result.push({
                    date: new Date(data.t[i] * 1000).toISOString().split('T')[0],
                    open: data.o[i],
                    high: data.h[i],
                    low: data.l[i],
                    close: data.c[i],
                    volume: data.v[i]
                });
            }
            return result;
        }
        return null;
    }
    
    /**
     * 從 Finnhub 獲取實時數據
     */
    async fetchRealtimeFromFinnhub(symbol) {
        const url = `${this.baseUrls.finnhub}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.apiKeys.finnhub}`;
        const response = await this.makeRequest(url);
        const data = JSON.parse(response);
        
        if (data && data.c) {
            return {
                symbol: symbol,
                price: data.c,
                open: data.o,
                high: data.h,
                low: data.l,
                previousClose: data.pc,
                change: data.d,
                changePercent: data.dp,
                timestamp: new Date().toISOString()
            };
        }
        return null;
    }
    
    /**
     * 從 Polygon 獲取實時數據
     */
    async fetchRealtimeFromPolygon(symbol) {
        const url = `${this.baseUrls.polygon}/v2/last/trade/${encodeURIComponent(symbol)}?apikey=${this.apiKeys.polygon}`;
        const response = await this.makeRequest(url);
        const data = JSON.parse(response);
        
        if (data && data.results && data.results.p) {
            return {
                symbol: symbol,
                price: data.results.p,
                timestamp: new Date(data.results.t).toISOString()
            };
        }
        return null;
    }
    
    /**
     * 發送 HTTP 請求
     */
    makeRequest(url) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https:') ? https : http;
            
            protocol.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve(data);
                });
            }).on('error', (err) => {
                reject(err);
            });
        });
    }
    
    /**
     * 生成模擬歷史數據
     */
    generateSimulatedData(symbol, days) {
        const data = [];
        const basePrice = 100 + Math.random() * 50;
        let currentPrice = basePrice;
        
        for (let i = days; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            
            const change = (Math.random() - 0.5) * 0.1;
            currentPrice = currentPrice * (1 + change);
            
            const open = currentPrice * (1 + (Math.random() - 0.5) * 0.02);
            const high = Math.max(open, currentPrice) * (1 + Math.random() * 0.02);
            const low = Math.min(open, currentPrice) * (1 - Math.random() * 0.02);
            const volume = Math.floor(Math.random() * 1000000) + 100000;
            
            data.push({
                date: date.toISOString().split('T')[0],
                open: parseFloat(open.toFixed(2)),
                high: parseFloat(high.toFixed(2)),
                low: parseFloat(low.toFixed(2)),
                close: parseFloat(currentPrice.toFixed(2)),
                volume: volume
            });
        }
        
        return data;
    }
    
    /**
     * 生成模擬實時數據
     */
    generateSimulatedRealtimeData(symbol) {
        const basePrice = 100 + Math.random() * 50;
        const change = (Math.random() - 0.5) * 0.1;
        const currentPrice = basePrice * (1 + change);
        
        return {
            symbol: symbol,
            price: parseFloat(currentPrice.toFixed(2)),
            open: parseFloat((basePrice * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2)),
            high: parseFloat((currentPrice * (1 + Math.random() * 0.02)).toFixed(2)),
            low: parseFloat((currentPrice * (1 - Math.random() * 0.02)).toFixed(2)),
            previousClose: parseFloat(basePrice.toFixed(2)),
            change: parseFloat((change * 100).toFixed(2)),
            changePercent: parseFloat((change * 100).toFixed(2)),
            volume: Math.floor(Math.random() * 1000000) + 100000,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = FinancialDataSources;
