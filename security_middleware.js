/**
 * 安全中間件
 * 包含身份驗證、授權、速率限制、安全頭等
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

class SecurityMiddleware {
    constructor() {
        this.setupSecurityHeaders();
        this.setupRateLimiting();
        this.setupCORS();
    }
    
    // 設置安全頭
    setupSecurityHeaders() {
        return helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "https://api.futunn.com", "https://finnhub.io"],
                    fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"]
                }
            },
            crossOriginEmbedderPolicy: false,
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            }
        });
    }
    
    // 設置速率限制
    setupRateLimiting() {
        // 全局速率限制
        this.globalRateLimit = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 分鐘
            max: 1000, // 限制每個 IP 1000 次請求
            message: '請求過於頻繁，請稍後再試',
            standardHeaders: true,
            legacyHeaders: false
        });
        
        // API 速率限制
        this.apiRateLimit = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 分鐘
            max: 100, // 限制每個 IP 100 次 API 請求
            message: 'API 請求過於頻繁，請稍後再試',
            standardHeaders: true,
            legacyHeaders: false
        });
        
        // 登錄速率限制
        this.loginRateLimit = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 分鐘
            max: 5, // 限制每個 IP 5 次登錄嘗試
            message: '登錄嘗試過於頻繁，請稍後再試',
            standardHeaders: true,
            legacyHeaders: false
        });
        
        // 交易速率限制
        this.tradingRateLimit = rateLimit({
            windowMs: 60 * 1000, // 1 分鐘
            max: 10, // 限制每個用戶 10 次交易請求
            message: '交易請求過於頻繁，請稍後再試',
            standardHeaders: true,
            legacyHeaders: false
        });
    }
    
    // 設置 CORS
    setupCORS() {
        return cors({
            origin: function (origin, callback) {
                // 允許的域名列表
                const allowedOrigins = [
                    'http://localhost:8080',
                    'http://localhost:3000',
                    'https://trading.yourdomain.com'
                ];
                
                // 允許沒有 origin 的請求（如移動應用）
                if (!origin) return callback(null, true);
                
                if (allowedOrigins.indexOf(origin) !== -1) {
                    callback(null, true);
                } else {
                    callback(new Error('不允許的 CORS 請求'));
                }
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        });
    }
    
    // 身份驗證中間件
    authenticateToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                error: '需要身份驗證',
                code: 'AUTH_REQUIRED'
            });
        }
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            req.user = decoded;
            next();
        } catch (error) {
            return res.status(403).json({ 
                error: '無效的 Token',
                code: 'INVALID_TOKEN'
            });
        }
    }
    
    // 權限檢查中間件
    requirePermission(permission) {
        return (req, res, next) => {
            const multiUserSystem = req.app.locals.multiUserSystem;
            
            if (!multiUserSystem) {
                return res.status(500).json({ 
                    error: '系統錯誤',
                    code: 'SYSTEM_ERROR'
                });
            }
            
            if (!multiUserSystem.checkPermission(req.user.userId, permission)) {
                return res.status(403).json({ 
                    error: '權限不足',
                    code: 'INSUFFICIENT_PERMISSION',
                    required: permission
                });
            }
            
            next();
        };
    }
    
    // 角色檢查中間件
    requireRole(roles) {
        return (req, res, next) => {
            const userRole = req.user.role;
            const allowedRoles = Array.isArray(roles) ? roles : [roles];
            
            if (!allowedRoles.includes(userRole)) {
                return res.status(403).json({ 
                    error: '角色權限不足',
                    code: 'INSUFFICIENT_ROLE',
                    required: roles,
                    current: userRole
                });
            }
            
            next();
        };
    }
    
    // 數據驗證中間件
    validateInput(schema) {
        return (req, res, next) => {
            const { error } = schema.validate(req.body);
            
            if (error) {
                return res.status(400).json({ 
                    error: '輸入數據無效',
                    code: 'INVALID_INPUT',
                    details: error.details
                });
            }
            
            next();
        };
    }
    
    // 日誌記錄中間件
    logRequest(req, res, next) {
        const start = Date.now();
        
        res.on('finish', () => {
            const duration = Date.now() - start;
            const logData = {
                method: req.method,
                url: req.url,
                status: res.statusCode,
                duration: duration,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                userId: req.user ? req.user.userId : 'anonymous',
                timestamp: new Date().toISOString()
            };
            
            console.log('Request:', JSON.stringify(logData));
        });
        
        next();
    }
    
    // 錯誤處理中間件
    errorHandler(err, req, res, next) {
        console.error('Error:', err);
        
        // JWT 錯誤
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                error: '無效的 Token',
                code: 'INVALID_TOKEN'
            });
        }
        
        // 權限錯誤
        if (err.name === 'PermissionError') {
            return res.status(403).json({ 
                error: '權限不足',
                code: 'INSUFFICIENT_PERMISSION'
            });
        }
        
        // 驗證錯誤
        if (err.name === 'ValidationError') {
            return res.status(400).json({ 
                error: '數據驗證失敗',
                code: 'VALIDATION_ERROR',
                details: err.message
            });
        }
        
        // 默認錯誤
        res.status(500).json({ 
            error: '內部服務器錯誤',
            code: 'INTERNAL_ERROR'
        });
    }
    
    // 獲取所有中間件
    getMiddlewares() {
        return {
            securityHeaders: this.setupSecurityHeaders(),
            cors: this.setupCORS(),
            globalRateLimit: this.globalRateLimit,
            apiRateLimit: this.apiRateLimit,
            loginRateLimit: this.loginRateLimit,
            tradingRateLimit: this.tradingRateLimit,
            authenticateToken: this.authenticateToken.bind(this),
            requirePermission: this.requirePermission.bind(this),
            requireRole: this.requireRole.bind(this),
            validateInput: this.validateInput.bind(this),
            logRequest: this.logRequest.bind(this),
            errorHandler: this.errorHandler.bind(this)
        };
    }
}

module.exports = SecurityMiddleware;
