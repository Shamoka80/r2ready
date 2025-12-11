#!/bin/bash

# CI check to prevent subscription/credits terminology from being reintroduced
# This script fails if forbidden terms are found in active code paths

set -e

echo "🔍 Checking for forbidden subscription/credits terminology..."

# Define forbidden terms (case-insensitive search)
FORBIDDEN_TERMS=("subscription" "credit")

# Define critical directories to check (active code only)
CHECK_DIRS=(
  "./client/src"
  "./server/services"
  "./server/routes"
  "./shared"
)

# Define files to completely exclude
EXCLUDE_FILES=(
  "./shared/schema.js"  # Allow comments about "formerly subscription"
  "./scripts/check-forbidden-terms.sh"  # This file itself
)

# Track violations
violations_found=0
violation_details=()

echo "📋 Scanning critical code directories for forbidden terms..."

# Function to check if file should be excluded
should_exclude() {
  local file="$1"
  for exclude in "${EXCLUDE_FILES[@]}"; do
    if [[ "$file" == "$exclude" ]]; then
      return 0
    fi
  done
  return 1
}

# Check each directory
for dir in "${CHECK_DIRS[@]}"; do
  if [[ -d "$dir" ]]; then
    echo "  Checking directory: $dir"
    
    # Find TypeScript/JavaScript files in this directory
    while IFS= read -r file; do
      # Skip excluded files
      if should_exclude "$file"; then
        continue
      fi
      
      # Check for forbidden terms
      for term in "${FORBIDDEN_TERMS[@]}"; do
        if grep -qi "$term" "$file" 2>/dev/null; then
          # Get line numbers with context, excluding legitimate uses:
          # - Stripe API fields and webhook events
          # - Cloud provider subscription references (Azure, AWS, GCP)
          # - Third-party subscription services
          # - "accredit" / "accredited" (different word, not about credits)
          # - Migration comments
          matches=$(grep -ni "$term" "$file" 2>/dev/null | \
            grep -v -iE "stripeSubscriptionId" | \
            grep -v -iE "customer\.subscription" | \
            grep -v -iE "Handle.*subscription" | \
            grep -v -iE "subscription.*deleted" | \
            grep -v -iE "subscription.*recurring" | \
            grep -v -iE "subscriptions or" | \
            grep -v -iE "Azure.*subscription" | \
            grep -v -iE "AWS.*subscription" | \
            grep -v -iE "GCP.*subscription" | \
            grep -v -iE "subscription service" | \
            grep -v -iE "subscription.*or manual" | \
            grep -v -iE "actual.*subscription" | \
            grep -v -iE "formerly subscription" | \
            grep -v -iE "changed from subscription" | \
            grep -v -iE "CreditCard" | \
            grep -v -iE "accredited" | \
            grep -v -iE "accredit" | \
            head -3)
          if [[ -n "$matches" ]]; then
            violation_details+=("❌ File: $file")
            violation_details+=("   Term: '$term'")
            violation_details+=("   Lines: $matches")
            violation_details+=("")
            violations_found=$((violations_found + 1))
          fi
        fi
      done
    done < <(find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null || true)
  fi
done

# Report results
if [ $violations_found -eq 0 ]; then
  echo "✅ No forbidden terms found in critical code paths!"
  echo "✅ License terminology is properly maintained."
  exit 0
else
  echo ""
  echo "🚨 FORBIDDEN TERMS DETECTED - CI CHECK FAILED"
  echo "================================================"
  echo ""
  echo "Found $violations_found violations in critical code paths:"
  echo ""
  
  for detail in "${violation_details[@]}"; do
    echo "$detail"
  done
  
  echo "💡 REMEDIATION STEPS:"
  echo "1. Replace 'subscription' → 'license' terminology"
  echo "2. Replace 'credits' → 'license entitlements'"
  echo "3. Use 'licenseStatus' instead of 'subscriptionStatus'"
  echo "4. Use 'licenseType' instead of 'subscriptionPlan'"
  echo ""
  
  exit 1
fi