#!/usr/bin/env bash
#
# Authorship guard: fails if any commit in the inspected range carries AI
# co-authorship or generation attribution. Enforces the repository's policy of
# sole human authorship with no AI attribution (see CONTRIBUTING.md).
#
# Inspects commit MESSAGES only (not files), so documentation that describes the
# forbidden patterns does not trip the guard.
#
# Driven by environment variables set in ci.yml:
#   EVENT_NAME, PR_BASE_SHA, PR_HEAD_SHA, PUSH_BEFORE, PUSH_AFTER
set -euo pipefail

EVENT_NAME="${EVENT_NAME:-}"
ZERO_SHA="0000000000000000000000000000000000000000"
range=""

if [ "$EVENT_NAME" = "pull_request" ]; then
  if [ -n "${PR_BASE_SHA:-}" ] && [ -n "${PR_HEAD_SHA:-}" ]; then
    range="${PR_BASE_SHA}..${PR_HEAD_SHA}"
  fi
elif [ "$EVENT_NAME" = "push" ]; then
  if [ -n "${PUSH_BEFORE:-}" ] && [ "${PUSH_BEFORE}" != "$ZERO_SHA" ]; then
    range="${PUSH_BEFORE}..${PUSH_AFTER:-HEAD}"
  fi
fi

if [ -n "$range" ]; then
  messages="$(git log --no-merges --format='%H%n%B%n----' "$range" || true)"
else
  # First push (no "before" SHA) or local run: inspect the tip commit only.
  messages="$(git log --no-merges -1 --format='%H%n%B%n----' HEAD || true)"
fi

if [ -z "${messages//[$'\n\t ']/}" ]; then
  echo "Authorship guard: no commits to inspect."
  exit 0
fi

fail=0

flag() {
  echo "::error::Authorship guard: found $1 in a commit message."
  fail=1
}

# "Co-Authored-By:" trailer crediting Claude (any casing/spacing).
if printf '%s' "$messages" | grep -Eiq 'co-authored-by:.*claude'; then
  flag "a 'Co-Authored-By: Claude' trailer"
fi

# "Generated with ..." attribution lines.
if printf '%s' "$messages" | grep -Eiq 'generated with'; then
  flag "a 'Generated with' attribution"
fi

# Robot emoji (U+1F916), matched by its UTF-8 byte sequence to avoid embedding it.
if printf '%s' "$messages" | grep -q $'\xf0\x9f\xa4\x96'; then
  flag "the robot emoji"
fi

if [ "$fail" -ne 0 ]; then
  echo "Remove the AI attribution from the offending commit(s) and re-push."
  exit 1
fi

echo "Authorship guard passed: no AI attribution found."
