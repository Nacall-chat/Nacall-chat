#!/usr/bin/env bash
# Assina o NACALL.app sem certificado (ad-hoc) e gera um .dmg por arquitetura.
# Sem assinatura nenhuma o macOS diz que o app "está danificado"; com a ad-hoc ele só
# avisa que é de desenvolvedor não identificado (abrir pelo botão direito > Abrir).
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(node -p "require('./package.json').version")
made=0
for pair in "mac-arm64:arm64" "mac:x64"; do
  dir="dist/${pair%%:*}"; arch="${pair##*:}"; app="$dir/NACALL.app"
  [ -d "$app" ] || { echo "faltou $app"; continue; }
  codesign --force --deep --sign - "$app"
  codesign --verify --deep --strict --verbose=2 "$app"
  lipo -archs "$app/Contents/MacOS/NACALL"
  stage=$(mktemp -d)
  cp -R "$app" "$stage/"
  ln -s /Applications "$stage/Applications"
  hdiutil create -volname "NACALL" -srcfolder "$stage" -ov -format UDZO "dist/NACALL-${version}-${arch}.dmg"
  rm -rf "$stage"
  shasum -a 256 "dist/NACALL-${version}-${arch}.dmg" | tee "dist/NACALL-${version}-${arch}.dmg.sha256"
  made=$((made+1))
done
[ "$made" -eq 2 ] || { echo "esperava 2 .dmg, saíram $made"; exit 1; }
