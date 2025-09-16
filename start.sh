#!/bin/bash

# Stock Predictor - Quick Start Script
# This script helps you quickly set up and run the stock prediction application

set -e

echo "🚀 Stock Predictor - Quick Start"
echo "================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Check for environment file
if [ ! -f ".env" ]; then
    if [ -f "env.example" ]; then
        echo "📝 Creating .env file from template..."
        cp env.example .env
        echo "⚠️  Please edit .env file and add your Alpha Vantage API key"
        echo "   You can get a free API key from: https://www.alphavantage.co/support/#api-key"
    else
        echo "⚠️  No .env file found. Please create one with your Alpha Vantage API key"
    fi
fi

# Check for Redis (optional)
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis is running"
    else
        echo "⚠️  Redis is installed but not running. Starting Redis..."
        if command -v brew &> /dev/null; then
            brew services start redis
        elif command -v systemctl &> /dev/null; then
            sudo systemctl start redis
        else
            echo "   Please start Redis manually or use Docker: docker run -d -p 6379:6379 redis:7-alpine"
        fi
    fi
else
    echo "⚠️  Redis not found. The app will use in-memory cache."
    echo "   For better performance, install Redis or use Docker:"
    echo "   docker run -d -p 6379:6379 redis:7-alpine"
fi

# Check for Docker (optional)
if command -v docker &> /dev/null; then
    echo "✅ Docker is available"
    if [ -f "docker-compose.yml" ]; then
        echo "🐳 Docker Compose configuration found"
        echo "   You can also run: docker-compose up -d"
    fi
else
    echo "ℹ️  Docker not found. You can install it for easier deployment."
fi

echo ""
echo "🎯 Starting the application..."
echo "   - Optimized server: npm run start:optimized"
echo "   - Original server: npm start"
echo "   - Development mode: npm run dev"
echo ""

# Ask user which version to run
echo "Which version would you like to run?"
echo "1) Optimized version (recommended) - with Redis cache and advanced models"
echo "2) Original version - simple in-memory cache"
echo "3) Docker Compose (if available)"
echo "4) Exit"
echo ""

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo "🚀 Starting optimized version..."
        npm run start:optimized
        ;;
    2)
        echo "🚀 Starting original version..."
        npm start
        ;;
    3)
        if [ -f "docker-compose.yml" ] && command -v docker-compose &> /dev/null; then
            echo "🐳 Starting with Docker Compose..."
            docker-compose up -d
            echo "✅ Application started! Visit http://localhost:3001"
            echo "📊 View logs: docker-compose logs -f"
            echo "🛑 Stop: docker-compose down"
        else
            echo "❌ Docker Compose not available"
            exit 1
        fi
        ;;
    4)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac
