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

- **Per-role gain ranges** replace the spec's single 10x-to-2x range (spec 6.2 said "no per-role caps"). Operator
  review of a real bid found Delivery Manager at 3.5x and RE at 3.4x, as high as Dev, which is not credible: those roles
  spend most of their time with people. Each role now has a floor, a gain at complexity 0 and a gain at complexity 1
  in the config. Starting values (floor / gain at complexity 0 / gain at complexity 1): floor 1.2x for every role
  (operator decision: even weak models save some time); Delivery Manager 1.6 / 1.2, RE and UX-UI 4 / 1.4,
  Architect 5 / 1.6, QA 6 / 1.8, DevOps 7 / 1.8, Dev 10 / 2.0. To be calibrated against reference bids.

- **Token usage follows the override.** The spec charges token rates on the remaining (AI-adjusted) effort, so lowering
  a gain raised token cost (more person-months at full AI spend). Operator decision: a gain lowered by the override means
  AI does less of the work, so token usage scales from 100% at the computed gain to 0% at 1.0x; at or above the computed
  gain usage stays full. Seats and subscriptions are unchanged.

## Risks / Trade-offs
- The parser was built against a reconstructed fixture; the real template may contain layout variations
  → header lookup is by name, week columns by position between `Role` and `Total`.
- Spec 6.5 says no second "suggested" value is shown, while 8.1 lists a computed-gain column in the role table
  → the table shows both, following 8.1; to be confirmed by the product owner.
