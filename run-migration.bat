@echo off
echo Setting up PostgreSQL migration...

REM Set the DATABASE_URL environment variable
set DATABASE_URL=postgresql://postgres:Bho123456!@db.ghtqyibmlltkpmcuuanj.supabase.co:5432/postgres

REM Set other PostgreSQL environment variables
set PG_USER=postgres
set PG_HOST=db.ghtqyibmlltkpmcuuanj.supabase.co
set PG_DATABASE=postgres
set PG_PASSWORD=Bho123456!
set PG_PORT=5432
set PG_SSL=true

echo Environment variables set.
echo.
echo Starting migration...
node migrate-to-postgresql.js

pause


