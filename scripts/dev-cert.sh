#!/usr/bin/env bash
# A certificate for the shop's own machine. TLS ships in v1 (§16.6) and the camera needs it (§18).
#
#   scripts/dev-cert.sh [hostname] [lan-ip]
#
# The certificate must then be trusted on each staff device — Android: Settings → Security →
# Install a certificate → CA certificate; iOS: open the .crt, then Settings → General → About →
# Certificate Trust Settings. Without that the till shows a warning every morning and people learn
# to tap through warnings, which is worse than the warning.
set -euo pipefail

host="${1:-simon.local}"
ip="${2:-$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')}"
dir="$(cd "$(dirname "$0")/.." && pwd)/docker/certs"
mkdir -p "$dir"

openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout "$dir/simon.key" -out "$dir/simon.crt" \
  -subj "/CN=$host/O=Simon" \
  -addext "subjectAltName=DNS:$host,DNS:localhost,IP:${ip:-127.0.0.1},IP:127.0.0.1" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,digitalSignature,keyCertSign" 2>/dev/null

chmod 600 "$dir/simon.key"
echo "Wrote $dir/simon.crt and simon.key"
echo "  host: $host    ip: ${ip:-unknown}"
echo "Install simon.crt on every till and phone that will open Simon."
