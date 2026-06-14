#!/usr/bin/env bash
set -euo pipefail

# Edge build script for develop branch
# Usage: ./scripts/build-edge.sh

VERSION=$(node -p "require('./package.json').version")
GIT_SHA=$(git rev-parse --short HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
BUILDTIME=$(date -u +%Y%m%d-%H%M%S)
BUILD_NAME="surfboard-${VERSION}-${GIT_SHA}-${BUILDTIME}"

echo "══════════════════════════════════════════════════"
echo "  Surfboard EDGE Build"
echo "  Version: ${VERSION}"
echo "  Branch:  ${BRANCH}"
echo "  SHA:     ${GIT_SHA}"
echo "  Build:   ${BUILDTIME}"
echo "══════════════════════════════════════════════════"

if [ "$BRANCH" != "develop" ] && [ "${FORCE_EDGE:-0}" != "1" ]; then
  echo "⚠️  Not on develop branch. Use FORCE_EDGE=1 to override."
  exit 1
fi

# Clean and build
rm -rf dist/ edge-builds/
mkdir -p edge-builds

npx electron-builder --dir 2>&1 | tail -20

# Package with edge metadata
cat > dist/edge-info.json <<EOF
{
  "version": "$VERSION",
  "gitSha": "$GIT_SHA",
  "branch": "$BRANCH",
  "buildTime": "$BUILDTIME",
  "channel": "edge"
}
EOF

echo ""
echo "✅ Edge build complete: $BUILD_NAME"
echo "   Artifacts: $(pwd)/dist/"
