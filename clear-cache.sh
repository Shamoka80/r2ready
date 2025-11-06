#!/bin/bash

echo "=================================================="
echo "  Cache Clear and System Verification Workflow"
echo "=================================================="
echo ""
echo "This will:"
echo "  1. Clear all server cache"
echo "  2. Check for queued tasks"
echo "  3. Verify application health"
echo ""

# Run the workflow script
npx tsx scripts/clear-cache-and-restart.ts

EXIT_CODE=$?

echo ""
echo "=================================================="
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Workflow completed successfully!"
  echo ""
  echo "Next steps (if needed):"
  echo "  • To restart the server completely, restart the"
  echo "    'Start application' workflow in Replit"
  echo "  • Cache will rebuild automatically as requests"
  echo "    are processed"
else
  echo "❌ Workflow encountered errors (exit code: $EXIT_CODE)"
  echo ""
  echo "Troubleshooting:"
  echo "  • Check if the server is running"
  echo "  • Review the error messages above"
  echo "  • Check application logs for details"
fi
echo "=================================================="

exit $EXIT_CODE
