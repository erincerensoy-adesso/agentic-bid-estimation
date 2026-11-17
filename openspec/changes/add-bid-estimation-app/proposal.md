# Change: Add the Bid Estimation App (MVP)

## Why
Bid teams estimate project work manually as a traditional staffing timeline. They need a transparent, repeatable way to
derive the AI-adjusted effort, token cost and a compressed AI timeline from that baseline. The product owner's
specification ("Bid Estimation App — MVP Specification", v0.2, 15 November 2026) defines the behaviour.

## What Changes
- New standalone app in `bid-estimation/` (Next.js + TypeScript), independent of the Tech Radar app.
- Five-step wizard: Initials (bid and RFP upload), Staffing & Skills (baseline upload, role and capability review), Models & Harness (allowed models and harnesses), Domain Complexity (12-question
  complexity survey (LLM pre-fill from the RFP), Results with per-role override sliders and the Excel download.
- Formula-based gain per role and per resource line, token cost, and a calculated AI timeline.
- All parameters in `bid-estimation/config/estimation.config.json`; model catalog in `config/model-catalog.json`.

## Impact
- Affected specs: new capability `bid-estimation`.
- Affected code: new top-level directory `bid-estimation/` only. No change to `frontend/` or `backend/`.
- New secret: `ANTHROPIC_API_KEY` in `bid-estimation/.env.local` (git-ignored), used only server-side.
