#!/bin/bash
# Get test files changed or affected by changes
# Usage: ./scripts/changed-tests.sh [base_ref]

set -euo pipefail

BASE_REF="${1:-origin/main}"
HEAD_REF="${2:-HEAD}"

# Get changed files
CHANGED=$(git diff --name-only "$BASE_REF"..."$HEAD_REF" 2>/dev/null || git diff --name-only "$BASE_REF" 2>/dev/null || echo "")

if [ -z "$CHANGED" ]; then
  echo "No changes detected"
  exit 0
fi

# Direct test file changes
TEST_FILES=$(echo "$CHANGED" | grep '^test/.*\.test\.js$' || true)

# Source file changes -> map to test files
SRC_CHANGES=$(echo "$CHANGED" | grep '^src/' || true)

MAPPED_TESTS=""
if [ -n "$SRC_CHANGES" ]; then
  while IFS= read -r file; do
    basename=$(basename "$file" .js)
    # Check for exact match
    if [ -f "test/${basename}.test.js" ]; then
      MAPPED_TESTS="${MAPPED_TESTS}test/${basename}.test.js\n"
    fi
    # Check for related tests (e.g., src/main/tab-manager.js -> test/tab-*.test.js)
    prefix=$(basename "$file" .js | cut -d'-' -f1)
    if [ -n "$prefix" ]; then
      MAPPED_TESTS="${MAPPED_TESTS}$(ls test/${prefix}*.test.js 2>/dev/null || true)\n"
    fi
  done <<< "$SRC_CHANGES"
fi

# Config/setup changes -> run all tests
CONFIG_CHANGES=$(echo "$CHANGED" | grep -E '(package\.json|jest\.|\.mise\.|test/setup)' || true)
if [ -n "$CONFIG_CHANGES" ]; then
  echo "CONFIG_CHANGED"
  exit 0
fi

# Combine and deduplicate
ALL_TESTS=$(echo -e "${TEST_FILES}\n${MAPPED_TESTS}" | grep -v '^$' | sort -u || true)

if [ -z "$ALL_TESTS" ]; then
  echo "No test files affected"
  exit 0
fi

echo "$ALL_TESTS"
