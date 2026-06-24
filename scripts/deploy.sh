#!/usr/bin/env bash
set -euo pipefail

# Example:
# bash scripts/deploy.sh --nas-host hz.jc-times.com --nas-user zzzsaft

NAS_HOST="hz.jc-times.com"
SSH_PORT="24"
NAS_USER="zzzsaft"
REMOTE_APP_DIR="/volume1/docker/xftech"
BUILD_COMMAND="npm run build"
CONTAINER_NAME=""
SKIP_BUILD="false"
PREFLIGHT="false"
LEGACY_SCP="true"
NO_SSH_MULTIPLEX="false"

usage() {
  cat <<'EOF'
Usage: bash scripts/deploy.sh [options]

Options:
  --nas-host <host>            NAS host. Default: hz.jc-times.com
  --ssh-port <port>            SSH port. Default: 24
  --nas-user <user>            SSH user. Default: zzzsaft
  --remote-app-dir <path>      Remote app directory. Default: /volume1/docker/xftech
  --build-command <command>    Local build command. Default: npm run build
  --container-name <name>      Docker container to restart after deploy.
  --skip-build                 Skip local build.
  --preflight                  Check remote prerequisites before deploying.
  --legacy-scp <true|false>    Add scp -O for legacy SCP mode. Default: true
  --no-ssh-multiplex           Disable SSH connection reuse.
  -h, --help                   Show this help.
EOF
}

require_value() {
  local name="$1"
  local value="$2"

  if [[ -z "${value// }" ]]; then
    echo "Missing ${name}. Edit scripts/deploy.sh or pass --${name} when running deploy." >&2
    exit 1
  fi
}

require_command() {
  local name="$1"

  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Command '${name}' was not found. Install/enable it first and try again." >&2
    exit 1
  fi
}

shell_quote() {
  printf "'%s'" "$(printf "%s" "$1" | sed "s/'/'\\\\''/g")"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --nas-host)
      NAS_HOST="${2:-}"
      shift 2
      ;;
    --ssh-port)
      SSH_PORT="${2:-}"
      shift 2
      ;;
    --nas-user)
      NAS_USER="${2:-}"
      shift 2
      ;;
    --remote-app-dir)
      REMOTE_APP_DIR="${2:-}"
      shift 2
      ;;
    --build-command)
      BUILD_COMMAND="${2:-}"
      shift 2
      ;;
    --container-name)
      CONTAINER_NAME="${2:-}"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD="true"
      shift
      ;;
    --preflight)
      PREFLIGHT="true"
      shift
      ;;
    --legacy-scp)
      LEGACY_SCP="${2:-}"
      shift 2
      ;;
    --no-ssh-multiplex)
      NO_SSH_MULTIPLEX="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_value "nas-host" "$NAS_HOST"
require_value "nas-user" "$NAS_USER"
require_value "remote-app-dir" "$REMOTE_APP_DIR"
require_command "ssh"
require_command "scp"
require_command "tar"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$PROJECT_ROOT/dist"
PACKAGE_DIR="$PROJECT_ROOT/.dist"
ARCHIVE_PATH="$PACKAGE_DIR/dist.tar.gz"
REMOTE_SCRIPT_LOCAL_PATH="$PACKAGE_DIR/remote-deploy.sh"
TARGET="${NAS_USER}@${NAS_HOST}"
REMOTE_ARCHIVE="${REMOTE_APP_DIR}/dist.tar.gz"
REMOTE_SCRIPT_PATH="${REMOTE_APP_DIR}/.deploy-remote.sh"

mkdir -p "$PACKAGE_DIR"
cd "$PROJECT_ROOT"

SSH_BASE_ARGS=(-p "$SSH_PORT")
SCP_BASE_ARGS=(-P "$SSH_PORT")
SSH_MULTIPLEX_STARTED="false"
SAFE_CONTROL_NAME="$(printf "%s_%s_%s" "$NAS_USER" "$NAS_HOST" "$SSH_PORT" | sed 's/[^a-zA-Z0-9_.-]/_/g')"
SSH_CONTROL_PATH="$PACKAGE_DIR/ssh-${SAFE_CONTROL_NAME}.sock"

cleanup() {
  if [[ "$SSH_MULTIPLEX_STARTED" == "true" ]]; then
    ssh "${SSH_BASE_ARGS[@]}" -O exit "$TARGET" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "$NO_SSH_MULTIPLEX" != "true" ]]; then
  echo "Opening reusable SSH connection..."
  SSH_BASE_ARGS=(
    -p "$SSH_PORT"
    -o "ControlMaster=auto"
    -o "ControlPath=$SSH_CONTROL_PATH"
    -o "ControlPersist=10m"
  )
  SCP_BASE_ARGS=(
    -P "$SSH_PORT"
    -o "ControlMaster=auto"
    -o "ControlPath=$SSH_CONTROL_PATH"
    -o "ControlPersist=10m"
  )

  if ssh "${SSH_BASE_ARGS[@]}" -MNf "$TARGET"; then
    SSH_MULTIPLEX_STARTED="true"
  else
    echo "Warning: Could not open reusable SSH connection. Continuing without SSH multiplexing." >&2
    SSH_BASE_ARGS=(-p "$SSH_PORT")
    SCP_BASE_ARGS=(-P "$SSH_PORT")
  fi
fi

if [[ "$PREFLIGHT" == "true" ]]; then
  echo "Checking remote prerequisites..."
  ssh "${SSH_BASE_ARGS[@]}" "$TARGET" "APP_DIR=$(shell_quote "$REMOTE_APP_DIR") sh -s" <<'REMOTE_PREFLIGHT'
FAILED=0

