#!/usr/bin/env bash
set -euo pipefail

ROOT_PACKAGE_JSON="package.json"
SERVER_PACKAGE_JSON="server/package.json"
CLIENT_PACKAGE_JSON="client/package.json"
CHANGELOG_FILE="CHANGELOG.md"
CHANGELOG_SCRIPT="scripts/generate-changelog.sh"

DRY_RUN=false
SKIP_CHANGELOG=false

show_usage() {
  cat << EOF
Usage: $0 [OPTIONS] <bump-type> [prerelease-type]

Bump version across all package.json files following semantic versioning.

Bump Types:
  major           Increment MAJOR version (1.2.3 → 2.0.0)
  minor           Increment MINOR version (1.2.3 → 1.3.0)
  patch           Increment PATCH version (1.2.3 → 1.2.4)
  prerelease      Add/increment prerelease tag (1.2.3 → 1.2.4-alpha.1)

Prerelease Types (when using 'prerelease'):
  alpha           Alpha release (1.2.3 → 1.2.4-alpha.1)
  beta            Beta release (1.2.3 → 1.2.4-beta.1)
  rc              Release candidate (1.2.3 → 1.2.4-rc.1)

Options:
  --dry-run       Preview changes without applying them
  --skip-changelog Skip automatic CHANGELOG generation
  -h, --help      Show this help message

Examples:
  $0 major                      # 1.2.3 → 2.0.0
  $0 minor                      # 1.2.3 → 1.3.0
  $0 patch                      # 1.2.3 → 1.2.4
  $0 prerelease alpha           # 1.2.3 → 1.2.4-alpha.1
  $0 prerelease beta            # 1.2.4-alpha.1 → 1.2.4-beta.1
  $0 --dry-run major            # Preview major version bump
  $0 --skip-changelog patch     # Bump patch without updating CHANGELOG

Git Operations:
  - Checks for uncommitted changes (warns but continues)
  - Updates all package.json files
  - Generates CHANGELOG entry (unless --skip-changelog)
  - Creates commit: "chore: bump version to X.Y.Z"
  - Does NOT create git tag (use separate release process)

EOF
  exit 1
}

error_exit() {
  echo "ERROR: $1" >&2
  exit 1
}

info() {
  echo "ℹ️  $1"
}

success() {
  echo "✓ $1"
}

warning() {
  echo "⚠️  $1"
}

