Share two things with candidates: a one-page diagnostic report and a precise scope. Use the prompts below to generate the report in Replit without writing code, then paste the outputs into the brief.

# Prompt to generate a diagnostic report in Replit Chat

“Perform a full project diagnostic. Do not write new code. Build, run, and statically analyze. Produce a single structured report with these sections:

1. Tech Stack Inventory: runtime, frameworks, package versions, build tools.
2. Build + Runtime Health: build logs, start-up warnings, fatal errors, hot reload status.
3. Routes & APIs: list endpoints, methods, auth requirements, sample 200/4xx/5xx, failing handlers.
4. Frontend Map: pages, major components, routing, forms, state management, known console errors.
5. Data Layer: current database URL, ORM and migration status, list of tables, pending/failed migrations.
6. Integrations: Stripe, Supabase/Neon, cloud storage, auth providers. For each: keys present (yes/no), sandbox vs live, last successful call.
7. Tests: unit/e2e frameworks detected, count passed/failed/skipped, coverage % if available.
8. Code Quality: TypeScript errors, ESLint issues, unresolved imports, duplicate exports, dead files.
9. Security & Ops: dependency vulnerabilities, .env variable completeness (names only, no values), CI/CD status.
10. Feature Matrix: Required features vs status [Working | Partially working | Stubbed | Missing] with one-line evidence each.
    Output as a concise checklist with links to the exact files or lines where issues were detected.”

# One-page brief you send to candidates (fill with the diagnostic output)

* **Project**: RUR2 Ready? R2v3 pre-cert self-assessment web app.
* **Goal**: Stabilize v1, close gaps, and add a lightweight knowledge-base AI UX.
* **Stack**: [paste Tech Stack Inventory]
* **Current Health**: [paste Build + Runtime Health summary]
* **Key Features + Status**: [paste Feature Matrix]
* **APIs and Data**: [paste Routes & APIs] | DB: [paste Data Layer]
* **Integrations**: [paste Integrations]
* **Tests and Quality**: [paste Tests] | [paste Code Quality]
* **Security/Ops**: [paste Security & Ops]
* **Known Blockers**: [top 3, one line each]
* **Access Provided**: GitHub repo (read), Replit project (viewer), test credentials, sandbox API keys.
* **Success Criteria**: zero TypeScript errors, zero critical vulns, green build, 95% route uptime in dev, payment and storage flows succeed end-to-end, AI KB answers scoped docs with <2s median latency.
* **Constraints**: keep existing branding and data model; no framework rewrites.

# Scope you give for quoting

**Phase 0 — Audit & Plan (fixed-bid)**

* Validate diagnostic. Propose remediation plan with task list, estimates, and risks.
* Deliver: updated Feature Matrix, bug list with severities, migration plan.

**Phase 1 — Stabilization**

* Resolve build/TS/ESLint errors. Remove duplicate exports and dead files. Migrate DB to a clean state. Fix failing routes and auth flows.
* Exit criteria: clean build, zero TypeScript errors, ≤10 ESLint warnings, all critical routes return 2xx in dev.

**Phase 2 — Feature Completion**

* Convert stubs to real exports for PDF/Excel/Word. Finish REC-mapping logic. Harden evidence upload to user cloud storage.
* Exit criteria: exports generate real files; file uploads succeed across providers; happy-path e2e test passes.

**Phase 3 — Lightweight AI Knowledge-Base UX**

* Add a scoped Q&A panel fed only by project docs and help articles. Retrieval first; no user PII in prompts. Basic feedback loop.
* Exit criteria: ≥85% answer match on a 20-question gold set; latency <2s median; offline fallback.

# Candidate questionnaire

* Confirm your approach for Phase 0 and sample deliverables.
* Estimate hours per phase with risk buffers. State fixed-bid vs T&M.
* List similar projects and links. State team size, timezone, and handoff plan.
* Security posture: handling of secrets, least-privilege access, and audit logs.
* Warranty period and SLA for critical bugs post-delivery.

This gives candidates the exact data to price accurately and keeps the AI addition bounded.