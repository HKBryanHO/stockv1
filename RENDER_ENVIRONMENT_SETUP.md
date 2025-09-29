# 🔧 Render Environment Variables Setup

## Required Environment Variables

Add these environment variables to your Render service:

### 🗄️ PostgreSQL Database Configuration

```
DATABASE_URL=postgresql://postgres:Bho123456!@db.ghtqyibmlltkpmcuuanj.supabase.co:5432/postgres
```

**OR** (if you prefer individual variables):

```
PG_USER=postgres
PG_HOST=db.ghtqyibmlltkpmcuuanj.supabase.co
PG_DATABASE=postgres
PG_PASSWORD=Bho123456!
PG_PORT=5432
PG_SSL=true
```

### 🔑 API Keys (Optional - add if you have them)

```
FINNHUB_API_KEY=your_finnhub_api_key_here
FMP_API_KEY=your_fmp_api_key_here
POLYGON_API_KEY=your_polygon_api_key_here
ALPHA_VANTAGE_KEY=your_alpha_vantage_api_key_here
```

### ⚙️ Server Configuration

```
PORT=3001
NODE_ENV=production
```

### 🔐 Authentication

```
AUTH_USER=admin
AUTH_PASSWORD=admin123
```

### 📊 Session Configuration

```
SESSION_TTL_MS=43200000
```

## 🚀 How to Add Environment Variables in Render

1. **Go to your Render Dashboard**
   - Visit [render.com](https://render.com)
   - Log in to your account

2. **Navigate to Your Service**
   - Click on your service name
   - Go to the "Environment" tab

3. **Add Environment Variables**
   - Click "Add Environment Variable"
   - Enter the variable name and value
   - **Important**: Mark sensitive variables like `PG_PASSWORD` and `AUTH_PASSWORD` as **Secret** (click the lock icon)

4. **Redeploy Your Service**
   - After adding all variables, redeploy your service
   - The new environment variables will be available after deployment

## 🔒 Security Notes

- Mark these variables as **Secret** in Render:
  - `PG_PASSWORD`
  - `AUTH_PASSWORD`
  - Any API keys you add

## ✅ Verification

After deployment, your service should:
1. Connect to PostgreSQL successfully
2. Create tables automatically if they don't exist
3. Log "✅ Using PostgreSQL UserManager" on startup

## 🐛 Troubleshooting

If you see connection errors:
1. Verify the `DATABASE_URL` is correct
2. Check that `PG_SSL=true` is set
3. Ensure your Supabase database is accessible
4. Check Render logs for detailed error messages

## 📝 Next Steps

After setting up environment variables:
1. Deploy your service
2. Check the logs to ensure PostgreSQL connection is successful
3. Test user registration and login functionality
4. Verify that data is being stored in PostgreSQL