check_dependencies() {
  local missing_deps=()
  
  for cmd in git jq; do
    if ! command -v "$cmd" &> /dev/null; then
      missing_deps+=("$cmd")
    fi
  done
  
  if [[ ${#missing_deps[@]} -gt 0 ]]; then
    error_exit "Missing required dependencies: ${missing_deps[*]}"
  fi
}

check_git_repo() {
  if ! git rev-parse --git-dir > /dev/null 2>&1; then
    error_exit "Not a git repository"
  fi
}

check_working_directory() {
  if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    warning "Working directory has uncommitted changes"
    
    if [[ "$DRY_RUN" == "false" ]]; then
      echo ""
      git status --short
      echo ""
      read -p "Continue anyway? (y/N): " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Version bump cancelled"
        exit 0
      fi
    fi
  else
    success "Working directory is clean"
  fi
}

check_package_files_exist() {
  local missing_files=()
  
  for file in "$ROOT_PACKAGE_JSON" "$SERVER_PACKAGE_JSON" "$CLIENT_PACKAGE_JSON"; do
    if [[ ! -f "$file" ]]; then
      missing_files+=("$file")
    fi
  done
  
  if [[ ${#missing_files[@]} -gt 0 ]]; then
    error_exit "Missing package.json files: ${missing_files[*]}"
  fi
  
  success "All package.json files found"
}

get_current_version() {
  local package_file="$1"
  
  if [[ ! -f "$package_file" ]]; then
    error_exit "File not found: $package_file"
  fi
  
  local version
  version=$(jq -r '.version' "$package_file")
  
  if [[ -z "$version" ]] || [[ "$version" == "null" ]]; then
    error_exit "No version field found in $package_file"
  fi
  
  echo "$version"
}

validate_semver() {
  local version="$1"
  
  local semver_regex='^([0-9]+)\.([0-9]+)\.([0-9]+)(-([a-zA-Z0-9.]+))?(\+([a-zA-Z0-9.]+))?$'
  
  if [[ ! "$version" =~ $semver_regex ]]; then
    error_exit "Invalid semantic version: $version"
  fi
  
  success "Current version is valid: $version"
}

check_versions_in_sync() {
  local root_version
  local server_version
  local client_version
  
  root_version=$(get_current_version "$ROOT_PACKAGE_JSON")
  server_version=$(get_current_version "$SERVER_PACKAGE_JSON")
  client_version=$(get_current_version "$CLIENT_PACKAGE_JSON")
  
  if [[ "$root_version" != "$server_version" ]] || [[ "$root_version" != "$client_version" ]]; then
    error_exit "Versions are out of sync:
  Root:   $root_version
  Server: $server_version
  Client: $client_version
  
Fix: Manually sync versions in all package.json files before bumping"
  fi
  
  success "All versions in sync: $root_version" >&2
  echo "$root_version"
}

parse_version() {
  local version="$1"
  
  local semver_regex='^([0-9]+)\.([0-9]+)\.([0-9]+)(-([a-zA-Z0-9.]+))?(\+([a-zA-Z0-9.]+))?$'
  
  if [[ "$version" =~ $semver_regex ]]; then
    echo "${BASH_REMATCH[1]}"
    echo "${BASH_REMATCH[2]}"
    echo "${BASH_REMATCH[3]}"
    echo "${BASH_REMATCH[5]}"
    echo "${BASH_REMATCH[7]}"
  else
    error_exit "Invalid version format: $version"
  fi
}

bump_major() {
  local current_version="$1"
  
  local parsed
  IFS=$'\n' read -r -d '' -a parsed < <(parse_version "$current_version" && printf '\0')
  
  local major="${parsed[0]}"
  
  local new_major=$((major + 1))
  echo "${new_major}.0.0"
}

bump_minor() {
  local current_version="$1"
  
  local parsed
  IFS=$'\n' read -r -d '' -a parsed < <(parse_version "$current_version" && printf '\0')
  
  local major="${parsed[0]}"
  local minor="${parsed[1]}"
  
  local new_minor=$((minor + 1))
  echo "${major}.${new_minor}.0"
}

bump_patch() {
  local current_version="$1"
  
  local parsed
  IFS=$'\n' read -r -d '' -a parsed < <(parse_version "$current_version" && printf '\0')
  
  local major="${parsed[0]}"
  local minor="${parsed[1]}"
  local patch="${parsed[2]}"
  
  local new_patch=$((patch + 1))
  echo "${major}.${minor}.${new_patch}"
}

bump_prerelease() {
  local current_version="$1"
  local prerelease_type="$2"
  
  if [[ -z "$prerelease_type" ]]; then
    error_exit "Prerelease type required (alpha, beta, rc)"
  fi
  
  case "$prerelease_type" in
    alpha|beta|rc)
      ;;
    *)
      error_exit "Invalid prerelease type: $prerelease_type (must be alpha, beta, or rc)"
      ;;
  esac
  
  local parsed
  IFS=$'\n' read -r -d '' -a parsed < <(parse_version "$current_version" && printf '\0')
  
  local major="${parsed[0]}"
  local minor="${parsed[1]}"
  local patch="${parsed[2]}"
  local prerelease="${parsed[3]:-}"
  
  if [[ -z "$prerelease" ]]; then
    local new_patch=$((patch + 1))
    echo "${major}.${minor}.${new_patch}-${prerelease_type}.1"
  else
    if [[ "$prerelease" =~ ^([a-zA-Z]+)\.([0-9]+)$ ]]; then
      local current_type="${BASH_REMATCH[1]}"
      local current_number="${BASH_REMATCH[2]}"
      
      if [[ "$current_type" == "$prerelease_type" ]]; then
        local new_number=$((current_number + 1))
        echo "${major}.${minor}.${patch}-${prerelease_type}.${new_number}"
      else
        echo "${major}.${minor}.${patch}-${prerelease_type}.1"
      fi
    else
      error_exit "Cannot parse prerelease identifier: $prerelease"
    fi
  fi
}

calculate_new_version() {
  local bump_type="$1"
  local current_version="$2"
  local prerelease_type="${3:-}"
  
  case "$bump_type" in
    major)
      bump_major "$current_version"
      ;;
    minor)
      bump_minor "$current_version"
      ;;
    patch)
      bump_patch "$current_version"
      ;;
    prerelease)
      bump_prerelease "$current_version" "$prerelease_type"
      ;;
    *)
      error_exit "Invalid bump type: $bump_type (must be major, minor, patch, or prerelease)"
      ;;
  esac
}

