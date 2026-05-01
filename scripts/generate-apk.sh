#!/bin/bash
# Generate Android APK using EAS Build

set -e

echo "📱 Gerando APK Android..."

cd apps/mobile

# Check EAS CLI
if ! command -v eas &> /dev/null; then
  echo "Instalando EAS CLI..."
  npm install -g eas-cli
fi

# Build APK (development)
eas build --platform android --profile preview --local

echo "✅ APK gerado com sucesso!"
