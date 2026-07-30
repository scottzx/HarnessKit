#!/bin/bash
set -e

export MACOSX_DEPLOYMENT_TARGET=12.0

VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')

echo "==> Building HarnessKit v${VERSION} (macOS ${MACOSX_DEPLOYMENT_TARGET}+)..."

# Signing & notarization status
if [ -n "$APPLE_SIGNING_IDENTITY" ] && [ -n "$APPLE_ID" ] && [ -n "$APPLE_TEAM_ID" ] && [ -n "$APPLE_PASSWORD" ]; then
  echo "    Signing & notarization: enabled (Tauri will handle automatically)"
else
  echo "    Signing & notarization: skipped (set APPLE_SIGNING_IDENTITY, APPLE_ID, APPLE_TEAM_ID, APPLE_PASSWORD to enable)"
fi

# Clean extended attributes (prevents codesign issues on APFS/iCloud volumes)
xattr -cr crates/hk-desktop/icons/ 2>/dev/null || true

# Build for Apple Silicon
echo "==> [1/2] Building for Apple Silicon (aarch64)..."
cargo tauri build --target aarch64-apple-darwin

# Build for Intel
echo "==> [2/2] Building for Intel (x86_64)..."
cargo tauri build --target x86_64-apple-darwin

# Build CLI for both architectures
echo "==> Building CLI (aarch64)..."
cargo build --release --target aarch64-apple-darwin -p hk-cli

echo "==> Building CLI (x86_64)..."
cargo build --release --target x86_64-apple-darwin -p hk-cli

# Output paths
ARM_DMG="target/aarch64-apple-darwin/release/bundle/dmg/HarnessKit_${VERSION}_aarch64.dmg"
X64_DMG="target/x86_64-apple-darwin/release/bundle/dmg/HarnessKit_${VERSION}_x64.dmg"

echo ""
echo "==> Done!"
echo "    Apple Silicon: $ARM_DMG"
echo "    Intel:         $X64_DMG"
echo "    CLI (arm64):   target/aarch64-apple-darwin/release/hk"
echo "    CLI (x64):     target/x86_64-apple-darwin/release/hk"
