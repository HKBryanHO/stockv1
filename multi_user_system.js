/**
 * 多用戶支持系統
 * 包含用戶管理、權限控制、會話管理、數據隔離等功能
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

class MultiUserSystem {
    constructor() {
        this.users = new Map();
        this.sessions = new Map();
        this.permissions = new Map();
        this.userData = new Map();
        this.rateLimits = new Map();
        
        // 初始化默認管理員
        this.createDefaultAdmin();
    }
    
    // 創建默認管理員
    createDefaultAdmin() {
        const adminId = 'admin';
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        
        this.users.set(adminId, {
            id: adminId,
            username: 'admin',
            email: 'admin@trading.com',
            password: hashedPassword,
            role: 'admin',
            status: 'active',
            createdAt: new Date(),
            lastLogin: null
        });
        
        // 設置管理員權限
        this.permissions.set(adminId, {
            canTrade: true,
            canViewAllUsers: true,
            canManageUsers: true,
            canViewReports: true,
            canManageSystem: true,
            canAccessML: true,
            canAccessAdvanced: true
        });
    }
    
    // 用戶註冊
    async registerUser(userData) {
        const { username, email, password, role = 'user' } = userData;
        
        // 檢查用戶是否已存在
        if (this.users.has(username)) {
            throw new Error('用戶名已存在');
        }
        
        // 檢查郵箱是否已存在
        for (const [id, user] of this.users) {
            if (user.email === email) {
                throw new Error('郵箱已被使用');
            }
        }
        
        // 密碼強度檢查
        if (password.length < 8) {
            throw new Error('密碼長度至少8位');
        }
        
        // 加密密碼
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 創建用戶
        const userId = username;
        this.users.set(userId, {
            id: userId,
            username,
            email,
            password: hashedPassword,
            role,
            status: 'active',
            createdAt: new Date(),
            lastLogin: null
        });
        
        // 設置默認權限
        this.permissions.set(userId, {
            canTrade: role === 'admin' || role === 'trader',
            canViewAllUsers: role === 'admin',
            canManageUsers: role === 'admin',
            canViewReports: true,
            canManageSystem: role === 'admin',
            canAccessML: role === 'admin' || role === 'trader',
            canAccessAdvanced: role === 'admin' || role === 'trader'
        });
        
        // 初始化用戶數據
        this.userData.set(userId, {
            portfolio: {
                cash: 100000,
                positions: new Map(),
                totalValue: 100000
            },
            tradingHistory: [],
            mlModels: new Map(),
            strategies: new Map(),
            settings: {
                riskLevel: 'medium',
                maxPositionSize: 0.1,
                stopLoss: 0.05,
                takeProfit: 0.1
            }
        });
        
        return { userId, username, email, role };
    }
    
    // 用戶登錄
    async loginUser(username, password) {
        const user = this.users.get(username);
        if (!user) {
            throw new Error('用戶不存在');
        }
        
        if (user.status !== 'active') {
            throw new Error('賬戶已被禁用');
        }
        
        // 驗證密碼
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            throw new Error('密碼錯誤');
        }
        
        // 更新最後登錄時間
        user.lastLogin = new Date();
        
        // 生成 JWT Token
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        // 創建會話
        const sessionId = this.generateSessionId();
        this.sessions.set(sessionId, {
            userId: user.id,
            token,
            createdAt: new Date(),
            lastActivity: new Date(),
            ipAddress: null
        });
        
        return {
            token,
            sessionId,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        };
    }
    
    // 驗證 Token
    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            return decoded;
        } catch (error) {
            throw new Error('無效的 Token');
        }
    }
    
    // 檢查權限
    checkPermission(userId, permission) {
        const userPermissions = this.permissions.get(userId);
        if (!userPermissions) {
            return false;
        }
        return userPermissions[permission] || false;
    }
    
    // 獲取用戶數據
    getUserData(userId) {
        return this.userData.get(userId);
    }
    
    // 更新用戶數據
    updateUserData(userId, data) {
        const userData = this.userData.get(userId);
        if (!userData) {
            throw new Error('用戶數據不存在');
        }
        
        // 合併數據
        Object.assign(userData, data);
        this.userData.set(userId, userData);
        
        return userData;
    }
    
    // 獲取用戶列表（僅管理員）
    getUserList(requesterId) {
        if (!this.checkPermission(requesterId, 'canViewAllUsers')) {
            throw new Error('權限不足');
        }
        
        const userList = [];
        for (const [id, user] of this.users) {
            userList.push({
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                status: user.status,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            });
        }
        
        return userList;
    }
    
    // 更新用戶狀態
    updateUserStatus(userId, status, requesterId) {
        if (!this.checkPermission(requesterId, 'canManageUsers')) {
            throw new Error('權限不足');
        }
        
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('用戶不存在');
        }
        
        user.status = status;
        this.users.set(userId, user);
        
        return { userId, status };
    }
    
    // 生成會話 ID
    generateSessionId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
    
    // 清理過期會話
    cleanupExpiredSessions() {
        const now = new Date();
        for (const [sessionId, session] of this.sessions) {
            const hoursSinceActivity = (now - session.lastActivity) / (1000 * 60 * 60);
            if (hoursSinceActivity > 24) {
                this.sessions.delete(sessionId);
            }
        }
    }
    
    // 獲取系統統計
    getSystemStats() {
        const totalUsers = this.users.size;
        const activeUsers = Array.from(this.users.values()).filter(user => user.status === 'active').length;
        const totalSessions = this.sessions.size;
        
        return {
            totalUsers,
            activeUsers,
            totalSessions,
            systemUptime: process.uptime()
        };
    }
}

// 中間件：身份驗證
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: '需要身份驗證' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: '無效的 Token' });
    }
};

// 中間件：權限檢查
const requirePermission = (permission) => {
    return (req, res, next) => {
        const multiUserSystem = req.app.locals.multiUserSystem;
        if (!multiUserSystem.checkPermission(req.user.userId, permission)) {
            return res.status(403).json({ error: '權限不足' });
        }
        next();
    };
};

// 速率限制
const createRateLimit = (windowMs, max) => {
    return rateLimit({
        windowMs,
        max,
        message: '請求過於頻繁，請稍後再試',
        standardHeaders: true,
        legacyHeaders: false
    });
};

// 導出模組
module.exports = {
    MultiUserSystem,
    authenticateToken,
    requirePermission,
    createRateLimit
};
