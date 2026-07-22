#!/usr/bin/env bash
# Build a deployable SEMS release tarball. Used by the GitHub Actions workflow
# and for manual deploys — both produce byte-identical layouts.
#
# Usage: build-release.sh <prod|stg> <public-api-url> <output.tar.gz> [--skip-install]
#
# The tarball contains built artifacts only (no dev dependencies, no sources):
# the VM installs production node_modules and activates it via `sems install`.
set -euo pipefail

ENV="${1:?usage: build-release.sh <prod|stg> <public-api-url> <output.tar.gz> [--skip-install]}"
API_URL="${2:?missing public api url}"
OUT="${3:?missing output tarball path}"
SKIP_INSTALL="${4:-}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
REF=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
ID="$(date -u +%Y%m%d-%H%M%S)-$SHA"

if [[ "$SKIP_INSTALL" != "--skip-install" ]]; then
  echo "==> npm ci"
  npm ci --no-audit --no-fund
fi

echo "==> build api"
npm run build:api

echo "==> build web (NEXT_PUBLIC_API_URL=$API_URL)"
NEXT_PUBLIC_API_URL="$API_URL" npm run build:web

echo "==> stage release $ID"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/apps/api" "$STAGE/apps/web" "$STAGE/deploy"
cp package.json package-lock.json "$STAGE/"
cp -R apps/api/package.json apps/api/dist apps/api/assets "$STAGE/apps/api/"
cp -R apps/web/package.json apps/web/next.config.mjs apps/web/public "$STAGE/apps/web/"
cp -R apps/web/.next "$STAGE/apps/web/.next"
rm -rf "$STAGE/apps/web/.next/cache"
cp -R deploy/azure "$STAGE/deploy/azure"

cat > "$STAGE/RELEASE.json" <<EOF
{
  "id": "$ID",
  "sha": "$SHA",
  "ref": "$REF",
  "env": "$ENV",
  "api_url": "$API_URL",
  "built_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "builder": "${GITHUB_RUN_ID:+github-actions-run-$GITHUB_RUN_ID}"
}
EOF

# COPYFILE_DISABLE avoids macOS xattr noise in local builds; no-op on Linux CI.
COPYFILE_DISABLE=1 tar -czf "$OUT" -C "$STAGE" .
echo "==> wrote $OUT ($(du -h "$OUT" | cut -f1)) — release $ID"
