#!/usr/bin/env bash
# Generates a self-signed certificate for local Docker use (PRJ-SR-001).
# Development only: browsers warn about it. Use a real CA's certificate in production.
#
#   bash scripts/gen-dev-certs.sh           creates certs/fullchain.pem and privkey.pem
#   bash scripts/gen-dev-certs.sh --force   replaces them
set -euo pipefail

CERT_DIR="$(cd "$(dirname "$0")/.." && pwd)/certs"

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is not installed. See \"Run with Docker\" in README.md for a command that uses Docker instead." >&2
  exit 1
fi

mkdir -p "$CERT_DIR"
cd "$CERT_DIR"

# Never overwrite a certificate by accident: it may be a real one.
if [ "${1:-}" != "--force" ] && { [ -e fullchain.pem ] || [ -e privkey.pem ]; }; then
  echo "$CERT_DIR already has a certificate. Use --force to replace it." >&2
  exit 1
fi

# Git Bash would otherwise rewrite "/CN=localhost" into a Windows path. This also
# turns off conversion of file paths, so the names below must stay relative.
export MSYS_NO_PATHCONV=1

openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 365 \
  -keyout privkey.pem -out fullchain.pem \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1 || {
  echo "openssl could not create the certificate. Check that $CERT_DIR is writable." >&2
  exit 1
}

chmod 600 privkey.pem

echo "Created fullchain.pem and privkey.pem in $CERT_DIR (valid for 365 days). Never commit these."