update_package_version() {
  local package_file="$1"
  local new_version="$2"
  
  if [[ "$DRY_RUN" == "true" ]]; then
    info "[DRY RUN] Would update $package_file to $new_version"
    return 0
  fi
  
  local temp_file
  temp_file=$(mktemp)
  
  jq --arg version "$new_version" '.version = $version' "$package_file" > "$temp_file"
  
  if [[ $? -eq 0 ]]; then
    mv "$temp_file" "$package_file"
    success "Updated $package_file to $new_version"
  else
    rm -f "$temp_file"
    error_exit "Failed to update $package_file"
  fi
}

update_all_package_versions() {
  local new_version="$1"
  
  update_package_version "$ROOT_PACKAGE_JSON" "$new_version"
  update_package_version "$SERVER_PACKAGE_JSON" "$new_version"
  update_package_version "$CLIENT_PACKAGE_JSON" "$new_version"
}

generate_changelog() {
  local new_version="$1"
  
  if [[ "$SKIP_CHANGELOG" == "true" ]]; then
    info "Skipping CHANGELOG generation (--skip-changelog flag)"
    return 0
  fi
  
  if [[ ! -f "$CHANGELOG_SCRIPT" ]]; then
    warning "CHANGELOG generator script not found: $CHANGELOG_SCRIPT"
    warning "Skipping CHANGELOG generation"
    return 0
  fi
  
  if [[ "$DRY_RUN" == "true" ]]; then
    info "[DRY RUN] Would generate CHANGELOG for version $new_version"
    return 0
  fi
  
  info "Generating CHANGELOG for version $new_version..."
  
  if bash "$CHANGELOG_SCRIPT"; then
    success "CHANGELOG generated successfully"
  else
    warning "CHANGELOG generation failed (continuing anyway)"
  fi
}

create_git_commit() {
  local new_version="$1"
  
  if [[ "$DRY_RUN" == "true" ]]; then
    info "[DRY RUN] Would create git commit: 'chore: bump version to $new_version'"
    info "[DRY RUN] Would include files:"
    echo "  - $ROOT_PACKAGE_JSON"
    echo "  - $SERVER_PACKAGE_JSON"
    echo "  - $CLIENT_PACKAGE_JSON"
    if [[ "$SKIP_CHANGELOG" == "false" ]] && [[ -f "$CHANGELOG_FILE" ]]; then
      echo "  - $CHANGELOG_FILE"
    fi
    return 0
  fi
  
  git add "$ROOT_PACKAGE_JSON" "$SERVER_PACKAGE_JSON" "$CLIENT_PACKAGE_JSON"
  
  if [[ "$SKIP_CHANGELOG" == "false" ]] && [[ -f "$CHANGELOG_FILE" ]]; then
    git add "$CHANGELOG_FILE"
  fi
  
  git commit -m "chore: bump version to $new_version"
  
  success "Created git commit: 'chore: bump version to $new_version'"
  info "Note: Git tag NOT created (create manually during release process)"
}

