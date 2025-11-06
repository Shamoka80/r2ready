#!/usr/bin/env bash

#######################################################################
# GitHub Branch Protection Configuration Script
#######################################################################
#
# PURPOSE:
#   Configures branch protection rules for main and develop branches
#   using GitHub CLI (gh) with exact job IDs from CI workflows.
#
# PREREQUISITES:
#   - GitHub CLI (gh) installed and authenticated
#   - Repository admin permissions
#   - Valid GitHub token with repo scope
#
# USAGE:
#   ./scripts/setup-branch-protection.sh [OWNER/REPO]
#
# EXAMPLES:
#   ./scripts/setup-branch-protection.sh Shamoka80/R2v3APP
#   ./scripts/setup-branch-protection.sh  # Uses current repo
#
# NOTES:
#   - Script uses exact job IDs from .github/workflows/*.yml
#   - Main branch requires 7 status checks
#   - Develop branch requires 3 status checks
#   - Idempotent: safe to run multiple times
#
#######################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v gh &> /dev/null; then
        log_error "GitHub CLI (gh) not found. Install from: https://cli.github.com/"
        exit 1
    fi
    
    if ! gh auth status &> /dev/null; then
        log_error "GitHub CLI not authenticated. Run: gh auth login"
        exit 1
    fi
    
    log_success "Prerequisites satisfied"
}

# Get repository information
get_repo_info() {
    if [ $# -eq 1 ]; then
        REPO="$1"
        log_info "Using provided repository: $REPO"
    else
        REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
        if [ -z "$REPO" ]; then
            log_error "Could not determine repository. Please provide OWNER/REPO as argument."
            exit 1
        fi
        log_info "Using current repository: $REPO"
    fi
    
    OWNER=$(echo "$REPO" | cut -d'/' -f1)
    REPO_NAME=$(echo "$REPO" | cut -d'/' -f2)
}

# Configure main branch protection
configure_main_branch() {
    log_info "Configuring protection for main branch..."
    
    local BRANCH="main"
    
    # Main branch required status checks (exact job IDs from ci-gates.yml and security-audit.yml)
    local REQUIRED_CHECKS=(
        "lint"
        "typecheck"
        "build-verification"
        "unit-tests"
        "integration-tests"
        "e2e-smoke"
        "dependency-audit"
    )
    
    # Build the JSON payload for branch protection
    local CHECKS_JSON=$(printf '%s\n' "${REQUIRED_CHECKS[@]}" | jq -R . | jq -s .)
    
    local PROTECTION_PAYLOAD=$(cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "checks": $(echo "${REQUIRED_CHECKS[@]}" | jq -R 'split(" ") | map({context: .})')
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismissal_restrictions": {},
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 2,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
EOF
)
    
    # Apply branch protection using GitHub API
    if gh api \
        --method PUT \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "/repos/${OWNER}/${REPO_NAME}/branches/${BRANCH}/protection" \
        --input - <<< "$PROTECTION_PAYLOAD" &> /dev/null; then
        log_success "Main branch protection configured"
        log_info "  - Required reviews: 2"
        log_info "  - Dismiss stale reviews: Yes"
        log_info "  - Code owner reviews: Required"
        log_info "  - Linear history: Required"
        log_info "  - Force pushes: Blocked"
        log_info "  - Deletions: Blocked"
        log_info "  - Administrators included: Yes"
        log_info "  - Required status checks: ${#REQUIRED_CHECKS[@]}"
        for check in "${REQUIRED_CHECKS[@]}"; do
            log_info "    ✓ $check"
        done
    else
        log_error "Failed to configure main branch protection"
        return 1
    fi
}

# Configure develop branch protection
configure_develop_branch() {
    log_info "Configuring protection for develop branch..."
    
    local BRANCH="develop"
    
    # Develop branch required status checks (exact job IDs from ci-gates.yml)
    local REQUIRED_CHECKS=(
        "lint"
        "typecheck"
        "build-verification"
    )
    
    # Build the JSON payload for branch protection
    local PROTECTION_PAYLOAD=$(cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "checks": $(echo "${REQUIRED_CHECKS[@]}" | jq -R 'split(" ") | map({context: .})')
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismissal_restrictions": {},
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": false,
  "lock_branch": false,
  "allow_fork_syncing": true
}
EOF
)
    
    # Apply branch protection using GitHub API
    if gh api \
        --method PUT \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "/repos/${OWNER}/${REPO_NAME}/branches/${BRANCH}/protection" \
        --input - <<< "$PROTECTION_PAYLOAD" &> /dev/null; then
        log_success "Develop branch protection configured"
        log_info "  - Required reviews: 1"
        log_info "  - Dismiss stale reviews: No"
        log_info "  - Code owner reviews: Not required"
        log_info "  - Linear history: Not required"
        log_info "  - Force pushes: Blocked"
        log_info "  - Deletions: Blocked"
        log_info "  - Administrators included: No"
        log_info "  - Required status checks: ${#REQUIRED_CHECKS[@]}"
        for check in "${REQUIRED_CHECKS[@]}"; do
            log_info "    ✓ $check"
        done
    else
        log_error "Failed to configure develop branch protection"
        return 1
    fi
}

# Verify branch protection
verify_protection() {
    local BRANCH="$1"
    log_info "Verifying protection for $BRANCH branch..."
    
    if gh api \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "/repos/${OWNER}/${REPO_NAME}/branches/${BRANCH}/protection" \
        &> /dev/null; then
        log_success "Protection verified for $BRANCH"
    else
        log_warning "Could not verify protection for $BRANCH"
    fi
}

# Main execution
main() {
    echo ""
    log_info "GitHub Branch Protection Setup"
    log_info "=============================="
    echo ""
    
    check_prerequisites
    get_repo_info "$@"
    
    echo ""
    log_info "Repository: $REPO"
    echo ""
    
    # Configure branches
    if configure_main_branch; then
        echo ""
        verify_protection "main"
    else
        log_error "Failed to configure main branch"
        exit 1
    fi
    
    echo ""
    
    if configure_develop_branch; then
        echo ""
        verify_protection "develop"
    else
        log_error "Failed to configure develop branch"
        exit 1
    fi
    
    echo ""
    log_success "Branch protection configuration complete!"
    echo ""
    log_info "Next steps:"
    log_info "  1. Verify settings in GitHub web UI"
    log_info "  2. Test with a pull request"
    log_info "  3. Update BRANCHING_STRATEGY.md if needed"
    echo ""
}

# Run main function with all arguments
main "$@"
