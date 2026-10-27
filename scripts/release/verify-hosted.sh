#!/usr/bin/env bash
#
# Waits until the hosted server reports the given version on /healthz, then
# checks what a client sees before it has a token: the server card and the
# OAuth challenge. Uses public endpoints only.
#
#   scripts/release/verify-hosted.sh 0.6.0        # waits up to WAIT_MINUTES (default 60)
set -euo pipefail

version="${1:?version required}"
hosted="${HOSTED_URL:-https://api.drumbeats.io/mcp}"
deadline=$(($(date +%s) + ${WAIT_MINUTES:-60} * 60))

live=""
while :; do
  live="$(curl -fsS -m 10 "$hosted/healthz" | jq -r .version 2>/dev/null || true)"
  [ "$live" = "$version" ] && break
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "::error::$hosted/healthz still reports ${live:-nothing}, expected $version. Deploy the hosted server, then re-run this job."
    exit 1
  fi
  echo "Hosted server reports ${live:-nothing}; waiting for $version..."
  sleep 30
done

card="$(curl -fsS -m 10 "$hosted/.well-known/mcp/server-card.json" | jq -r .serverInfo.version)"
[ "$card" = "$version" ] || { echo "::error::Server card reports $card, expected $version."; exit 1; }

challenge="$(curl -s -m 10 -o /dev/null -D - -X POST "$hosted" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | tr -d '\r' | grep -i '^www-authenticate:' || true)"
[[ "$challenge" == *resource_metadata=* ]] || { echo "::error::No OAuth challenge on an unauthenticated call."; exit 1; }

curl -fsS -m 10 "https://api.drumbeats.io/.well-known/oauth-protected-resource/mcp" | jq -e .resource > /dev/null

{
  echo "### Hosted server"
  echo "- $hosted/healthz reports **$live**"
  echo "- Server card and OAuth challenge OK"
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
echo "Hosted server is on $version."
