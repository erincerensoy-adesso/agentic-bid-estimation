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
The system SHALL compute per-role complexity from the weighted survey, a geometric gain potential from 10x to 2x,
per-line enablement from the best allowed model tier, best allowed harness and person capability, and a per-line gain
of `FLOOR + (Potential − FLOOR) × E`, with role gain as baseline PD over adjusted PD.

#### Scenario: Worked example
- **WHEN** the spec section 11 inputs are entered
- **THEN** total adjusted PD is 331.2, overall gain 4.86x, token cost USD 18,423 to 32,813, and the AI timeline is 8 weeks

#### Scenario: No capable model
- **WHEN** no allowed model reaches the AI Assisted tier
- **THEN** every gain is 1.50x and a blocking warning is shown

### Requirement: Manual override
The system SHALL offer one slider per role from 1.5x to 10x in 0.1 steps, set to the computed gain, whose value replaces
the gain of every line of that role, with a Reset control.

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
