#!/usr/bin/env bash
set -euo pipefail

CHANGELOG_FILE="CHANGELOG.md"
TEMP_CHANGELOG="/tmp/changelog_temp.md"

show_usage() {
  cat << EOF
Usage: $0 [FROM_TAG] [TO_TAG]

Generate CHANGELOG from conventional commits.

Examples:
  $0                    # From last tag to HEAD
  $0 v1.9.0             # From v1.9.0 to HEAD
  $0 v1.9.0 v2.0.0      # Between v1.9.0 and v2.0.0

Arguments:
  FROM_TAG    Starting git tag (optional, defaults to latest tag)
  TO_TAG      Ending git tag (optional, defaults to HEAD)

Output:
  Prepends new version section to CHANGELOG.md

Commit Format:
  type(scope): description
  
  BREAKING CHANGE: description

Supported types:
  feat, fix, docs, style, refactor, perf, test, chore, ci, build

EOF
  exit 1
}

error_exit() {
  echo "ERROR: $1" >&2
  exit 1
}

check_git_repo() {
  if ! git rev-parse --git-dir > /dev/null 2>&1; then
    error_exit "Not a git repository"
  fi
}

get_latest_tag() {
  local latest_tag
  latest_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
  
  if [[ -z "$latest_tag" ]]; then
    error_exit "No tags found in repository. Create a tag first."
  fi
  
  echo "$latest_tag"
}

validate_tag() {
  local tag="$1"
  
  if [[ "$tag" != "HEAD" ]] && ! git rev-parse "$tag" >/dev/null 2>&1; then
    error_exit "Tag '$tag' does not exist"
  fi
}

extract_version_from_tag() {
  local tag="$1"
  
  if [[ "$tag" =~ ^v?([0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?)$ ]]; then
    echo "${BASH_REMATCH[1]}"
  elif [[ "$tag" =~ ^prelaunch-([0-9]{14})$ ]]; then
    echo "prelaunch-${BASH_REMATCH[1]}"
  else
    echo "$(date +%Y-%m-%d)"
  fi
}

get_commits() {
  local from_ref="$1"
  local to_ref="$2"
  
  git log --pretty=format:"%H|%s|%b" "$from_ref".."$to_ref"
}

parse_conventional_commit() {
  local commit_hash="$1"
  local subject="$2"
  local body="$3"
  
  local type=""
  local scope=""
  local description=""
  local breaking=""
  
  if [[ "$subject" =~ ^([a-z]+)(\(([^\)]+)\))?!?:[[:space:]](.+)$ ]]; then
    type="${BASH_REMATCH[1]}"
    scope="${BASH_REMATCH[3]}"
    description="${BASH_REMATCH[4]}"
    
    if [[ "$subject" =~ ! ]]; then
      breaking="true"
    fi
  else
    return 1
  fi
  
  if [[ "$body" =~ BREAKING\ CHANGE:\ (.+) ]] || [[ "$body" =~ BREAKING-CHANGE:\ (.+) ]]; then
    breaking="true"
  fi
  
  local short_hash
  short_hash=$(echo "$commit_hash" | cut -c1-7)
  
  if [[ -n "$scope" ]]; then
    echo "${type}|${scope}|${description}|${short_hash}|${breaking}"
  else
    echo "${type}||${description}|${short_hash}|${breaking}"
  fi
}

