"use client";

import { useState, type Dispatch } from "react";
import { activeRange, baselinePD } from "@/lib/calc";
import { config } from "@/lib/config";
import { fmtPD } from "@/lib/format";
import type { Action, BidState } from "@/lib/state";
import type { Capability, Role } from "@/lib/types";

const CAPS: Capability[] = ["AI Native", "AI Adaptive"];

export function TimelineStep({ state, dispatch }: { state: BidState; dispatch: Dispatch<Action> }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const t = state.timeline;

  async function upload(file: File | undefined) {
    if (!file) return;
    if (t && !confirm("Replace the current timeline? Role mappings, capabilities and gain overrides will be reset.")) return;
    setBusy(true);
    setErrors([]);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/timeline", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) setErrors(body.errors ?? ["The timeline could not be parsed."]);
      else dispatch({ type: "setTimeline", timeline: body.timeline });
    } catch {
      setErrors(["The server could not be reached."]);
    } finally {
      setBusy(false);
    }
  }

  const totals = t ? t.lines.reduce((a, l) => a + baselinePD(l.fte, t.workingDays), 0) : 0;
  const weeks = t ? t.workingDays.length : 0;

  return (
    <section>
      <h1>Staffing &amp; Skills</h1>
      <p className="lead">
        Upload the baseline: the manual, no-AI estimate in the Timeline Template format. Then check each line&apos;s role
        and set its person capability (AI Native or AI Adaptive).
      </p>
      <p className="lead small">
        A line with more than 1 FTE shares one capability. If the people on a line differ, split it in Excel and upload again.
      </p>
      <div className="card">
        <input type="file" accept=".xlsx" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} disabled={busy} />
        {busy && <span className="muted"> Parsing…</span>}
        {errors.length > 0 && (
          <div className="notice error">
            <strong>The timeline could not be used:</strong>
            <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}
        {t?.warnings.map((w, i) => <div key={i} className="notice warn">{w}</div>)}
      </div>

      {t && (
        <>
          <div className="stats">
            <div className="stat"><span className="stat-label">File</span><span className="stat-value small">{t.fileName}</span></div>
            <div className="stat"><span className="stat-label">Resource lines</span><span className="stat-value">{t.lines.length}</span></div>
            <div className="stat"><span className="stat-label">Week columns</span><span className="stat-value">{weeks}</span></div>
            <div className="stat"><span className="stat-label">Baseline PD</span><span className="stat-value">{fmtPD(totals)}</span></div>
          </div>
          <div className="toolbar">
            <span className="muted">Set person capability for all lines:</span>
            {CAPS.map((c) => (
              <button key={c} className="btn small" onClick={() => dispatch({ type: "setAllCapabilities", capability: c })}>{c}</button>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Row</th><th>Tech domain</th><th>Name</th><th>Title</th><th>Role</th><th>Person capability</th>
                  <th className="num">Active weeks</th><th className="num">Baseline PD</th>
                </tr>
              </thead>
              <tbody>
                {t.lines.map((l) => {
                  const { activeWeeks } = activeRange(l.fte);
                  return (
                    <tr key={l.id}>
                      <td className="muted">{l.row}</td>
                      <td>{l.techDomain}</td>
                      <td>{l.name}</td>
                      <td>{l.title}</td>
                      <td>
                        <select
                          className={!l.role ? "missing" : ""}
                          value={l.role ?? ""}
                          onChange={(e) => dispatch({ type: "setLineRole", lineId: l.id, role: (e.target.value || null) as Role | null })}
                          aria-label={`Role for ${l.title}`}
                        >
                          <option value="">Choose…</option>
                          {config.roles.map((r) => <option key={r}>{r}</option>)}
                        </select>
                      </td>
                      <td>
                        <select
                          className={!l.capability ? "missing" : ""}
                          value={l.capability ?? ""}
                          onChange={(e) => dispatch({ type: "setLineCapability", lineId: l.id, capability: (e.target.value || null) as Capability | null })}
                          aria-label={`Person capability for ${l.title}`}
                        >
                          <option value="">Choose…</option>
                          {CAPS.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="num">{activeWeeks}</td>
                      <td className="num">{fmtPD(baselinePD(l.fte, t.workingDays))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <details className="card">
            <summary>Baseline grid (FTE per week)</summary>
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr><th>Title</th>{t.workingDays.map((d, i) => <th key={i} className="num" title={`${d} working days`}>W{i + 1}</th>)}</tr>
                </thead>
                <tbody>
                  {t.lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.techDomain} · {l.title}</td>
                      {l.fte.map((f, i) => <td key={i} className={`num ${f ? "filled" : ""}`}>{f || ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
