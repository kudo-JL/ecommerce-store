#!/usr/bin/env bash
# E-commerce store - start script (Linux / macOS)
set -e
cd "$(dirname "$0")"

echo ""
echo " [1/3] Installing dependencies (first run only)..."
npm install

echo ""
echo " [2/3] Initializing database..."
node scripts/init-db.js

echo ""
echo " [3/3] Seeding sample products (first run only)..."
node scripts/seed.js

echo ""
echo " Starting server..."
echo " Store:  http://localhost:3000/"
echo " Admin:  http://localhost:3000/admin/   (default password: admin123)"
echo ""

exec node server.js