generate_changelog_section() {
  local version="$1"
  local date="$2"
  local from_ref="$3"
  local to_ref="$4"
  
  declare -A commits_by_type
  commits_by_type=(
    ["feat"]=""
    ["fix"]=""
    ["docs"]=""
    ["style"]=""
    ["refactor"]=""
    ["perf"]=""
    ["test"]=""
    ["chore"]=""
    ["ci"]=""
    ["build"]=""
  )
  
  local breaking_changes=""
  local commit_count=0
  
  while IFS='|' read -r hash subject body; do
    if [[ -z "$hash" ]]; then
      continue
    fi
    
    local parsed
    if parsed=$(parse_conventional_commit "$hash" "$subject" "$body"); then
      IFS='|' read -r type scope description short_hash is_breaking <<< "$parsed"
      
      commit_count=$((commit_count + 1))
      
      if [[ -n "$scope" ]]; then
        local entry="- **${scope}**: ${description} (${short_hash})"
      else
        local entry="- ${description} (${short_hash})"
      fi
      
      if [[ -n "${commits_by_type[$type]:-}" ]] || [[ "${commits_by_type[$type]+_}" ]]; then
        commits_by_type[$type]+="${entry}"$'\n'
      fi
      
      if [[ "$is_breaking" == "true" ]]; then
        breaking_changes+="${entry}"$'\n'
      fi
    fi
  done < <(get_commits "$from_ref" "$to_ref")
  
  if [[ $commit_count -eq 0 ]]; then
    echo "No conventional commits found between $from_ref and $to_ref" >&2
    return 1
  fi
  
  {
    echo "## [$version] - $date"
    echo ""
    
    if [[ -n "$breaking_changes" ]]; then
      echo "### BREAKING CHANGES"
      echo ""
      echo -n "$breaking_changes"
      echo ""
    fi
    
    if [[ -n "${commits_by_type[feat]}" ]]; then
      echo "### Added"
      echo ""
      echo -n "${commits_by_type[feat]}"
      echo ""
    fi
    
    if [[ -n "${commits_by_type[refactor]}" ]] || [[ -n "${commits_by_type[perf]}" ]]; then
      echo "### Changed"
      echo ""
      [[ -n "${commits_by_type[refactor]}" ]] && echo -n "${commits_by_type[refactor]}"
      [[ -n "${commits_by_type[perf]}" ]] && echo -n "${commits_by_type[perf]}"
      echo ""
    fi
    
    if [[ -n "${commits_by_type[fix]}" ]]; then
      echo "### Fixed"
      echo ""
      echo -n "${commits_by_type[fix]}"
      echo ""
    fi
    
    if [[ -n "${commits_by_type[docs]}" ]]; then
      echo "### Documentation"
      echo ""
      echo -n "${commits_by_type[docs]}"
      echo ""
    fi
    
    if [[ -n "${commits_by_type[test]}" ]]; then
      echo "### Tests"
      echo ""
      echo -n "${commits_by_type[test]}"
      echo ""
    fi
    
    if [[ -n "${commits_by_type[chore]}" ]] || [[ -n "${commits_by_type[ci]}" ]] || [[ -n "${commits_by_type[build]}" ]] || [[ -n "${commits_by_type[style]}" ]]; then
      echo "### Chores"
      echo ""
      [[ -n "${commits_by_type[chore]}" ]] && echo -n "${commits_by_type[chore]}"
      [[ -n "${commits_by_type[ci]}" ]] && echo -n "${commits_by_type[ci]}"
      [[ -n "${commits_by_type[build]}" ]] && echo -n "${commits_by_type[build]}"
      [[ -n "${commits_by_type[style]}" ]] && echo -n "${commits_by_type[style]}"
      echo ""
    fi
  } > "$TEMP_CHANGELOG"
}

prepend_to_changelog() {
  if [[ -f "$CHANGELOG_FILE" ]]; then
    cat "$TEMP_CHANGELOG" "$CHANGELOG_FILE" > "${CHANGELOG_FILE}.new"
    mv "${CHANGELOG_FILE}.new" "$CHANGELOG_FILE"
  else
    echo "# CHANGELOG" > "$CHANGELOG_FILE"
    echo "" >> "$CHANGELOG_FILE"
    echo "All notable changes to this project will be documented in this file." >> "$CHANGELOG_FILE"
    echo "" >> "$CHANGELOG_FILE"
    echo "The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)," >> "$CHANGELOG_FILE"
    echo "and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)." >> "$CHANGELOG_FILE"
    echo "" >> "$CHANGELOG_FILE"
    cat "$TEMP_CHANGELOG" >> "$CHANGELOG_FILE"
  fi
  
  rm -f "$TEMP_CHANGELOG"
}

main() {
  if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
    show_usage
  fi
  
  check_git_repo
  
  local from_tag="${1:-$(get_latest_tag)}"
  local to_tag="${2:-HEAD}"
  
  validate_tag "$from_tag"
  validate_tag "$to_tag"
  
  local version
  if [[ "$to_tag" == "HEAD" ]]; then
    version=$(extract_version_from_tag "$from_tag")
    if [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      IFS='.' read -r major minor patch <<< "$version"
      version="${major}.${minor}.$((patch + 1))"
    else
      version="unreleased"
    fi
  else
    version=$(extract_version_from_tag "$to_tag")
  fi
  
  local date
  date=$(date +%Y-%m-%d)
  
  echo "Generating CHANGELOG for version $version..."
  echo "Analyzing commits from $from_tag to $to_tag..."
  echo ""
  
  if generate_changelog_section "$version" "$date" "$from_tag" "$to_tag"; then
    prepend_to_changelog
    echo "✓ CHANGELOG generated successfully!"
    echo "✓ Updated $CHANGELOG_FILE"
    echo ""
    echo "Preview:"
    echo "----------------------------------------"
    head -n 30 "$CHANGELOG_FILE"
    echo "----------------------------------------"
  else
    error_exit "Failed to generate CHANGELOG (no conventional commits found)"
  fi
}

main "$@"
