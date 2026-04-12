#!/bin/bash
set -e

DROPLET="root@142.93.220.197"
DROPLET_PW="daKsh@3210G"
SSH="sshpass -p '$DROPLET_PW' ssh -o StrictHostKeyChecking=no $DROPLET"
SCP="sshpass -p '$DROPLET_PW' scp -o StrictHostKeyChecking=no"

echo "=== Building dashboard ==="
pnpm --filter @workspace/dashboard run build

echo "=== Building API server (includes copying dashboard into dist/public) ==="
pnpm --filter @workspace/api-server run build

echo "=== Packing full dist/ ==="
cd artifacts/api-server
tar czf /tmp/ai-brain-dist.tar.gz dist/
cd /home/runner/workspace

echo "=== Uploading ==="
sshpass -p "$DROPLET_PW" scp -o StrictHostKeyChecking=no /tmp/ai-brain-dist.tar.gz $DROPLET:/tmp/ai-brain-dist.tar.gz

echo "=== Deploying on droplet (full dist replace) ==="
sshpass -p "$DROPLET_PW" ssh -o StrictHostKeyChecking=no $DROPLET "
  cd /root/ai-brain
  rm -rf dist/
  tar xzf /tmp/ai-brain-dist.tar.gz
  echo 'Server build:' && ls dist/*.mjs
  echo 'Assets:' && ls dist/public/assets/
  pm2 restart ai-brain
  echo '✅ Done'
"

echo "=== Pushing to GitHub ==="
node github_push.mjs "$(date '+Deploy %Y-%m-%d %H:%M')" 2>&1 | grep -E "✅|❌|Commit:"

echo ""
echo "✅ Full deploy complete"
