#!/bin/bash
set -e

DROPLET="root@142.93.220.197"
DROPLET_PW="daKsh@3210G"
SSH="sshpass -p '$DROPLET_PW' ssh -o StrictHostKeyChecking=no $DROPLET"
SCP="sshpass -p '$DROPLET_PW' scp -o StrictHostKeyChecking=no"

echo "=== Building dashboard ==="
pnpm --filter @workspace/dashboard run build

echo "=== Syncing into api-server dist ==="
rm -rf artifacts/api-server/dist/public/assets/*
cp -r artifacts/dashboard/dist/public/. artifacts/api-server/dist/public/
echo "Local assets: $(ls artifacts/api-server/dist/public/assets/)"

echo "=== Packing ==="
cd artifacts/api-server
tar czf /tmp/ai-brain-dist.tar.gz dist/
cd /home/runner/workspace

echo "=== Uploading ==="
$SCP /tmp/ai-brain-dist.tar.gz $DROPLET:/tmp/ai-brain-dist.tar.gz

echo "=== Deploying on droplet ==="
sshpass -p "$DROPLET_PW" ssh -o StrictHostKeyChecking=no $DROPLET "
  cd /root/ai-brain
  rm -rf dist/public/assets/*
  tar xzf /tmp/ai-brain-dist.tar.gz
  echo 'Droplet assets:' && ls dist/public/assets/
  pm2 restart ai-brain
  echo '✅ Done'
"

echo "=== Pushing to GitHub ==="
node /tmp/github_push_selective.mjs 2>&1 | grep -E "✅|❌|Commit:"

echo ""
echo "✅ Full deploy complete"
