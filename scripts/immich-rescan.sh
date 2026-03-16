#!/usr/bin/env sh
set -eu

: "${IMMICH_URL:?IMMICH_URL is required}"
: "${IMMICH_API_KEY:?IMMICH_API_KEY is required}"
: "${IMMICH_LIBRARY_ID:?IMMICH_LIBRARY_ID is required}"

curl -fsS \
  -X POST \
  -H "x-api-key: ${IMMICH_API_KEY}" \
  -H "Accept: application/json" \
  "${IMMICH_URL%/}/api/libraries/${IMMICH_LIBRARY_ID}/scan"

