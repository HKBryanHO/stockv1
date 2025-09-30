const https = require('https');
const http = require('http');

async function testBacktestAPI() {
    console.log('🔍 Testing Backtest API...\n');
    
    const testData = {
        symbol: 'AAPL',
        period: 5,
        lookbackDays: 30,
        models: ['lstm', 'gbm', 'arima', 'prophet']
    };
    
    const postData = JSON.stringify(testData);
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/backtest/run',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            console.log(`📡 Status: ${res.statusCode}`);
            console.log(`📡 Headers:`, res.headers);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log('✅ API Response:', JSON.stringify(result, null, 2));
                    resolve(result);
                } catch (error) {
                    console.log('❌ Raw Response:', data);
                    reject(new Error(`Failed to parse JSON: ${error.message}`));
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('❌ Request Error:', error.message);
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}

// Test the API
testBacktestAPI()
    .then(result => {
        console.log('\n🎉 Backtest API test completed successfully!');
        console.log('📊 Results summary:');
        if (result && result.summary) {
            console.log(`   - Total Trades: ${result.summary.totalTrades}`);
            console.log(`   - Win Rate: ${(result.summary.winRate * 100).toFixed(1)}%`);
            console.log(`   - Total Return: ${(result.summary.totalReturn * 100).toFixed(2)}%`);
            console.log(`   - Sharpe Ratio: ${result.summary.sharpeRatio.toFixed(3)}`);
        }
    })
    .catch(error => {
        console.error('\n💥 Backtest API test failed:', error.message);
        console.log('\n🔧 Troubleshooting tips:');
        console.log('   1. Make sure the server is running on port 3000');
        console.log('   2. Check if API keys are configured in .env file');
        console.log('   3. Verify the /api/backtest/run endpoint exists in server.js');
    });
