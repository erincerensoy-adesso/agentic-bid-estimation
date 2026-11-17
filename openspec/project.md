# Project Context

## Purpose
Agentic Estimation Platform (bid estimation app): turns a manual (no-AI) baseline staffing timeline plus information about a bid into an AI
productivity gain per role, AI-adjusted effort, token cost, a calculated AI timeline and an Excel comparison report.
Source specification: "Bid Estimation App — MVP Specification", v0.2, 15 November 2026.

## Tech Stack
- Next.js (App Router) + TypeScript, single package; UI and server routes in one process
- exceljs, unpdf, mammoth, @anthropic-ai/sdk with zod; vitest for unit tests

## Project Conventions
- All calculation parameters live in `config/estimation.config.json`; the model catalog in `config/model-catalog.json`
- `lib/calc.ts` is pure and side-effect-free; every formula change needs a unit test
- Commit messages in imperative mood

## Important Constraints
- Internal tool for adesso; English only; no login
- The only secret is `ANTHROPIC_API_KEY`, kept in a git-ignored `.env.local` and used server-side only
- RFP content is untrusted data and is not stored
