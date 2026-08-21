#!/bin/bash

# Salesforce Comet Packaging Script
# This script creates a valid zip package for the Chrome extension.

set -e

PACKAGE_NAME="salesforce-arc-extension.zip"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📦 Packaging Salesforce Comet extension..."

# Navigate to project directory
cd "$PROJECT_DIR"

# Remove existing package if it exists
if [ -f "$PACKAGE_NAME" ]; then
    rm "$PACKAGE_NAME"
fi

# Run build script to obfuscate and copy files
echo "⚙️ Building and obfuscating files..."
npm install
node build.js

# Create the zip file from dist/
# -r: recursive
# -9: maximum compression
cd dist
zip -r9 "../$PACKAGE_NAME" . \
    -x "*.DS_Store" \
    -x "__MACOSX" \
    -x "*.bak*"

cd ..

VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)
VERSIONED_NAME="salesforce-arc-extension-v${VERSION}.zip"
cp "$PACKAGE_NAME" "$VERSIONED_NAME"

echo "✅ Package created successfully: $PACKAGE_NAME and $VERSIONED_NAME"
echo "🔍 Verifying structure..."

# Verify the package has exactly one manifest, at its root.
MANIFEST_COUNT=$(unzip -Z1 "$PACKAGE_NAME" | grep -cx "manifest.json" || true)
if [ "$MANIFEST_COUNT" -ne 1 ]; then
    echo "❌ Package must contain exactly one root manifest.json"
    exit 1
fi

echo "🚀 Production release packages ready for upload!"
