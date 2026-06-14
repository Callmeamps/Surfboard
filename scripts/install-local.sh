#!/usr/bin/env bash
set -euo pipefail

# Install Surfboard locally from build artifacts
# Usage: ./scripts/install-local.sh [--stable|--edge]

CHANNEL="${1:-stable}"
INSTALL_DIR="$HOME/.local/share/surfboard"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"

echo "══════════════════════════════════════════════════"
echo "  Surfboard Local Installation"
echo "  Channel: ${CHANNEL}"
echo "══════════════════════════════════════════════════"

# Ensure directories exist
mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$DESKTOP_DIR"

# Find the built AppImage or unpacked binary
APPIMAGE=$(ls -t dist/Surfboard-*.AppImage 2>/dev/null | head -1)
UNPACKED="dist/linux-unpacked/surfboard"

if [ -f "$APPIMAGE" ]; then
  echo "[1/3] Installing AppImage..."
  cp -f "$APPIMAGE" "$INSTALL_DIR/surfboard"
  chmod +x "$INSTALL_DIR/surfboard"
  
  # Create wrapper for AppImage
  cat > "$BIN_DIR/surfboard" <<'EOF'
#!/bin/bash
# Surfboard launcher - auto-detects Wayland/X11
export ELECTRON_DISABLE_SANDBOX=1
export OZONE_PLATFORM_HINT=auto
exec "$HOME/.local/share/surfboard/surfboard" "$@"
EOF
  
  # Edge build alternative
  if [ "$CHANNEL" = "edge" ]; then
    cat > "$BIN_DIR/surfboard-edge" <<'EOF'
#!/bin/bash
export ELECTRON_DISABLE_SANDBOX=1
export OZONE_PLATFORM_HINT=auto
exec "$HOME/.local/share/surfboard/surfboard" --dev "$@"
EOF
    chmod +x "$BIN_DIR/surfboard-edge"
    echo "  ✓ Edge launcher: surfboard-edge"
  fi
  
  chmod +x "$BIN_DIR/surfboard"
  echo "  ✓ Installed to: $INSTALL_DIR/surfboard"
  
elif [ -f "$UNPACKED" ]; then
  echo "[1/3] Installing unpacked binary..."
  cp -rf dist/linux-unpacked/* "$INSTALL_DIR/"
  
  cat > "$BIN_DIR/surfboard" <<'EOF'
#!/bin/bash
export ELECTRON_DISABLE_SANDBOX=1
export OZONE_PLATFORM_HINT=auto
exec "$HOME/.local/share/surfboard/surfboard" "$@"
EOF
  chmod +x "$BIN_DIR/surfboard"
  echo "  ✓ Installed unpacked build to: $INSTALL_DIR/"
  
else
  echo "  ✗ No build artifacts found. Run: npm run build"
  exit 1
fi

# Create desktop entry
echo "[2/3] Creating desktop entry..."
cat > "$DESKTOP_DIR/surfboard.desktop" <<EOF
[Desktop Entry]
Name=Surfboard
Comment=A riced Electron-based browser
Exec=$BIN_DIR/surfboard %U
Icon=$INSTALL_DIR/resources/app/icon.png
Type=Application
Categories=Network;WebBrowser;
MimeType=text/html;text/xml;application/xhtml+xml;
Terminal=false
EOF

# Try to update desktop database
update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true

echo "[3/3] Verifying installation..."
if command -v surfboard &> /dev/null; then
  echo "  ✓ surfboard is in PATH: $(which surfboard)"
else
  echo "  ⚠ surfboard may not be in PATH. Add to ~/.bashrc:"
  echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
fi

echo ""
echo "✅ Installation complete!"
echo "   Launch: surfboard"
echo "   Binary: $INSTALL_DIR/surfboard"
