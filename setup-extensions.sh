#!/bin/bash
# Usage:
# ./setup-extensions.sh [--force]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXTENSIONS_DIR="${HOME}/.config/riced-chromium/extensions"

# Parse flags
FORCE=0
if [[ "$1" == "--force" ]]; then
    FORCE=1
fi

# Extension sources
ORIGINAL_SAMPLE_DIR="${SCRIPT_DIR}/sample-extension"
BROWSER_NATIVE_PLATFORM_DIR="${SCRIPT_DIR}/sample-extension/browser-native-platform"

echo -e "\033[0;34mSetting up Rice Chromium extensions...\033[0m"

# Create sourceExtensions wrapper
sourceExtensions() {
    echo "Scanning ${EXTENSIONS_DIR}"
    ls -l "${EXTENSIONS_DIR}" 2>/dev/null || true
}

# Create default extensions dir if absent
if [[ ! -d "${EXTENSIONS_DIR}" ]]; then
    echo "Creating ${EXTENSIONS_DIR}"
    mkdir -pv "${EXTENSIONS_DIR}"
fi

# Symlink video-speed-controller extension (use absolute path to avoid broken relative symlinks)
VSC_NAME="video-speed-controller"
VSC_LINK="${EXTENSIONS_DIR}/${VSC_NAME}"
VSC_SOURCE="${ORIGINAL_SAMPLE_DIR}/${VSC_NAME}"
if [[ ! -e "${VSC_LINK}" || "${FORCE}" -eq 1 ]]; then
    echo "Symlinking video-speed-controller extension"
    rm -f "${VSC_LINK}" 2>/dev/null
    ln -sfv "${VSC_SOURCE}" "${VSC_LINK}"
else
    echo "Video-speed-controller extension already present: ${VSC_LINK}"
fi

# Copy browser-native-platform extension (symlink causes circular refs)
BNP_NAME="browser-native-platform"
BNP_LINK="${EXTENSIONS_DIR}/${BNP_NAME}"
if [[ ! -e "${BNP_LINK}" || "${FORCE}" -eq 1 ]]; then
    echo "Copying browser-native-platform extension"
    rm -rf "${BNP_LINK}" 2>/dev/null
    cp -rf "${BROWSER_NATIVE_PLATFORM_DIR}" "${BNP_LINK}"
else
    echo "Browser-native-platform extension already present: ${BNP_LINK}"
fi

# Symlink ublock-origin extension (use absolute path)
UBO_NAME="ublock-origin"
UBO_LINK="${EXTENSIONS_DIR}/${UBO_NAME}"
UBO_SOURCE="${SCRIPT_DIR}/sample-extension/${UBO_NAME}"
if [[ -d "${UBO_SOURCE}" ]]; then
    if [[ ! -e "${UBO_LINK}" || "${FORCE}" -eq 1 ]]; then
        echo "Symlinking ublock-origin extension"
        rm -f "${UBO_LINK}" 2>/dev/null
        ln -sfv "${UBO_SOURCE}" "${UBO_LINK}"
    else
        echo "uBlock Origin extension already present: ${UBO_LINK}"
    fi
else
    echo "uBlock Origin source not found at ${UBO_SOURCE}, skipping"
fi

# Remove stale circular symlink from previous broken setups
STALE_LINK="${EXTENSIONS_DIR}/sample-extension"
if [[ -L "${STALE_LINK}" ]]; then
    echo "Removing stale circular sample-extension symlink"
    rm -f "${STALE_LINK}"
fi

# Show final state
echo
echo "Installed extensions:"
sourceExtensions
echo -e "\033[0;32mExtension setup complete\033[0m"
