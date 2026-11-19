## ADDED Requirements

### Requirement: Baseline timeline parsing
The system SHALL parse the first worksheet of a Timeline Template workbook, treat every column between `Role` and
`Total` as a week column by position, end the table at the first empty `Title`, and compute baseline PD per line as the
sum over weeks of FTE times that week's working days.

#### Scenario: Reference template
- **WHEN** the supplied template is uploaded
- **THEN** 11 resource lines, 28 weeks and 1,610 PD are reported, regardless of the template's own Total formulas

#### Scenario: Invalid FTE
- **WHEN** a week cell holds a non-numeric or negative value
- **THEN** the upload is rejected with the row and cell named

### Requirement: Role mapping and person capability
The system SHALL propose one of seven canonical roles from each line's Title using the configured keyword order and
SHALL require the operator to set a role and a person capability (AI Native or AI Adaptive) on every line.

#### Scenario: Whole-word BA
- **WHEN** a Title is "Database Specialist"
- **THEN** it is not mapped to RE

### Requirement: Gain calculation
The system SHALL compute per-role complexity from the weighted survey and, for each role, a geometric gain potential
from that role's configured maximum gain (complexity 0) to its minimum potential (complexity 1). Per-line enablement
comes from the best allowed model tier, best allowed harness and person capability, and the per-line gain is
`floor(role) + (Potential − floor(role)) × E`; role gain is baseline PD over adjusted PD. Roles that mostly work with
people have narrow, low ranges (Delivery Manager 1.2x–1.6x) and Dev the widest (2x–10x). Every role's minimum gain
(floor), used when only weak models are allowed, is 1.2x.

#### Scenario: Worked example with the spec's uniform range
- **WHEN** the spec section 11 inputs are entered and every role uses floor 1.5x, 10x at complexity 0 and 2x at complexity 1
- **THEN** total adjusted PD is 331.2, overall gain 4.86x, token cost USD 18,423 to 32,813, and the AI timeline is 8 weeks

#### Scenario: People-facing roles stay low
- **WHEN** a bid has complexity around 0.6 for every role with full enablement
- **THEN** Delivery Manager's gain is between 1.2x and 1.5x, RE's is above Delivery Manager's, and Dev's is the highest

#### Scenario: No capable model
- **WHEN** no allowed model reaches the AI Assisted tier
- **THEN** every role is held at its minimum gain of 1.2x and a blocking warning is shown

### Requirement: Manual override
The system SHALL offer one slider per role from 1.0x to 10x in 0.1 steps, set to the computed gain, whose value replaces
the gain of every line of that role, with a Reset control.

#### Scenario: Lowering a gain lowers AI token usage
- **WHEN** a role's gain is overridden below its computed gain
- **THEN** that role's token usage scales linearly from 100% at the computed gain to 0% at 1.0x, so lowering a gain
  never raises its token cost; seats and subscriptions are still charged

#### Scenario: Override drives the AI timeline
- **WHEN** the Dev slider is set below the lowest computed line gain
- **THEN** the AI timeline duration is recomputed from that override

### Requirement: RFP survey pre-fill
The system SHALL extract RFP text on the server and ask an Opus-level model, configured by environment, to answer each
survey question from the RFP only, returning a level with confidence, excerpt and location, or not_found, and SHALL
continue manually if the call fails.

#### Scenario: Pre-fill unavailable
- **WHEN** no API key is configured or the call fails
- **THEN** the survey stays empty with a notice and the flow continues

### Requirement: Question effect on roles
Each Domain Complexity section SHALL have a "Show effect on roles" switch, off by default. When on, every question in
the section SHALL show, per role, the question's weight and share of the role's complexity, and the role's gain
potential under each of the four answers with the other answers held as they are, marking the chosen answer.

#### Scenario: Comparing answers
- **WHEN** the operator turns on the switch for a section
- **THEN** each question in it shows how much each role's gain potential would change from the simplest to the most
  complex answer

### Requirement: Bid context
Initials SHALL offer an optional free-text Context field (at most 20,000 characters) for what the team knows beyond
the RFP. The context SHALL be kept in the browser, sent to the pre-fill with the RFP as untrusted data (either source
alone is enough), cited with the location "Context" when it supports an answer, and written to the Inputs sheet of the
Excel report.

The pre-fill SHALL run only when the operator selects Suggest answers; uploading or removing files and editing the
context SHALL NOT start it.

#### Scenario: Files uploaded
- **WHEN** the operator uploads RFP files
- **THEN** nothing is sent to the LLM until they select Suggest answers

#### Scenario: Sources changed after a pre-fill
- **WHEN** the operator changes the files or the context after a pre-fill finished
- **THEN** the system offers Re-run with changes and does not re-run it on its own

### Requirement: Excel report
The system SHALL export an .xlsx named `<bid-name>_estimation_<YYYY-MM-DD>.xlsx` with Summary, Role Comparison,
Resource Lines, AI Timeline, Token Cost, Inputs and Parameters sheets, writing numbers as numbers.

#### Scenario: Overrides in the report
- **WHEN** a role gain is overridden
- **THEN** the Role Comparison sheet marks it and keeps the computed gain alongside

### Requirement: Survey clarity and consistency
The survey SHALL label answers on a plain-language scale (Simplest, Moderate, Complex, Most complex) instead of raw
scores, show a one-line explanation per question, and keep linked questions consistent: Q2 is "No integrations"
exactly when Q1 is "None".

#### Scenario: No integration points
- **WHEN** the operator answers Q1 "None"
- **THEN** Q2 is set to "No integrations" and its other answers are unavailable, with the reason shown

#### Scenario: Integration points exist
- **WHEN** Q1 is above "None"
- **THEN** Q2 "No integrations" is unavailable, and a previous "No integrations" answer is cleared for the operator to choose again

#### Scenario: Contradictory pre-fill
- **WHEN** the RFP pre-fill suggests Q1 above "None" and Q2 "No integrations"
- **THEN** Q1 is kept, Q2 is left for the operator, and results stay blocked until the contradiction is resolved

### Requirement: AI cost by Claude plan
The system SHALL show the AI cost under three Claude plans and let the operator choose the one that drives the headline
cost, the role table and the report summary: Enterprise (seat fee plus token usage at the per-role token rates), Team
(Standard or Premium seat per role; annual billing as minimum, monthly as maximum) and Individual (everyone on Max as
minimum, everyone on Ultra / Max 20x as maximum). Seats per resource line are the line's peak AI FTE rounded up to whole
people, paid in whole months for the weeks the line is active on the AI timeline. Plan prices live in the config.

#### Scenario: Team plan
- **WHEN** the operator chooses the Team plan for the worked example (14 people, 28 seat-months; 10 Standard, 18 Premium)
- **THEN** the AI cost is USD 2,000 (annual billing) to USD 2,500 (monthly billing)

#### Scenario: Report
- **WHEN** the Excel report is downloaded
- **THEN** its AI Cost sheet compares all three plans with a per-role breakdown, and the Summary names the chosen plan
