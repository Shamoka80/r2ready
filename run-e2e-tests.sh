#!/bin/bash

# RUR2 E2E Test Runner
# This script helps you run the complete user journey tests

set -e

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║         RUR2 E2E Test Suite - User Journey Tests                 ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Function to display menu
show_menu() {
    echo "Available Test Options:"
    echo "  1) Clean Database (REQUIRED before first run)"
    echo "  2) Run All E2E Tests"
    echo "  3) Run Business User Journey (PDF Report)"
    echo "  4) Run Consultant User Journey (Word Report)"
    echo "  5) Run Tests in UI Mode (Interactive)"
    echo "  6) Exit"
    echo ""
}

# Function to run cleanup
run_cleanup() {
    echo "🧹 Cleaning database of test users..."
    echo ""
    npx tsx e2e-tests/helpers/db-cleanup.ts
    echo ""
    echo "✅ Database cleanup complete!"
    echo ""
}

# Function to run all tests
run_all_tests() {
    echo "🚀 Running all E2E tests..."
    echo ""
    npx playwright test e2e-tests/
    echo ""
}

# Function to run business test
run_business_test() {
    echo "🏢 Running Business User Journey (PDF Report)..."
    echo ""
    npx playwright test e2e-tests/user-journey-1-business-solo-pdf.spec.ts
    echo ""
}

# Function to run consultant test
run_consultant_test() {
    echo "👔 Running Consultant User Journey (Word Report)..."
    echo ""
    npx playwright test e2e-tests/user-journey-2-consultant-agency-word.spec.ts
    echo ""
}

# Function to run in UI mode
run_ui_mode() {
    echo "🎨 Running tests in UI mode..."
    echo ""
    npx playwright test e2e-tests/ --ui
    echo ""
}

# Main loop
while true; do
    show_menu
    read -p "Select an option (1-6): " choice
    echo ""
    
    case $choice in
        1)
            run_cleanup
            ;;
        2)
            run_all_tests
            ;;
        3)
            run_business_test
            ;;
        4)
            run_consultant_test
            ;;
        5)
            run_ui_mode
            ;;
        6)
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo "❌ Invalid option. Please choose 1-6."
            echo ""
            ;;
    esac
    
    read -p "Press Enter to continue..."
    echo ""
done
