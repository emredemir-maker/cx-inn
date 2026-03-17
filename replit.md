# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Enterprise Omnichannel CX (Customer Experience) Platform - AI-powered customer feedback and survey management platform.

## Authentication

- **Provider**: Replit Auth (OpenID Connect with PKCE)
- **Server**: `artifacts/api-server/src/routes/auth.ts` — `/api/login`, `/api/callback`, `/api/logout`, `/api/auth/user`
- **Session store**: PostgreSQL `sessions` table (Drizzle); session cookie `sid` (httpOnly, secure)
- **User table**: `users` table in DB, upserted on each login
- **Frontend gate**: `AuthGate` in `App.tsx` — wraps all routes except `/survey/:token` (public)
- **Hook**: `useAuth()` from `@workspace/replit-auth-web` — provides `user`, `isAuthenticated`, `login()`, `logout()`
- **Sidebar**: `UserSection` in `layout.tsx` shows user avatar/name and logout button on hover

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind CSS, Recharts, Framer Motion, date-fns

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   ├── cx-platform/        # React + Vite frontend (Enterprise CX Platform)
│   └── mockup-sandbox/     # UI prototyping sandbox
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Application: Enterprise Omnichannel CX Platform

A full-stack AI-powered customer experience management platform with:

### Pages
- **Gösterge Paneli** (Dashboard) - NPS/CSAT/CES KPIs, trend charts, activity feed
- **Anketler** (Surveys) - Survey management (NPS/CSAT/CES/custom), multi-channel, skip-logic question builder, email designer, test send (token-based with Resend, public respond page at `/survey/:token`)
- **Müşteriler** (Customers) - Customer profiles with sentiment/churn risk analysis
- **AI Onayları** (AI Approvals) - Manager approval queue for LLM-personalized texts
- **Tetikleyiciler** (Triggers) - Behavioral trigger rules (rage click, purchase, etc.)
- **Denetim Kaydı** (Audit Log) - KVKK/GDPR compliance audit log with PII masking
- **Segmentler** (Segments) - Customer segments with NPS breakdown

### Database Tables
- `segments` - Customer segments
- `customers` - Customer profiles with sentiment/churn risk
- `interactions` - Customer interaction history
- `interaction_records` - Individual interaction entries with tags + exclusion flags
- `surveys` - Survey definitions and metadata
- `survey_questions` - Individual questions per survey with skip logic rules (jsonb)
- `survey_campaigns` - Survey campaigns and response tracking
- `survey_responses` - Actual survey responses from customers (score, feedback, sentiment)
- `cx_analyses` - Gemini AI analysis results (predicted_nps, predicted_csat, pain_points, etc.)
- `prediction_accuracy` - Prediction vs actual comparison records for AI learning loop
- `triggers` - Behavioral trigger rules
- `ai_approvals` - AI-generated personalized texts awaiting approval
- `audit_logs` - Full audit trail for compliance

### AI Learning Loop
- Every AI analysis stores `predicted_nps` / `predicted_csat` in `cx_analyses`
- When a survey response arrives, `recordPredictionAccuracy()` auto-matches it to the latest analysis
- Deviation (actual − predicted), MAE, and bias direction are stored in `prediction_accuracy`
- Next Gemini prompt for that customer includes past correction examples via `getLearningCorrections()`
- After each analysis, used correction records are marked `used_for_learning = true`
- CX Analiz Raporu → "AI Tahmin Doğruluğu" section shows MAE KPIs + per-customer table

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`.

Root commands:
- `pnpm run typecheck` — runs full typecheck
- `pnpm run build` — runs `typecheck` first, then recursively runs `build`

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — start API server
- `pnpm --filter @workspace/cx-platform run dev` — start frontend
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API types
- `pnpm --filter @workspace/db run push` — push DB schema

## Firebase / GCP Production Deployment

Architecture: **Firebase Hosting** (frontend) + **Cloud Run** (API) + **Cloud SQL** (PostgreSQL)

Config files:
- `Dockerfile` — multi-stage build for Cloud Run API container
- `firebase.json` — hosting config; rewrites `/api/**` to Cloud Run, SPA fallback to `index.html`
- `.firebaserc` — Firebase project ID (update `YOUR_FIREBASE_PROJECT_ID`)
- `scripts/deploy-firebase.sh` — full automated deploy script
- `scripts/build-frontend.sh` — builds frontend with `BASE_PATH=/` for root hosting
- `.env.production.example` — required environment variables reference

Pre-deployment checklist:
1. `firebase login && gcloud auth login`
2. Update `.firebaserc` with Firebase project ID
3. Create Cloud SQL PostgreSQL 15 instance
4. Store secrets in GCP Secret Manager: `DATABASE_URL`, `RESEND_API_KEY`, `GOOGLE_CLOUD_API_KEY`
5. Run `GCP_PROJECT=your-project ./scripts/deploy-firebase.sh`
6. Run schema migration: set `DATABASE_URL` and `pnpm --filter @workspace/db run push`

API Integration:
- All public endpoints under `/api/v1/` require `X-API-Key` header
- API keys managed at `/settings` page — hashed with SHA-256, never stored in plain text
- PII masking active by default on all `/api/v1/customers` responses

Security notes:
- API keys: SHA-256 hashed, prefix-only displayed after creation
- PII: email, name, phone masked in public API responses
- All secrets: GCP Secret Manager (never in code/env files)
- HTTPS: enforced automatically by both Firebase Hosting and Cloud Run
