"use client";

import { useMemo, useState, type Dispatch } from "react";
import type { CalcResult } from "@/lib/calc";
import { config, modelCatalog } from "@/lib/config";
import type { Action, BidState } from "@/lib/state";
import type { ModelEntry, ModelTier } from "@/lib/types";

const LICENCES = ["All", "Closed", "Open weights", "UAE sovereign"] as const;
type Licence = (typeof LICENCES)[number];

const TIERS: { tier: ModelTier; meaning: string; m: string; cls: string }[] = [
  { tier: "AI Native", meaning: "Can carry adFactory’s autonomous lanes end to end", m: "1.00 (0.85 if borderline)", cls: "native" },
  { tier: "AI Assisted", meaning: "Capable, but a person must review and steer every output", m: "0.50", cls: "assisted" },
  { tier: "Not Recommended", meaning: "Too weak for adFactory’s agent workflows", m: "0", cls: "notrec" },
  { tier: "Unproven", meaning: "No qualifying score yet (UAE sovereign models)", m: "0", cls: "unproven" },
];

export function ModelsStep({ state, dispatch, result }: { state: BidState; dispatch: Dispatch<Action>; result: CalcResult }) {
  const [q, setQ] = useState("");
  const [vendor, setVendor] = useState("");
  const [licence, setLicence] = useState<Licence>("All");
  const [open, setOpen] = useState<Record<string, boolean>>({ "AI Native": true });
  const vendors = useMemo(() => [...new Set(modelCatalog.map((m) => m.vendor))].sort(), []);
  const selected = new Set(state.allowedModelIds);
  const filtering = q.trim() !== "" || vendor !== "" || licence !== "All";

  const matches = (m: ModelEntry) =>
    (!q || `${m.name} ${m.vendor} ${m.notes}`.toLowerCase().includes(q.trim().toLowerCase())) &&
    (!vendor || m.vendor === vendor) &&
    (licence === "All" || m.licence === licence);
  const shown = modelCatalog.filter(matches);
  const allShownTicked = shown.length > 0 && shown.every((m) => selected.has(m.id));

  function toggleAllShown() {
    const ids = new Set(state.allowedModelIds);
    for (const m of shown) {
      if (allShownTicked) ids.delete(m.id);
      else ids.add(m.id);
    }
    dispatch({ type: "setModels", ids: [...ids] });
  }

  const mie = result.modelInEffect;
  const hie = result.harnessInEffect;
  const E = mie.model && hie ? mie.M * result.H : null;
  const pctNative = E == null ? null : Math.round(E * config.personFactors["AI Native"] * 100);
  const pctAdaptive = E == null ? null : Math.round(E * config.personFactors["AI Adaptive"] * 100);
  const allowed = state.allowedModelIds.map((id) => modelCatalog.find((m) => m.id === id)).filter((m): m is ModelEntry => Boolean(m));

  return (
    <section>
      <div className="page-title survey-title">
        <h1>Models &amp; Harness</h1>
        <p>Tick every model and harness the client allows. The calculation uses the best model tier and the best harness among those ticked.</p>
      </div>

      <section className="panel" aria-labelledby="effect-h">
        <h2 id="effect-h">In effect</h2>
        <div className="effect-row">
          <div className="effect-box">
            <span className="effect-label">Best allowed model</span>
            <span className="effect-value">{mie.model?.name ?? "None selected"}</span>
            <span className="effect-sub">{mie.model ? <>{mie.tierLabel} · M <strong>{mie.M.toFixed(2)}</strong></> : "No model allowed yet"}</span>
          </div>
          <span className="effect-op" aria-hidden="true">×</span>
          <div className="effect-box">
            <span className="effect-label">Best allowed harness</span>
            <span className="effect-value">{hie?.name ?? "None selected"}</span>
            <span className="effect-sub">{hie ? <>H <strong>{result.H.toFixed(2)}</strong></> : "No harness allowed yet"}</span>
          </div>
          <span className="effect-op" aria-hidden="true">=</span>
          <div className="effect-box result">
            <span className="effect-label">AI enablement</span>
            <span className="effect-big">
              <strong>{E == null ? "—" : `${Math.round(E * 100)}%`}</strong>
              <span>of each role’s potential gain</span>
            </span>
            <span className="effect-sub">
              {E == null
                ? "Select at least one model and one harness."
                : `AI Native people reach ${pctNative}% of the way from their role’s minimum to its potential gain; AI Adaptive people ${pctAdaptive}%.`}
            </span>
          </div>
        </div>
        {result.blockingWarning && <div className="notice error">{result.blockingWarning}</div>}
        <div className="chips">
          <span className="side-text">{allowed.length} allowed{allowed.length ? ":" : ""}</span>
          {allowed.map((m) => (
            <button key={m.id} className="chip" onClick={() => dispatch({ type: "toggleModel", id: m.id, on: false })} aria-label={`Remove ${m.name}`}>
              <span className={`tier-dot ${TIERS.find((t) => t.tier === m.tier)?.cls}`} aria-hidden="true" />
              {m.name}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
            </button>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="harness-h">
        <div className="panel-title">
          <h2 id="harness-h">Allowed harnesses</h2>
          <p>The tooling the team works in. H is how much of the possible gain it lets the team capture.</p>
        </div>
        <div className="harness-grid">
          {config.harnesses.map((h) => {
            const on = state.allowedHarnessIds.includes(h.id);
            return (
              <label key={h.id} className={`harness-card ${on ? "on" : ""}`}>
                <span className="harness-top">
                  <input type="checkbox" checked={on} onChange={(e) => dispatch({ type: "toggleHarness", id: h.id, on: e.target.checked })} />
                  <span>{h.name}</span>
                </span>
                <span className="harness-bar">
                  <span className="re-track"><span style={{ width: `${h.factor * 100}%` }} /></span>
                  <span>H {h.factor.toFixed(2)}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="panel" aria-labelledby="models-h">
        <div className="panel-title">
          <h2 id="models-h">Allowed models</h2>
          <p>From the adFactory Model Comparison study. Tiers come from Scale-run SWE-Bench Pro or DeepSWE v1.1 scores.</p>
        </div>
        <div className="model-filters">
          <label className="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search models, vendors or notes" aria-label="Search models" />
          </label>
          <div className="seg" role="radiogroup" aria-label="Licence">
            {LICENCES.map((l) => (
              <button key={l} role="radio" aria-checked={licence === l} className={licence === l ? "on" : ""} onClick={() => setLicence(l)}>{l}</button>
            ))}
          </div>
          <select value={vendor} onChange={(e) => setVendor(e.target.value)} aria-label="Vendor">
            <option value="">All vendors</option>
            {vendors.map((v) => <option key={v}>{v}</option>)}
          </select>
          <button className="btn" onClick={toggleAllShown} disabled={shown.length === 0}>
            {allShownTicked ? "Untick" : "Tick"} all shown ({shown.length})
          </button>
        </div>

        <div className="tier-groups">
          {TIERS.map((t) => {
            const rows = shown.filter((m) => m.tier === t.tier);
            const total = modelCatalog.filter((m) => m.tier === t.tier).length;
            const ticked = modelCatalog.filter((m) => m.tier === t.tier && selected.has(m.id)).length;
            // While filtering, groups with matches open by themselves so results are never hidden.
            const isOpen = filtering ? rows.length > 0 : Boolean(open[t.tier]);
            const bodyId = `tier-${t.cls}`;
            return (
              <div key={t.tier} className="tier-group">
                <button
                  className="tier-head"
                  aria-expanded={isOpen}
                  aria-controls={bodyId}
                  onClick={() => setOpen({ ...open, [t.tier]: !isOpen })}
                  disabled={filtering && rows.length === 0}
                >
                  <svg className={`chev ${isOpen ? "open" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                  <span className={`tier-pill ${t.cls}`}>{t.tier}</span>
                  <span className="tier-meaning">{t.meaning}</span>
                  <span className="tier-m">M {t.m}</span>
                  <span className="tier-count">{filtering ? `${rows.length} shown · ` : ""}{ticked} of {total} ticked</span>
                </button>
                {isOpen && rows.length > 0 && (
                  <div className="table-wrap" id={bodyId}>
                    <table className="model-table">
                      <thead>
                        <tr>
                          <th><span className="sr-only">Allowed</span></th>
                          <th>Model</th><th>Vendor (origin)</th><th>Licence</th><th>Score</th><th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((m) => {
                          const on = selected.has(m.id);
                          return (
                            <tr key={m.id} className={on ? "selected" : ""}>
                              <td><input type="checkbox" checked={on} onChange={(e) => dispatch({ type: "toggleModel", id: m.id, on: e.target.checked })} aria-label={`Allow ${m.name}`} /></td>
                              <td className="model-name">
                                {m.name}
                                {m.borderline && (
                                  <span className="pill" title={m.tier === "AI Native" ? "Flagged borderline in the study (M = 0.85)" : "Flagged borderline in the study"}>borderline</span>
                                )}
                              </td>
                              <td>{m.vendor} ({m.origin})</td>
                              <td>{m.licence}</td>
                              <td>{m.score ? <>{m.score} <span className="muted-num small">{m.benchmark}</span></> : <span className="muted-num">—</span>}</td>
                              <td className="notes">{m.notes}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          {shown.length === 0 && <p className="side-text">No model matches these filters.</p>}
        </div>
      </section>
    </section>
  );
}
