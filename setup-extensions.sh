#!/bin/bash
# Usage:
# ./setup-extensions.sh [--force]

SCRIPT_DIR="$(dirname "$0")"
EXTENSIONS_DIR="${HOME}/.config/riced-chromium/extensions"
SAMPLE_DIR="${SCRIPT_DIR}/sample-extension"

# Parse flags
FORCE=0
if [[ "$1" == "--force" ]]; then
 FORCE=1
fi

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

# Symlink sample extension
SAMPLE_NAME="$(basename "${SAMPLE_DIR}")"
SAMPLE_LINK="${EXTENSIONS_DIR}/${SAMPLE_NAME}"

if [[ ! -e "${SAMPLE_LINK}" || "${FORCE}" -eq 1 ]]; then
 echo "Symlinking sample extension"
 rm -f "${SAMPLE_LINK}" 2>/dev/null
 ln -sfv "${SAMPLE_DIR}" "${SAMPLE_LINK}"
else
 echo "Sample extension link already present: ${SAMPLE_LINK}"
fi

# Show final state
sourceExtensions

echo -e "\033[0;32mExtension setup complete\033[0m"