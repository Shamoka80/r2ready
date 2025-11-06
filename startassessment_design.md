Page Name: Start New Assessment
Purpose:
This page is the formal entry point for launching a new R2v3 self-assessment.
It collects the essential parameters — facility, assessment type, responsible users, and schedule — to define the scope and structure of the upcoming evaluation.
The page ensures that the system loads the correct requirements (Core + applicable Appendices) when the user proceeds to the next step, the REC Mapping & Appendix Determination page.
________________________________________
1. Layout Overview
Design: Clean, enterprise-grade interface consistent with the dashboard theme.
•	White background, light-gray cards, subtle shadows.
•	Two-column responsive layout (primary form area + contextual summary sidebar).
•	Top progress indicator showing:
Dashboard → Start Assessment → REC Mapping → Questionnaire → Results
________________________________________
2. Page Structure & Components
A. Header Section
•	Title: “Start New Assessment”
•	Subtitle: “Define the scope, team, and parameters for your R2v3 Precertification Assessment.”
•	Breadcrumb: Home / Assessments / Start New
•	Quick Tip Icon (ℹ️): Opens tooltip explaining that this setup determines which questions and appendices will appear later.
________________________________________
B. Main Form Area (Left Column)
1. Facility Selection
•	Dropdown: Select Existing Facility (auto-filled from onboarding)
•	Button: + Add New Facility (opens modal to add name, address, activities, volume, employee count)
•	Inline tag summary: shows selected facility’s basic info — “Apex Recycling – Houston, TX | ITAD + Materials Recovery”
2. Assessment Type
•	Radio buttons (single selection):
o	Full R2v3 Assessment – includes Core + all applicable Appendices
o	Targeted Section – choose specific Core Requirement(s) or Appendix
o	Re-Assessment / Follow-up – loads previous responses for update
•	Tooltip: “Choose Full for initial readiness evaluation. Targeted or Re-Assessment for focused reviews.”
3. Assessment Details
•	Assessment Title: Text field (default auto-generated: “R2v3 Assessment – [Facility Name] – [Date]”)
•	Description / Notes: Optional text area for user context (e.g., “Internal gap check before surveillance audit”).
•	Assessment Owner: Auto-filled (current logged-in user).
•	Collaborators: Multi-select of users/agents (roles restricted by plan tier).
•	Due Date: Date picker (optional; adds reminder to dashboard).
4. Assessment Scope Confirmation
•	Checklist of processing activities (each with toggle):
o	Collection & Sorting
o	Data Sanitization
o	Testing & Repair
o	Specialty Electronics
o	Materials Recovery
o	Brokering
o	PV Module Handling
•	These selections directly feed the REC logic on the next page.
5. Save & Continue Controls
•	Buttons:
o	Continue to REC Mapping → advances to next page
o	Save Draft → stores current setup progress
o	Cancel / Back to Dashboard
•	Auto-save indicator (bottom-right corner): “Progress saved 2s ago”
________________________________________
C. Contextual Sidebar (Right Column)
1. Summary Card
•	Displays key selections in real time:
o	Facility
o	Assessment type
o	Assigned users
o	Chosen processes
o	Estimated completion time (auto-calculated from complexity model)
2. Plan & Access Indicator
•	Shows plan tier limits (e.g., “3 of 5 Assessments used”).
•	Prompt to upgrade if limits are reached (Enterprise plan link).
3. Quick Reference
•	Mini chart showing previous readiness score (if re-assessment).
•	Tooltip linking to relevant R2v3 standard references for scope definition (Core Requirement 1).
________________________________________
D. System Behavior / UX
•	Auto-validation: Prevents continuing without selecting facility and assessment type.
•	Adaptive Visibility: Consultant accounts see “Client” instead of “Facility.”
•	Accessibility: WCAG-compliant inputs, keyboard-friendly navigation.
•	Responsive: On tablets, collapses sidebar below form.
________________________________________
E. Navigation Outcome
Upon clicking Continue to REC Mapping, the system:
1.	Saves the configuration.
2.	Runs logic to pre-determine which Appendices apply.
3.	Redirects user to the next page: REC Mapping & Appendix Determination, where applicable appendices are confirmed and assessment questions are generated.
________________________________________
In summary:
The Start New Assessment page is a structured, minimalist setup form designed for efficiency and precision. It defines who, what, and where before the system intelligently determines which R2v3 requirements will apply — seamlessly leading into REC Mapping & Appendix Determination.

