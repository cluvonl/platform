#!/usr/bin/env bash

set -euo pipefail

REMOTE="${REMOTE:-origin}"
TARGET_SHA="${1:-}"
REPOSITORY="${REPOSITORY:-}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || fail "Voer dit uit vanuit de Cluvo Git-repository."

command -v gh >/dev/null 2>&1 \
  || fail "GitHub CLI ontbreekt."

[[ -n "$TARGET_SHA" ]] \
  || fail "Gebruik: scripts/promote-staging.sh <groene-main-sha>"

git fetch --prune "$REMOTE" main

TARGET_SHA="$(git rev-parse "${TARGET_SHA}^{commit}")"
MAIN_REF="refs/remotes/${REMOTE}/main"

git merge-base --is-ancestor "$TARGET_SHA" "$MAIN_REF" \
  || fail "De opgegeven commit zit niet in origin/main."

if [[ -z "$REPOSITORY" ]]; then
  REPOSITORY="$(
    gh repo view \
      --json nameWithOwner \
      --jq '.nameWithOwner'
  )"
fi

[[ "$REPOSITORY" == "cluvonl/platform" ]] \
  || fail "Onverwachte GitHub-repository: $REPOSITORY"

CI_JSON="$(
  gh run list \
    --repo "$REPOSITORY" \
    --workflow ci.yml \
    --commit "$TARGET_SHA" \
    --event push \
    --limit 10 \
    --json databaseId,headSha,status,conclusion
)"

CI_FIELDS="$(
  TARGET_SHA="$TARGET_SHA" \
  CI_JSON="$CI_JSON" \
  python3 - <<'PY'
import json
import os

target = os.environ["TARGET_SHA"]
runs = json.loads(os.environ["CI_JSON"])

for run in runs:
    if run.get("headSha") == target:
        print(
            run.get("databaseId", ""),
            run.get("headSha", ""),
            run.get("status", ""),
            run.get("conclusion", ""),
            sep="\t",
        )
        break
PY
)"

[[ -n "$CI_FIELDS" ]] \
  || fail "Geen CI-pushrun gevonden voor $TARGET_SHA."

IFS=$'\t' read -r \
  CI_RUN_ID \
  CI_SHA \
  CI_STATUS \
  CI_CONCLUSION \
  <<< "$CI_FIELDS"

[[ "$CI_SHA" == "$TARGET_SHA" ]] \
  || fail "De gevonden CI-run hoort niet bij de doel-SHA."

if [[ "$CI_STATUS" != "completed" ]]; then
  fail "CI-run $CI_RUN_ID is nog niet voltooid: $CI_STATUS."
fi

if [[ "$CI_CONCLUSION" != "success" ]]; then
  fail "CI-run $CI_RUN_ID is niet groen: $CI_CONCLUSION."
fi

echo "Groene CI bevestigd:"
echo "  repository: $REPOSITORY"
echo "  run:        $CI_RUN_ID"
echo "  SHA:        $TARGET_SHA"

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
echo "  huidige staging: ${CURRENT_STAGING:-niet aanwezig}"
echo "  nieuwe SHA:      $TARGET_SHA"
echo "  doel:             refs/heads/staging"

git push "$REMOTE" \
  "$TARGET_SHA:refs/heads/staging"

echo "Staging is exact gepromoveerd naar $TARGET_SHA."
