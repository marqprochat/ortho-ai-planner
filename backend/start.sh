#!/bin/sh

# Stop on errors for migration (critical)
set -e

echo "🚀 Starting deployment script..."

# 1. Fix failed migrations (if any)
echo "🔧 Checking for failed migrations..."
npx prisma migrate resolve --applied 20260205172128_add_cro 2>/dev/null && echo "✅ Resolved failed migration 20260205172128_add_cro" || echo "ℹ️ No failed migration to resolve (or already resolved)"

# 2. Migrations (Critical - if this fails, we should probably stop)
echo "📦 Running database migrations..."
if npx prisma migrate deploy; then
    echo "✅ Migrations applied successfully."
else
    echo "❌ Migration failed! Exiting..."
    exit 1
fi

# 2. Seeding (Non-critical - if this fails, we can still start the server)
# Use a subshell or temporarily disable set -e to allow failure
echo "🌱 Running database seed..."
if npx prisma db seed; then
    echo "✅ Seed completed successfully."
else
    echo "⚠️ Seed failed, but continuing startup..."
    # We don't exit here
fi

# 3. Start Application
echo "🚀 Starting application..."
exec node dist/index.js
