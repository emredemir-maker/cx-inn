#!/bin/bash
set -e

# ─────────────────────────────────────────────
# CX-Inn Firebase Deployment Script
# Usage: ./scripts/deploy-firebase.sh
# ─────────────────────────────────────────────

GCP_PROJECT="${GCP_PROJECT:-YOUR_PROJECT_ID}"
CLOUD_RUN_REGION="europe-west1"
SERVICE_NAME="cx-inn-api"
IMAGE="gcr.io/$GCP_PROJECT/$SERVICE_NAME"

echo "━━━ [1/4] Building frontend..."
PORT=3000 BASE_PATH="/" NODE_ENV=production \
  pnpm --filter @workspace/cx-platform run build

echo "━━━ [2/4] Building & pushing Docker image to GCR..."
docker build -t "$IMAGE" .
docker push "$IMAGE"

echo "━━━ [3/4] Deploying API to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --platform managed \
  --region "$CLOUD_RUN_REGION" \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "DATABASE_URL=cx-inn-database-url:latest,RESEND_API_KEY=cx-inn-resend-key:latest,GOOGLE_CLOUD_API_KEY=cx-inn-gemini-key:latest" \
  --min-instances 0 \
  --max-instances 10 \
  --memory 512Mi \
  --port 8080

echo "━━━ [4/4] Deploying frontend to Firebase Hosting..."
firebase deploy --only hosting

echo ""
echo "✅ Deployment complete!"
echo "   Frontend: https://$GCP_PROJECT.web.app"
gcloud run services describe "$SERVICE_NAME" --region="$CLOUD_RUN_REGION" --format="value(status.url)" 2>/dev/null | xargs -I{} echo "   API:      {}"
