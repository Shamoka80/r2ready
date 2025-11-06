Use these exactly. Each prompt should produce a pass/fail report plus a “What to fix” list.

“Run readiness health checks. Verify /healthz and /readyz. Confirm DB, migrations, external services, and env vars are OK. Report any failing subcheck and the exact key or service to fix.”

“Validate frontend API usage against the backend OpenAPI. List any unknown, deprecated, or shape-mismatched calls with file and line numbers. State the correct path or schema name for each.”

“Execute Playwright smoke: login, list view, create item, edit item, delete item. Fail on console errors and network calls to localhost, jsonplaceholder, or mock endpoints. Output a per-step result.”

“Audit repository for mock or demo artifacts imported by production. Trace from production entry points and list offending files and imports. If none, state ‘no production mock artifacts detected.’”

“Verify environment and dependencies for production. Ensure required env keys are set to non-placeholder values. Ensure no mocking libs in production dependencies. Report any violations.”