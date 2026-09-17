#!/usr/bin/env bash
set -euo pipefail

CLI=(npx --yes supabase@2.45.5)

if [[ ! -f .env ]]; then
  printf 'Missing .env file.\n' >&2
  exit 1
fi

set -a
source .env
set +a

PROJECT_REF="${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF in .env}"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
AGENCY_EMAIL="${ACCESSRIDE_TEST_AGENCY_EMAIL:?Set ACCESSRIDE_TEST_AGENCY_EMAIL in .env}"
AGENCY_PASSWORD="${ACCESSRIDE_TEST_AGENCY_PASSWORD:?Set ACCESSRIDE_TEST_AGENCY_PASSWORD in .env}"
AGENCY_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({email: process.env.ACCESSRIDE_TEST_AGENCY_EMAIL, password: process.env.ACCESSRIDE_TEST_AGENCY_PASSWORD}))')"

printf 'Deploying database migrations...\n'
"${CLI[@]}" db push --include-all

printf 'Deploying rider account service...\n'
"${CLI[@]}" functions deploy create-rider --project-ref "$PROJECT_REF"

BOOTSTRAP_TOKEN="$(openssl rand -hex 32)"
printf 'Preparing one-time agency bootstrap...\n'
"${CLI[@]}" secrets set "BOOTSTRAP_TOKEN=${BOOTSTRAP_TOKEN}" --project-ref "$PROJECT_REF"
"${CLI[@]}" functions deploy bootstrap-agency --project-ref "$PROJECT_REF" --no-verify-jwt

printf 'Creating initial agency administrator...\n'
curl --fail --silent --show-error \
  "${SUPABASE_URL}/functions/v1/bootstrap-agency" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-token: ${BOOTSTRAP_TOKEN}" \
  -d "${AGENCY_PAYLOAD}"
printf '\n'

printf 'Removing one-time bootstrap endpoint...\n'
"${CLI[@]}" functions delete bootstrap-agency --project-ref "$PROJECT_REF" --yes

printf 'Supabase deployment complete.\n'
