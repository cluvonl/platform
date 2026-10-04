#!/usr/bin/env bash

set -euo pipefail

REMOTE="${REMOTE:-origin}"
TARGET_SHA="${1:-}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || fail "Voer dit uit vanuit de Cluvo Git-repository."

[[ -n "$TARGET_SHA" ]] \
  || fail "Gebruik: scripts/promote-staging.sh <groene-main-sha>"

git fetch --prune "$REMOTE" main

TARGET_SHA="$(git rev-parse "${TARGET_SHA}^{commit}")"
MAIN_REF="refs/remotes/${REMOTE}/main"

git merge-base --is-ancestor "$TARGET_SHA" "$MAIN_REF" \
  || fail "De opgegeven commit zit niet in origin/main."

if git ls-remote \
  --exit-code \
  --heads \
  "$REMOTE" \
  staging >/dev/null 2>&1
then
  git fetch "$REMOTE" \
    +refs/heads/staging:refs/remotes/"$REMOTE"/staging

  STAGING_REF="refs/remotes/${REMOTE}/staging"
  CURRENT_STAGING="$(git rev-parse "$STAGING_REF")"

  if [[ "$CURRENT_STAGING" == "$TARGET_SHA" ]]; then
    echo "Staging wijst al naar $TARGET_SHA."
    exit 0
  fi

  git merge-base --is-ancestor "$CURRENT_STAGING" "$TARGET_SHA" \
    || fail "Staging is afgedivergeerd; niet automatisch forceren."
else
  echo "Staging bestaat nog niet en wordt aangemaakt."
fi

echo "Promotie:"
echo "  main SHA: $TARGET_SHA"
echo "  doel:     refs/heads/staging"

git push "$REMOTE" \
  "$TARGET_SHA:refs/heads/staging"

echo "Staging is exact gepromoveerd naar $TARGET_SHA."
