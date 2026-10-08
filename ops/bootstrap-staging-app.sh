#!/usr/bin/bash
# Public, pinned one-time setup. No credentials or app/database activation.
set -euo pipefail
umask 077

[[ "$EUID" -eq 0 ]] || { echo 'ROOT_PROVISIONING_REQUIRED' >&2; exit 1; }
[[ "$#" -eq 0 || ( "$#" -eq 2 && "$1" == '--runner-user' ) ]] || {
  echo 'Usage: bootstrap-staging-app.sh [--runner-user EXISTING_ACCOUNT]' >&2
  exit 64
}

readonly cluvo_source_sha='bce2a3fde617863cd0a46d047e7982f331a91296'
readonly cluvo_manifest_sha='e07567168cedde61206ca697c9457464a18db3854241e0eb9b3c56baf5bf3bfc'
/usr/bin/python3 -I - <<'PY'
import os
import stat
import sys

try:
    for path in ('/', '/var', '/var/lib', '/var/lib/cluvo-staging'):
        info = os.lstat(path)
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise ValueError()
except Exception:
    raise SystemExit('UNTRUSTED_STAGING_INSTALL_DIRECTORY') from None
PY

cluvo_bundle_dir="$(/usr/bin/mktemp -d /var/lib/cluvo-staging/bootstrap-XXXXXXXXXX)"
readonly cluvo_bundle_dir

for cluvo_file in cluvo-deploy-staging compose.staging.yml cluvo-import-staging-config install-staging-app-broker; do
  /usr/bin/curl --proto '=https' --proto-redir '=https' --tlsv1.2 \
    --fail --silent --show-error --location --connect-timeout 15 --max-time 60 \
    "https://raw.githubusercontent.com/cluvonl/platform/$cluvo_source_sha/ops/$cluvo_file" \
    --output "$cluvo_bundle_dir/$cluvo_file"
done

cat > "$cluvo_bundle_dir/bootstrap-manifest.json" <<'CLUVO_PUBLIC_MANIFEST'
{"contains_credentials":false,"files":{"cluvo-deploy-staging":{"repo_path":"ops/cluvo-deploy-staging","sha256":"e1c66fd7fbb04543b3ae7b262e3bd6a9c57993ac30bffc8098bcc53f4bbaa901"},"cluvo-import-staging-config":{"repo_path":"ops/cluvo-import-staging-config","sha256":"c8f473695c82f6271aaa2897dff661759f2289c1d6449e914356cd3a5496d185"},"compose.staging.yml":{"repo_path":"ops/compose.staging.yml","sha256":"a45262ba3a499539c4739358f582e15f183e1815948d553bcb30494e6edb96a5"},"install-staging-app-broker":{"repo_path":"ops/install-staging-app-broker","sha256":"cbb1df51b6c9ee17acbc20c87bb45294e5435a1a7964452cf97c9cc41dfb882e"}},"format":"cluvo-public-staging-server-bootstrap","origin":"https://staging.cluvo.nl","production_enabled":false,"project_ref":"fbozlbgmktkgcdfqdaaz","source_sha":"bce2a3fde617863cd0a46d047e7982f331a91296"}
CLUVO_PUBLIC_MANIFEST

printf '%s  %s\n' 'cbb1df51b6c9ee17acbc20c87bb45294e5435a1a7964452cf97c9cc41dfb882e' "$cluvo_bundle_dir/install-staging-app-broker" \
  | /usr/bin/sha256sum --check --status
printf '%s  %s\n' "$cluvo_manifest_sha" "$cluvo_bundle_dir/bootstrap-manifest.json" \
  | /usr/bin/sha256sum --check --status

/usr/bin/python3 -I "$cluvo_bundle_dir/install-staging-app-broker" \
  --source-sha "$cluvo_source_sha" --bundle-directory "$cluvo_bundle_dir" \
  --manifest-sha256 "$cluvo_manifest_sha" "$@"
