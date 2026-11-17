## Context
The app is a separate product from the Tech Radar but lives in this repository. The spec leaves the stack to the
implementer and requires a pure, unit-tested calculation module, sub-200 ms recalculation and a one-command start.

## Decisions
- **Single Next.js TypeScript app** rather than the repository's Next.js + Python split: the calculation runs in the
  browser for instant recalculation and on the server for the export, so one language lets both share `lib/calc.ts`.
- **Config as JSON files** read at build/start time: editable without code changes, no admin screen.
- **Browser persistence** (`localStorage`) for the single current bid; RFP files are never persisted.
- **LLM pre-fill** uses structured outputs (zod schema) so each answer is either a level with confidence, excerpt and
  location, or `not_found`. The RFP is wrapped in tags and declared untrusted in the system prompt.

## Risks / Trade-offs
- The parser was built against a reconstructed fixture; the real template may contain layout variations
  → header lookup is by name, week columns by position between `Role` and `Total`.
- Spec 6.5 says no second "suggested" value is shown, while 8.1 lists a computed-gain column in the role table
  → the table shows both, following 8.1; to be confirmed by the product owner.
