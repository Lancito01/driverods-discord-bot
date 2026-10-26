#!/bin/bash
#? Run under pm2 (e.g. `pm2 start start-script.sh --name driverods`).
#? pm2 handles restarts: when the bot exits (/restart, crash), pm2 reruns this script,
#? which pulls the latest code, rebuilds, and starts the bot again.

cd "$(dirname "$0")" || exit 1

echo "> Pulling latest changes..."
git pull --ff-only || echo "> git pull failed, continuing with current code"

echo "> Installing dependencies..."
npm install --no-audit --no-fund || echo "> npm install failed, continuing with existing node_modules"

echo "> Building..."
npm run build || echo "> Build failed, starting last successful build"

echo "> Starting bot..."
exec node dist/index.js
