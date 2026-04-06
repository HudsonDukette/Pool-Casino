#!/usr/bin/env bash
# PoolCasino — External deployment setup
# Configures Supabase (schema), Railway (env vars), and Vercel (env vars)
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
#
# Required CLIs (install if missing):
#   psql    — brew install postgresql   / apt install postgresql-client
#   railway — npm install -g @railway/cli  (then: railway login)
#   vercel  — npm install -g vercel        (then: vercel login)

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/scripts/supabase-schema.sql"

step() { echo -e "\n${BOLD}${CYAN}▶ $1${RESET}"; }
ok()   { echo -e "${GREEN}✓ $1${RESET}"; }
warn() { echo -e "${YELLOW}! $1${RESET}"; }
err()  { echo -e "${RED}✗ $1${RESET}"; exit 1; }
ask()  { echo -e "${BOLD}$1${RESET}"; }

echo ""
echo -e "${BOLD}════════════════════════════════════════${RESET}"
echo -e "${BOLD}  PoolCasino — External Deployment Setup ${RESET}"
echo -e "${BOLD}════════════════════════════════════════${RESET}"
echo ""
echo "This script will:"
echo "  1. Push the database schema to Supabase via psql"
echo "  2. Set environment variables on Railway"
echo "  3. Set environment variables on Vercel"
echo ""
read -rp "Press Enter to begin, or Ctrl+C to cancel..."

# ─────────────────────────────────────────────
# Step 0 — Check CLI dependencies
# ─────────────────────────────────────────────
step "Checking required CLIs"

MISSING=()
command -v psql    &>/dev/null || MISSING+=("psql (brew install postgresql / apt install postgresql-client)")
command -v railway &>/dev/null || MISSING+=("railway (npm install -g @railway/cli, then: railway login)")
command -v vercel  &>/dev/null || MISSING+=("vercel (npm install -g vercel, then: vercel login)")

if [ ${#MISSING[@]} -gt 0 ]; then
  echo -e "${RED}Missing required tools:${RESET}"
  for m in "${MISSING[@]}"; do echo "  • $m"; done
  echo ""
  echo "Install the above tools and re-run this script."
  exit 1
fi

ok "psql, railway, vercel all found"

# ─────────────────────────────────────────────
# Step 1 — Supabase schema
# ─────────────────────────────────────────────
step "Supabase — Push database schema"

echo ""
ask "Enter your Supabase database password:"
read -rs SUPA_PASS
echo ""

SUPA_HOST="db.envkswuvdssykdiftycs.supabase.co"
SUPA_USER="postgres"
SUPA_DB="postgres"
SUPA_PORT="5432"
SUPA_URL="postgresql://${SUPA_USER}:${SUPA_PASS}@${SUPA_HOST}:${SUPA_PORT}/${SUPA_DB}?sslmode=require"

echo "Connecting to Supabase and running schema..."
if PGPASSWORD="$SUPA_PASS" psql \
  "host=${SUPA_HOST} port=${SUPA_PORT} dbname=${SUPA_DB} user=${SUPA_USER} sslmode=require" \
  -f "$SQL_FILE" \
  --set ON_ERROR_STOP=0 \
  -q; then
  ok "Schema applied to Supabase"
else
  warn "psql exited with errors — some tables may already exist (that's fine if this is a re-run)"
fi

# ─────────────────────────────────────────────
# Step 2 — Railway env vars
# ─────────────────────────────────────────────
step "Railway — Set environment variables"

echo ""
echo "You need to be logged in and have a Railway project linked."
echo "If not already done: run  railway login  then  railway link"
echo ""

ask "Enter your Railway API service URL (e.g. https://poolcasino-api.up.railway.app):"
read -r RAILWAY_URL
RAILWAY_URL="${RAILWAY_URL%/}"   # strip trailing slash

ask "Enter a Session Secret (leave blank to auto-generate a secure one):"
read -rs SESSION_SECRET
echo ""
if [ -z "$SESSION_SECRET" ]; then
  SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" 2>/dev/null || \
                   openssl rand -hex 48)
  ok "Generated SESSION_SECRET: ${SESSION_SECRET:0:12}…"
fi

ask "Enter your Vercel frontend URL (e.g. https://poolcasino.vercel.app):"
read -r VERCEL_URL
VERCEL_URL="${VERCEL_URL%/}"

DB_URL="postgresql://postgres:${SUPA_PASS}@${SUPA_HOST}:${SUPA_PORT}/${SUPA_DB}?sslmode=require"

echo ""
echo "Setting Railway variables…"
railway variables set \
  "DATABASE_URL=${DB_URL}" \
  "SESSION_SECRET=${SESSION_SECRET}" \
  "ALLOWED_ORIGIN=${VERCEL_URL}" \
  "NODE_ENV=production"

ok "Railway variables set"
echo ""
echo "  DATABASE_URL  = postgresql://postgres:***@${SUPA_HOST}:${SUPA_PORT}/${SUPA_DB}?sslmode=require"
echo "  SESSION_SECRET = ${SESSION_SECRET:0:12}…"
echo "  ALLOWED_ORIGIN = ${VERCEL_URL}"
echo "  NODE_ENV       = production"

# ─────────────────────────────────────────────
# Step 3 — Vercel env var
# ─────────────────────────────────────────────
step "Vercel — Set VITE_API_URL"

echo ""
echo "You need to be logged in and have a Vercel project linked."
echo "If not: run  vercel link  inside artifacts/pool-casino/"
echo ""

ask "Enter your Railway API URL again to confirm (used as VITE_API_URL in Vercel):"
echo "  (press Enter to reuse: ${RAILWAY_URL})"
read -r VITE_API_URL_INPUT
VITE_API_URL="${VITE_API_URL_INPUT:-$RAILWAY_URL}"

echo ""
echo "Adding VITE_API_URL to Vercel (production + preview)…"

cd "$SCRIPT_DIR/artifacts/pool-casino"

# Remove existing value if present (vercel env add fails on duplicates)
vercel env rm VITE_API_URL production --yes 2>/dev/null || true
vercel env rm VITE_API_URL preview   --yes 2>/dev/null || true

printf '%s' "$VITE_API_URL" | vercel env add VITE_API_URL production
printf '%s' "$VITE_API_URL" | vercel env add VITE_API_URL preview

cd "$SCRIPT_DIR"

ok "Vercel env var set"
echo ""
echo "  VITE_API_URL = ${VITE_API_URL} (production + preview)"

# ─────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Setup complete!                ${RESET}"
echo -e "${BOLD}${GREEN}════════════════════════════════${RESET}"
echo ""
echo "Next steps:"
echo "  1. Trigger a Railway redeploy:  railway up"
echo "  2. Trigger a Vercel redeploy:   cd artifacts/pool-casino && vercel --prod"
echo "  3. Verify:  curl ${RAILWAY_URL}/healthz"
echo ""
echo "Vercel project settings to verify in the dashboard:"
echo "  Root Directory  : artifacts/pool-casino"
echo "  Build Command   : cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @workspace/pool-casino run build"
echo "  Output Directory: dist/public"
echo ""
