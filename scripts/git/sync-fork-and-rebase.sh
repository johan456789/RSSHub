#!/usr/bin/env bash
set -euo pipefail

REPO=""
BASE_BRANCH="master"
FEATURE_BRANCH="myfork"
REMOTE="origin"

usage() {
    cat <<'EOF'
Sync fork and rebase branch.

Usage:
  scripts/git/sync-fork-and-rebase.sh [options]

Options:
  --repo <owner/repo>       GitHub repo for `gh repo sync` (default: auto-detect from remote URL)
  --base-branch <name>      Branch to sync and fast-forward locally (default: master)
  --feature-branch <name>   Branch to rebase onto base branch (default: myfork)
  --remote <name>           Git remote name (default: origin)
  -h, --help                Show this help

Example:
  scripts/git/sync-fork-and-rebase.sh --repo johan456789/RSSHub
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

detect_repo_from_remote() {
    local remote_url
    remote_url="$(git remote get-url "$REMOTE" 2>/dev/null || true)"

    if [[ -z "$remote_url" ]]; then
        fail "cannot detect repo from remote '$REMOTE'; set --repo explicitly"
    fi

    if [[ "$remote_url" =~ github\.com[:/]([^/]+)/([^/.]+)(\.git)?$ ]]; then
        echo "${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
        return 0
    fi

    fail "remote '$REMOTE' is not a GitHub URL; set --repo explicitly"
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --repo)
            [[ $# -ge 2 ]] || fail "--repo requires a value"
            REPO="$2"
            shift 2
            ;;
        --base-branch)
            [[ $# -ge 2 ]] || fail "--base-branch requires a value"
            BASE_BRANCH="$2"
            shift 2
            ;;
        --feature-branch)
            [[ $# -ge 2 ]] || fail "--feature-branch requires a value"
            FEATURE_BRANCH="$2"
            shift 2
            ;;
        --remote)
            [[ $# -ge 2 ]] || fail "--remote requires a value"
            REMOTE="$2"
            shift 2
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

require_cmd git
require_cmd gh

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "must run inside a git repository"
gh auth status >/dev/null 2>&1 || fail "gh is not authenticated; run: gh auth login"
git remote get-url "$REMOTE" >/dev/null 2>&1 || fail "remote '$REMOTE' does not exist"
git show-ref --verify --quiet "refs/heads/$BASE_BRANCH" || fail "local branch '$BASE_BRANCH' does not exist"
git show-ref --verify --quiet "refs/heads/$FEATURE_BRANCH" || fail "local branch '$FEATURE_BRANCH' does not exist"

if [[ -z "$REPO" ]]; then
    REPO="$(detect_repo_from_remote)"
fi

if [[ -n "$(git status --porcelain)" ]]; then
    fail "working tree is not clean; commit or stash changes first"
fi

echo "Syncing fork branch '$BASE_BRANCH' for '$REPO'..."
gh repo sync "$REPO" -b "$BASE_BRANCH"

echo "Fetching '$REMOTE/$BASE_BRANCH'..."
git fetch "$REMOTE" "$BASE_BRANCH"

echo "Fast-forwarding local '$BASE_BRANCH'..."
git checkout "$BASE_BRANCH"
git merge --ff-only "$REMOTE/$BASE_BRANCH"

echo "Rebasing '$FEATURE_BRANCH' onto '$BASE_BRANCH'..."
git checkout "$FEATURE_BRANCH"
git rebase "$BASE_BRANCH"

echo "Done."
echo "Next step (if needed): git push --force-with-lease $REMOTE $FEATURE_BRANCH"
