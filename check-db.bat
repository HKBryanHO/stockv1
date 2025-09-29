@echo off
echo 🔍 Database Status Checker
echo ================================
echo.

echo Setting environment variables...
set DATABASE_URL=postgresql://postgres:Bho123456!@db.ghtqyibmlltkpmcuuanj.supabase.co:5432/postgres
set PG_USER=postgres
set PG_HOST=db.ghtqyibmlltkpmcuuanj.supabase.co
set PG_DATABASE=postgres
set PG_PASSWORD=Bho123456!
set PG_PORT=5432
set PG_SSL=true

echo.
echo Running quick database check...
node quick-db-check.js

echo.
echo Running detailed database check...
node check-database-status.js

echo.
echo Press any key to continue...
pause
