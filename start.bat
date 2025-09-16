@echo off
setlocal enabledelayedexpansion

echo 🚀 Stock Predictor - Quick Start
echo ================================

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    echo    Visit: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js %NODE_VERSION% detected

REM Check if npm is available
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not installed
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
) else (
    echo ✅ Dependencies already installed
)

REM Check for environment file
if not exist ".env" (
    if exist "env.example" (
        echo 📝 Creating .env file from template...
        copy env.example .env >nul
        echo ⚠️  Please edit .env file and add your Alpha Vantage API key
        echo    You can get a free API key from: https://www.alphavantage.co/support/#api-key
    ) else (
        echo ⚠️  No .env file found. Please create one with your Alpha Vantage API key
    )
)

REM Check for Docker (optional)
docker --version >nul 2>&1
if errorlevel 1 (
    echo ℹ️  Docker not found. You can install it for easier deployment.
) else (
    echo ✅ Docker is available
    if exist "docker-compose.yml" (
        echo 🐳 Docker Compose configuration found
        echo    You can also run: docker-compose up -d
    )
)

echo.
echo 🎯 Starting the application...
echo    - Optimized server: npm run start:optimized
echo    - Original server: npm start
echo    - Development mode: npm run dev
echo.

REM Ask user which version to run
echo Which version would you like to run?
echo 1) Optimized version (recommended) - with Redis cache and advanced models
echo 2) Original version - simple in-memory cache
echo 3) Docker Compose (if available)
echo 4) Exit
echo.

set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" (
    echo 🚀 Starting optimized version...
    npm run start:optimized
) else if "%choice%"=="2" (
    echo 🚀 Starting original version...
    npm start
) else if "%choice%"=="3" (
    if exist "docker-compose.yml" (
        docker-compose --version >nul 2>&1
        if errorlevel 1 (
            echo ❌ Docker Compose not available
            pause
            exit /b 1
        )
        echo 🐳 Starting with Docker Compose...
        docker-compose up -d
        echo ✅ Application started! Visit http://localhost:3001
        echo 📊 View logs: docker-compose logs -f
        echo 🛑 Stop: docker-compose down
    ) else (
        echo ❌ Docker Compose configuration not found
        pause
        exit /b 1
    )
) else if "%choice%"=="4" (
    echo 👋 Goodbye!
    exit /b 0
) else (
    echo ❌ Invalid choice
    pause
    exit /b 1
)

pause
