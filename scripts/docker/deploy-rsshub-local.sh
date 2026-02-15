#!/usr/bin/env bash
set -euo pipefail

PRUNE=1
FLUSH_CACHE=0

usage() {
    cat <<'EOF'
Build and deploy local RSSHub image with docker compose, then optionally prune images.

Usage:
  scripts/docker/deploy-rsshub-local.sh [options]

Options:
  --no-prune      Skip `docker image prune -a -f`
  --flush-cache   Run `redis-cli FLUSHALL` after deploy
  -h, --help      Show this help
EOF
}

fail() {
    echo "Error: $*" >&2
    exit 1
}

require_cmd() {
    local cmd="$1"
    command -v "$cmd" >/dev/null 2>&1 || fail "missing required command: $cmd"
}

has_service() {
    local service="$1"
    grep -Fxq "$service" <<<"$SERVICES"
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-prune)
            PRUNE=0
            shift
            ;;
        --flush-cache)
            FLUSH_CACHE=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            fail "unknown argument: $1"
            ;;
    esac
done

require_cmd docker

echo "[1/6] Building local RSSHub image..."
docker compose build rsshub

echo "[2/6] Recreating rsshub service..."
docker compose up -d --force-recreate rsshub

SERVICES="$(docker compose config --services)"
PULL_SERVICES=()

for service in redis browserless real-browser; do
    if has_service "$service"; then
        PULL_SERVICES+=("$service")
    fi
done

if [[ ${#PULL_SERVICES[@]} -gt 0 ]]; then
    echo "[3/6] Pulling latest helper service images: ${PULL_SERVICES[*]}..."
    docker compose pull "${PULL_SERVICES[@]}"
else
    echo "[3/6] No helper services found to pull."
fi

echo "[4/6] Starting compose services..."
docker compose up -d

if [[ "$FLUSH_CACHE" -eq 1 ]] && has_service redis; then
    echo "[5/6] Flushing Redis cache..."
    docker compose exec -T redis redis-cli FLUSHALL
else
    echo "[5/6] Skipping cache flush."
fi

if [[ "$PRUNE" -eq 1 ]]; then
    echo "[6/6] Pruning unused Docker images..."
    docker image prune -a -f
else
    echo "[6/6] Skipping image prune."
fi

echo "Done."
echo "Current compose status:"
docker compose ps
