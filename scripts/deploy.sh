#!/bin/bash
# =========================================
# Deploy script — 1 lệnh build + push
# Chạy: bash scripts/deploy.sh
# =========================================
set -e

cd "$(dirname "$0")/.."

echo "🚀 Building site..."
rm -rf public
hugo --gc --minify --baseURL "https://mombabypicks.com/" 2>&1

echo "📦 Committing to GitHub..."
git add -A
git commit -m "chore: deploy $(date +%Y-%m-%d_%H:%M)"
git push

echo "✅ Deploy done! Wait 2-3 phút cho CDN refresh."
echo "   Check: https://github.com/thangnq95/mombabypicks/actions"
