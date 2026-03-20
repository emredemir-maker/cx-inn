#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-gcp-secrets.sh
# Creates all required Secret Manager secrets for cx-inn API on Cloud Run.
# Run once before first deployment.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - Secret Manager API enabled: gcloud services enable secretmanager.googleapis.com
#   - Cloud Run API enabled: gcloud services enable run.googleapis.com
#   - Artifact Registry API enabled: gcloud services enable artifactregistry.googleapis.com
#
# Usage:
#   export GCP_PROJECT_ID=your-project-id
#   chmod +x scripts/setup-gcp-secrets.sh
#   ./scripts/setup-gcp-secrets.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

PROJECT="${GCP_PROJECT_ID:?GCP_PROJECT_ID environment variable is required}"

echo "▶ Setting up GCP secrets for project: $PROJECT"

# Enable required APIs
echo "▶ Enabling required APIs..."
gcloud services enable \
  secretmanager.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --project="$PROJECT"

# Helper: create or update a secret
create_or_update_secret() {
  local name=$1
  local value=$2

  if gcloud secrets describe "$name" --project="$PROJECT" &>/dev/null; then
    echo "  ↻ Updating secret: $name"
    echo -n "$value" | gcloud secrets versions add "$name" \
      --data-file=- \
      --project="$PROJECT"
  else
    echo "  ✚ Creating secret: $name"
    echo -n "$value" | gcloud secrets create "$name" \
      --data-file=- \
      --replication-policy=automatic \
      --project="$PROJECT"
  fi
}

echo ""
echo "▶ Enter secret values (press Enter to skip and set manually later):"
echo ""

read -rp "  DATABASE_URL (Neon PostgreSQL): " DB_URL
read -rp "  GEMINI_API_KEY: " GEMINI_KEY
read -rp "  FIREBASE_PROJECT_ID: " FB_PROJECT_ID
read -rp "  FIREBASE_SERVICE_ACCOUNT (JSON string): " FB_SA
read -rp "  GMAIL_USER: " GMAIL_USER
read -rp "  GMAIL_APP_PASSWORD: " GMAIL_PASS

echo ""
echo "▶ Creating secrets in Secret Manager..."

[ -n "$DB_URL" ]        && create_or_update_secret "CX_INN_DATABASE_URL"           "$DB_URL"
[ -n "$GEMINI_KEY" ]    && create_or_update_secret "CX_INN_GEMINI_API_KEY"         "$GEMINI_KEY"
[ -n "$FB_PROJECT_ID" ] && create_or_update_secret "CX_INN_FIREBASE_PROJECT_ID"   "$FB_PROJECT_ID"
[ -n "$FB_SA" ]         && create_or_update_secret "CX_INN_FIREBASE_SERVICE_ACCOUNT" "$FB_SA"
[ -n "$GMAIL_USER" ]    && create_or_update_secret "CX_INN_GMAIL_USER"             "$GMAIL_USER"
[ -n "$GMAIL_PASS" ]    && create_or_update_secret "CX_INN_GMAIL_APP_PASSWORD"     "$GMAIL_PASS"

# ─── Service Account for Cloud Run & GitHub Actions ──────────────────────────
SA_NAME="cx-inn-deployer"
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

echo ""
echo "▶ Creating deployer service account: $SA_EMAIL"

gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT" &>/dev/null || \
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="cx-inn GitHub Actions Deployer" \
  --project="$PROJECT"

echo "▶ Granting IAM roles..."

for role in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/iam.serviceAccountUser \
  roles/secretmanager.secretAccessor \
  roles/storage.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role" \
    --condition=None \
    --quiet
  echo "  ✔ $role"
done

echo ""
echo "▶ Creating JSON key for GitHub Actions secret GCP_SA_KEY..."
gcloud iam service-accounts keys create /tmp/cx-inn-sa-key.json \
  --iam-account="$SA_EMAIL" \
  --project="$PROJECT"

echo ""
echo "══════════════════════════════════════════════════════════════════════════"
echo "✅ GCP setup complete!"
echo ""
echo "Next steps:"
echo ""
echo "1. Add the following secrets to your GitHub repository:"
echo "   Settings → Secrets and variables → Actions → New repository secret"
echo ""
echo "   GCP_PROJECT_ID       = $PROJECT"
echo "   GCP_SA_KEY           = (contents of /tmp/cx-inn-sa-key.json)"
echo "   FIREBASE_PROJECT_ID  = ${FB_PROJECT_ID:-your-firebase-project-id}"
echo ""
echo "   VITE_FIREBASE_API_KEY       = (from Firebase Console → Project settings → Web app)"
echo "   VITE_FIREBASE_AUTH_DOMAIN   = ${FB_PROJECT_ID:-PROJECT_ID}.firebaseapp.com"
echo "   VITE_FIREBASE_PROJECT_ID    = ${FB_PROJECT_ID:-your-firebase-project-id}"
echo "   VITE_FIREBASE_APP_ID        = (from Firebase Console → Project settings → Web app)"
echo ""
echo "   FIREBASE_SERVICE_ACCOUNT_HOSTING = (Firebase hosting service account JSON)"
echo "   → Generate: Firebase Console → Project Settings → Service accounts → Generate new private key"
echo ""
echo "2. Delete the local key file after copying:"
echo "   rm /tmp/cx-inn-sa-key.json"
echo ""
echo "3. Push to main branch to trigger first deployment:"
echo "   git push origin main"
echo "══════════════════════════════════════════════════════════════════════════"
