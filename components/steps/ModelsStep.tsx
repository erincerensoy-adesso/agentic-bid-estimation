"use client";

import { useMemo, useState, type Dispatch } from "react";
import type { CalcResult } from "@/lib/calc";
import { config, modelCatalog } from "@/lib/config";
import type { Action, BidState } from "@/lib/state";
import type { ModelTier } from "@/lib/types";

const TIERS: ModelTier[] = ["AI Native", "AI Assisted", "Not Recommended", "Unproven"];
const LICENCES = ["Closed", "Open weights", "UAE sovereign"] as const;

export function ModelsStep({ state, dispatch, result }: { state: BidState; dispatch: Dispatch<Action>; result: CalcResult }) {
  const [q, setQ] = useState("");
  const [vendor, setVendor] = useState("");
  const [licence, setLicence] = useState("");
  const [tier, setTier] = useState("");
  const vendors = useMemo(() => [...new Set(modelCatalog.map((m) => m.vendor))].sort(), []);
  const filtered = modelCatalog.filter(
    (m) =>
      (!q || `${m.name} ${m.vendor} ${m.notes}`.toLowerCase().includes(q.toLowerCase())) &&
      (!vendor || m.vendor === vendor) &&
      (!licence || m.licence === licence) &&
      (!tier || m.tier === tier),
  );
  const selected = new Set(state.allowedModelIds);
  const allFilteredSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id));

  function toggleAllFiltered() {
    const ids = new Set(state.allowedModelIds);
    for (const m of filtered) allFilteredSelected ? ids.delete(m.id) : ids.add(m.id);
    dispatch({ type: "setModels", ids: [...ids] });
  }

  return (
    <section>
      <h1>Models and harness</h1>
      <p className="lead">Tick everything the client allows. The calculation uses the best model tier and the best harness among those ticked.</p>

      <div className="inputs-in-effect">
        <div><span className="muted">Best allowed model</span><strong>{result.modelInEffect.model?.name ?? "—"}</strong></div>
        <div><span className="muted">Model tier</span><strong>{result.modelInEffect.tierLabel ?? "—"}</strong></div>
        <div><span className="muted">M</span><strong>{result.modelInEffect.model ? result.modelInEffect.M.toFixed(2) : "—"}</strong></div>
        <div><span className="muted">Harness in effect</span><strong>{result.harnessInEffect?.name ?? "—"}</strong></div>
        <div><span className="muted">H</span><strong>{result.harnessInEffect ? result.H.toFixed(2) : "—"}</strong></div>
      </div>
      {result.blockingWarning && <div className="notice error">{result.blockingWarning}</div>}

      <div className="card">
        <h2>Allowed harnesses</h2>
        <div className="checklist">
          {config.harnesses.map((h) => (
            <label key={h.id} className="check">
              <input
                type="checkbox"
                checked={state.allowedHarnessIds.includes(h.id)}
                onChange={(e) => dispatch({ type: "toggleHarness", id: h.id, on: e.target.checked })}
              />
              <span>{h.name}</span>
              <span className="pill">H {h.factor.toFixed(2)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Allowed models <span className="muted small">({state.allowedModelIds.length} selected)</span></h2>
        <div className="filters">
          <input placeholder="Search models" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search models" />
          <select value={vendor} onChange={(e) => setVendor(e.target.value)} aria-label="Vendor">
            <option value="">All vendors</option>
            {vendors.map((v) => <option key={v}>{v}</option>)}
          </select>
          <select value={licence} onChange={(e) => setLicence(e.target.value)} aria-label="Licence type">
            <option value="">All licences</option>
            {LICENCES.map((v) => <option key={v}>{v}</option>)}
          </select>
          <select value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Model tier">
            <option value="">All tiers</option>
            {TIERS.map((v) => <option key={v}>{v}</option>)}
          </select>
          <button className="btn small" onClick={toggleAllFiltered} disabled={filtered.length === 0}>
            {allFilteredSelected ? "Untick" : "Tick"} all shown ({filtered.length})
          </button>
        </div>
        <div className="table-wrap tall">
          <table>
            <thead>
              <tr><th></th><th>Model</th><th>Vendor (origin)</th><th>Licence</th><th>Model tier</th><th>Score</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className={selected.has(m.id) ? "selected" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      onChange={(e) => dispatch({ type: "toggleModel", id: m.id, on: e.target.checked })}
                      aria-label={`Allow ${m.name}`}
                    />
                  </td>
                  <td>{m.name}</td>
                  <td>{m.vendor} ({m.origin})</td>
                  <td>{m.licence}</td>
                  <td>
                    <span className={`tier tier-${m.tier.replace(/\s/g, "-").toLowerCase()}`}>{m.tier}</span>
                    {m.borderline && (
                      <span className="pill" title={m.tier === "AI Native" ? "Flagged borderline in the study (M = 0.85)" : "Flagged borderline in the study"}>
                        borderline
                      </span>
                    )}
                  </td>
                  <td>{m.score ? <>{m.score} <span className="muted small">{m.benchmark}</span></> : <span className="muted">—</span>}</td>
                  <td className="notes">{m.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
