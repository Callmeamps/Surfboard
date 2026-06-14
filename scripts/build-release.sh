#!/usr/bin/env bash
set -euo pipefail

# Surfboard release build script
# Usage: ./scripts/build-release.sh [stable|edge] [version]

CHANNEL="${1:-stable}"
VERSION=$(node -p "require('./package.json').version")
GIT_SHA=$(git rev-parse --short HEAD)
BUILD_ID="${VERSION}-${GIT_SHA}"

echo "══════════════════════════════════════════════════"
echo "  Surfboard Release Build"
echo "  Channel: ${CHANNEL}"
echo "  Version: ${VERSION}"
echo "  Git SHA: ${GIT_SHA}"
echo "══════════════════════════════════════════════════"

# Clean previous builds
rm -rf dist/
mkdir -p dist

# Build with electron-builder
echo "[1/3] Building Electron app..."
if [ "$CHANNEL" = "edge" ]; then
  # Edge: include dev deps and debug symbols
  npx electron-builder --dir --config electron-builder.edge.yml 2>&1 | tail -20
else
  # Stable: full distribution packages
  npx electron-builder 2>&1 | tail -20
fi

echo "[2/3] Verifying build artifacts..."
if [ -d "dist/linux-unpacked" ]; then
  echo "  ✓ Linux unpacked build found"
  ls -lh dist/linux-unpacked/surfboard 2>/dev/null || true
fi

if [ -f "dist/Surfboard-*.AppImage" ]; then
  echo "  ✓ AppImage found:"
  ls -lh dist/Surfboard-*.AppImage
fi

if [ -f "dist/*.deb" ]; then
  echo "  ✓ .deb package found:"
  ls -lh dist/*.deb
fi

echo "[3/3] Generating build metadata..."
cat > dist/build-info.json <<EOF
{
  "version": "$VERSION",
  "channel": "$CHANNEL",
  "gitSha": "$GIT_SHA",
  "buildDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "nodeVersion": "$(node -v)",
  "electronVersion": "$(node -p "require('./node_modules/electron/package.json').version")"
}
EOF

echo ""
echo "✅ Build complete: $BUILD_ID"
echo "   Artifacts in: $(pwd)/dist/"
