#!/usr/bin/env bash
# Build Simon.app and a .dmg for Apple-silicon Macs.
#
#   scripts/build-macos.sh            → release/Simon-<version>-arm64.dmg
#
# The bundle carries the Node runtime this machine uses (native modules are built for its ABI),
# the API with production dependencies only, and the built SPA. The shop's data is never inside
# it: it lives in ~/Library/Application Support/Simon.
#
# Signed ad hoc, not notarised. On the Mac that built it, it opens normally; copied to another
# Mac, the first launch needs right-click → Open (see docs/runbook.md).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
BUILD="$(git rev-list --count HEAD 2>/dev/null || echo 1)"
ARCH="$(uname -m)"
NODE_BIN="$(command -v node)"
OUT="$ROOT/release"
STAGE="$OUT/stage"
APP="$OUT/Simon.app"
DMG="$OUT/Simon-${VERSION}-${ARCH}.dmg"

step() { printf '\n==> %s\n' "$*"; }

[ "$(uname)" = "Darwin" ] || { echo "macOS only"; exit 1; }
command -v swiftc >/dev/null || { echo "swiftc not found — install the Xcode command line tools"; exit 1; }

step "Checking the tree"
npm run typecheck >/dev/null
npm run check:prd >/dev/null

step "Building the SPA"
npm run build -w frontend >/dev/null

step "Staging the API with production dependencies only"
rm -rf "$OUT"
mkdir -p "$STAGE"
cp package.json package-lock.json "$STAGE/"
mkdir -p "$STAGE/packages" "$STAGE/frontend" "$STAGE/backend"
cp -R packages/shared "$STAGE/packages/shared"
rm -f "$STAGE"/packages/shared/src/*.test.ts
cp frontend/package.json "$STAGE/frontend/"
cp -R frontend/dist "$STAGE/frontend/dist"
cp backend/package.json backend/prisma.config.ts "$STAGE/backend/"
cp -R backend/prisma backend/scripts "$STAGE/backend/"
# The Prisma client is generated here, in the dev tree, and shipped: the CLI is a dev dependency.
(cd backend && npx prisma generate >/dev/null)
rsync -a --exclude '*.test.ts' --exclude 'test/' backend/src/ "$STAGE/backend/src/"
(
  cd "$STAGE"
  # The frontend workspace is declared but needs nothing at runtime; its dist is already built.
  npm ci --omit=dev --omit=optional --omit=peer --workspace backend --workspace packages/shared --include-workspace-root=false --no-audit --no-fund --loglevel=error
)
rm -rf "$STAGE/node_modules/.cache"
[ -f "$STAGE/backend/src/generated/prisma/client.ts" ] || { echo "Prisma client missing from the bundle"; exit 1; }
[ ! -d "$STAGE/node_modules/prisma" ] || { echo "The Prisma CLI leaked into a production install"; exit 1; }

step "Assembling Simon.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
sed -e "s/__VERSION__/$VERSION/" -e "s/__BUILD__/$BUILD/" desktop/macos/Info.plist > "$APP/Contents/Info.plist"
swiftc -O -target "${ARCH}-apple-macos12.0" -framework AppKit -framework WebKit \
  desktop/macos/main.swift -o "$APP/Contents/MacOS/Simon"
cp "$NODE_BIN" "$APP/Contents/Resources/node"
mv "$STAGE" "$APP/Contents/Resources/app"

step "Icon"
ICONSET="$OUT/Simon.iconset"
mkdir -p "$ICONSET"
node scripts/render-icon.mjs "$OUT/icon-1024.png"
for size in 16 32 128 256 512; do
  sips -z $size $size "$OUT/icon-1024.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z $double $double "$OUT/icon-1024.png" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/Simon.icns"
rm -rf "$ICONSET" "$OUT/icon-1024.png"

step "Signing (ad hoc)"
codesign --force --sign - "$APP/Contents/Resources/node"
find "$APP/Contents/Resources/app/node_modules" -name '*.node' -exec codesign --force --sign - {} \;
codesign --force --sign - "$APP"
codesign --verify "$APP"

step "Disk image"
DMGROOT="$OUT/dmg"
mkdir -p "$DMGROOT"
cp -R "$APP" "$DMGROOT/"
ln -s /Applications "$DMGROOT/Applications"
hdiutil create -quiet -volname "Simon $VERSION" -srcfolder "$DMGROOT" -ov -format UDZO "$DMG"
rm -rf "$DMGROOT"

step "Done"
du -sh "$APP" "$DMG" | sed 's|'"$ROOT"'/||'
echo "Open: open \"$DMG\""
