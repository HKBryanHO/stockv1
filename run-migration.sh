#!/bin/bash

echo "Setting up PostgreSQL migration..."

# Set the DATABASE_URL environment variable
export DATABASE_URL="postgresql://postgres:Bho123456!@db.ghtqyibmlltkpmcuuanj.supabase.co:5432/postgres"

# Set other PostgreSQL environment variables
export PG_USER="postgres"
export PG_HOST="db.ghtqyibmlltkpmcuuanj.supabase.co"
export PG_DATABASE="postgres"
export PG_PASSWORD="Bho123456!"
export PG_PORT="5432"
export PG_SSL="true"

echo "Environment variables set."
echo ""
echo "Starting migration..."
node migrate-to-postgresql.js


