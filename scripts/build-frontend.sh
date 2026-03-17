#!/bin/bash
set -e

echo "Building CX-Inn frontend for Firebase Hosting..."

PORT=3000 BASE_PATH="/" NODE_ENV=production \
  pnpm --filter @workspace/cx-platform run build

echo "Frontend built to: artifacts/cx-platform/dist/public"
