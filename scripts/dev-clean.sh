#!/usr/bin/env bash
# Clear stale Next cache (fixes API still pointing at localhost:5000)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
rm -rf "$ROOT/.next" "$ROOT/navbar-landing/.next" 2>/dev/null || true
echo "Cleared .next caches. Start backend (port 5001) then: npm run dev"
