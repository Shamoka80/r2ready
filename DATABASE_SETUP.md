# Database Setup Guide

## Current Issue
Your DATABASE_URL is pointing to a **local PostgreSQL database** that is **not running**.

**Current Configuration:**
- Host: `localhost`
- Port: `5432`
- Database: `r2ready_dev`
- Username: `r2user`

## Solution Options

### Option 1: Start Local PostgreSQL (Recommended for Development)

#### Windows:
1. **Check if PostgreSQL is installed:**
   ```powershell
   Get-Service | Where-Object {$_.Name -like "*postgres*"}
   ```

2. **Start PostgreSQL service:**
   ```powershell
   # Find the exact service name first, then:
   net start postgresql-x64-15
   # Or replace 15 with your PostgreSQL version number
   ```

3. **Or start from Services Panel:**
   - Press `Win + R`, type `services.msc`
   - Find "postgresql" service
   - Right-click → Start

4. **Verify it's running:**
   ```powershell
   netstat -an | findstr 5432
   ```
   Should show `LISTENING` on port 5432

5. **Create the database if it doesn't exist:**
   ```powershell
   psql -U postgres -c "CREATE DATABASE r2ready_dev;"
   psql -U postgres -c "CREATE USER r2user WITH PASSWORD 'your_password';"
   psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE r2ready_dev TO r2user;"
   ```

### Option 2: Use Cloud Database (Recommended for Production)

#### Using Neon (Free Tier Available):
1. Go to https://neon.tech
2. Sign up for free account
3. Create a new project
4. Copy the connection string
5. Update `server/.env`:
   ```
   DATABASE_URL="postgresql://username:password@ep-xxx.region.aws.neon.tech/database?sslmode=require"
   ```

#### Using Supabase (Free Tier Available):
1. Go to https://supabase.com
2. Create a new project
3. Go to Settings → Database
4. Copy the connection string
5. Update `server/.env` with the connection string

#### Using Railway:
1. Go to https://railway.app
2. Create new PostgreSQL database
3. Copy the connection string
4. Update `server/.env`

### Option 3: Use Docker PostgreSQL (Quick Setup)

1. **Run PostgreSQL in Docker:**
   ```powershell
   docker run --name r2ready-postgres `
     -e POSTGRES_USER=r2user `
     -e POSTGRES_PASSWORD=your_password `
     -e POSTGRES_DB=r2ready_dev `
     -p 5432:5432 `
     -d postgres:15
   ```

2. **Your DATABASE_URL will be:**
   ```
   DATABASE_URL="postgresql://r2user:your_password@localhost:5432/r2ready_dev"
   ```

## Verify Connection

After setting up, run:
```powershell
cd server
npm run db:check
```

This will test your database connection and provide detailed diagnostics.

## Next Steps

Once your database is running:
1. Run migrations: `cd server && npm run db:push`
2. Restart your server: `npm run dev`
3. Try creating an account again

## Need Help?

- Check the diagnostic endpoint: `GET http://localhost:5000/api/testing/db-diagnostic`
- Run the diagnostic tool: `cd server && npm run db:check`
- Check server logs for detailed error messages