rollback_on_error() {
  local current_version="$1"
  
  warning "Rolling back changes..."
  
  git checkout HEAD -- "$ROOT_PACKAGE_JSON" "$SERVER_PACKAGE_JSON" "$CLIENT_PACKAGE_JSON" 2>/dev/null || true
  
  if [[ -f "$CHANGELOG_FILE" ]]; then
    git checkout HEAD -- "$CHANGELOG_FILE" 2>/dev/null || true
  fi
  
  error_exit "Version bump failed and was rolled back"
}

show_summary() {
  local current_version="$1"
  local new_version="$2"
  local bump_type="$3"
  
  echo ""
  echo "=========================================="
  echo "Version Bump Summary"
  echo "=========================================="
  echo ""
  echo "Bump Type:      $bump_type"
  echo "Current Version: $current_version"
  echo "New Version:     $new_version"
  echo ""
  echo "Files Updated:"
  echo "  ✓ $ROOT_PACKAGE_JSON"
  echo "  ✓ $SERVER_PACKAGE_JSON"
  echo "  ✓ $CLIENT_PACKAGE_JSON"
  if [[ "$SKIP_CHANGELOG" == "false" ]]; then
    echo "  ✓ $CHANGELOG_FILE"
  fi
  echo ""
  
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "Mode: DRY RUN (no changes applied)"
  else
    echo "Git Commit: chore: bump version to $new_version"
    echo ""
    echo "Next Steps:"
    echo "  1. Review the changes: git show HEAD"
    echo "  2. Push to remote: git push origin main"
    echo "  3. Create release tag: git tag -a v$new_version -m \"Release version $new_version\""
    echo "  4. Push tag: git push origin v$new_version"
  fi
  echo ""
  echo "=========================================="
  echo ""
}

main() {
  local bump_type=""
  local prerelease_type=""
  
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      --skip-changelog)
        SKIP_CHANGELOG=true
        shift
        ;;
      -h|--help)
        show_usage
        ;;
      major|minor|patch|prerelease)
        bump_type="$1"
        shift
        if [[ "$bump_type" == "prerelease" ]] && [[ $# -gt 0 ]] && [[ "$1" =~ ^(alpha|beta|rc)$ ]]; then
          prerelease_type="$1"
          shift
        fi
        ;;
      *)
        error_exit "Unknown argument: $1 (use --help for usage)"
        ;;
    esac
  done
  
  if [[ -z "$bump_type" ]]; then
    error_exit "Bump type required (use --help for usage)"
  fi
  
  if [[ "$bump_type" == "prerelease" ]] && [[ -z "$prerelease_type" ]]; then
    error_exit "Prerelease type required (alpha, beta, or rc)"
  fi
  
  info "Starting version bump process..."
  echo ""
  
  check_dependencies
  check_git_repo
  check_package_files_exist
  
  local current_version
  current_version=$(check_versions_in_sync)
  
  validate_semver "$current_version"
  
  echo ""
  check_working_directory
  echo ""
  
  local new_version
  new_version=$(calculate_new_version "$bump_type" "$current_version" "$prerelease_type")
  
  info "Calculated new version: $current_version → $new_version"
  echo ""
  
  if [[ "$DRY_RUN" == "true" ]]; then
    info "DRY RUN MODE - No changes will be applied"
    echo ""
  fi
  
  trap 'rollback_on_error "$current_version"' ERR
  
  update_all_package_versions "$new_version"
  echo ""
  
  generate_changelog "$new_version"
  echo ""
  
  create_git_commit "$new_version"
  
  trap - ERR
  
  show_summary "$current_version" "$new_version" "$bump_type"
  
  success "Version bump completed successfully!"
}

main "$@"