check() {
  LABEL="$1"
  shift
  if "$@"; then
    echo "[OK] $LABEL"
  else
    echo "[FAIL] $LABEL" >&2
    FAILED=1
  fi
}

check "tar is available" command -v tar
check "remote app directory exists: $APP_DIR" test -d "$APP_DIR"
check "remote app directory is writable: $APP_DIR" test -w "$APP_DIR"

if [ "$FAILED" -ne 0 ]; then
  echo "Remote preflight failed. Fix the failed item(s), then rerun deploy." >&2
  exit 1
fi

echo "Remote preflight ok."
REMOTE_PREFLIGHT
fi

if [[ "$SKIP_BUILD" != "true" ]]; then
  echo "Building project..."
  bash -lc "$BUILD_COMMAND"
fi

if [[ ! -d "$DIST_DIR" ]]; then
  echo "Build directory not found: $DIST_DIR" >&2
  exit 1
fi

rm -f "$ARCHIVE_PATH"

echo "Compressing dist..."
tar -czf "$ARCHIVE_PATH" -C "$DIST_DIR" .

echo "Uploading archive to $TARGET..."
SCP_ARGS=()
if [[ "$LEGACY_SCP" == "true" ]]; then
  SCP_ARGS+=(-O)
fi
scp "${SCP_ARGS[@]}" "${SCP_BASE_ARGS[@]}" "$ARCHIVE_PATH" "${TARGET}:${REMOTE_ARCHIVE}" || {
  echo "Failed to upload archive to $TARGET. If the remote login works but upload fails, try passing --legacy-scp false." >&2
  exit 1
}

RESTART_BLOCK=""
if [[ -n "${CONTAINER_NAME// }" ]]; then
  QUOTED_CONTAINER_NAME="$(shell_quote "$CONTAINER_NAME")"
  RESTART_BLOCK=$(cat <<EOF
if command -v docker >/dev/null 2>&1; then
  docker restart $QUOTED_CONTAINER_NAME
elif [ -x /usr/local/bin/docker ]; then
  /usr/local/bin/docker restart $QUOTED_CONTAINER_NAME
else
  echo "Docker command was not found, skipped container restart: $CONTAINER_NAME" >&2
fi
EOF
)
fi

QUOTED_REMOTE_APP_DIR="$(shell_quote "$REMOTE_APP_DIR")"
QUOTED_REMOTE_ARCHIVE="$(shell_quote "$REMOTE_ARCHIVE")"
QUOTED_REMOTE_SCRIPT_PATH="$(shell_quote "$REMOTE_SCRIPT_PATH")"

cat > "$REMOTE_SCRIPT_LOCAL_PATH" <<EOF
set -eu

APP_DIR=$QUOTED_REMOTE_APP_DIR
ARCHIVE=$QUOTED_REMOTE_ARCHIVE
STAMP=\$(date +%Y%m%d-%H%M%S)
BACKUP_ROOT=".deploy-backup"
BACKUP_DIR="\$BACKUP_ROOT/xftech-\$STAMP"
RELEASE_DIR=".deploy-release-\$STAMP"
RELEASE_LIST=".deploy-release-items-\$STAMP"

cd "\$APP_DIR"
mkdir -p "\$BACKUP_DIR" "\$RELEASE_DIR"

for item in index.html assets nginx.conf; do
  if [ -e "\$item" ]; then
    cp -a "\$item" "\$BACKUP_DIR/"
  fi
done

restore_backup() {
  if [ -f "\$RELEASE_LIST" ]; then
    ITEMS=\$(cat "\$RELEASE_LIST")
  else
    ITEMS="index.html assets nginx.conf"
  fi

  for item in \$ITEMS; do
    rm -rf "\$item"
    if [ -e "\$BACKUP_DIR/\$item" ]; then
      cp -a "\$BACKUP_DIR/\$item" .
    fi
  done
}

if ! tar -xzf "\$ARCHIVE" -C "\$RELEASE_DIR"; then
  restore_backup
  rm -rf "\$RELEASE_DIR"
  echo "Deploy failed while extracting archive. Previous files were restored." >&2
  exit 1
fi

find "\$RELEASE_DIR" -mindepth 1 -maxdepth 1 -exec basename {} \; > "\$RELEASE_LIST"

for name in \$(cat "\$RELEASE_LIST"); do
  rm -rf "\$name"
  if ! mv "\$RELEASE_DIR/\$name" .; then
    restore_backup
    rm -rf "\$RELEASE_DIR"
    rm -f "\$RELEASE_LIST"
    echo "Deploy failed while moving release files. Previous files were restored." >&2
    exit 1
  fi
done

rm -rf "\$RELEASE_DIR"
rm -f "\$RELEASE_LIST"
rm -f "\$ARCHIVE"
rm -f $QUOTED_REMOTE_SCRIPT_PATH

$RESTART_BLOCK

echo "Deploy finished. Backup saved to: \$APP_DIR/\$BACKUP_DIR"
EOF

echo "Uploading remote deploy script..."
SCRIPT_SCP_ARGS=()
if [[ "$LEGACY_SCP" == "true" ]]; then
  SCRIPT_SCP_ARGS+=(-O)
fi
scp "${SCRIPT_SCP_ARGS[@]}" "${SCP_BASE_ARGS[@]}" "$REMOTE_SCRIPT_LOCAL_PATH" "${TARGET}:${REMOTE_SCRIPT_PATH}" || {
  echo "Failed to upload remote deploy script to $TARGET." >&2
  exit 1
}

echo "Replacing static files..."
ssh "${SSH_BASE_ARGS[@]}" "$TARGET" "sh $(shell_quote "$REMOTE_SCRIPT_PATH")" || {
  echo "Remote deploy failed." >&2
  exit 1
}

echo "Done."
