"use client";

import { useId, useState, type Dispatch } from "react";
import { activeRange, baselinePD } from "@/lib/calc";
import { config } from "@/lib/config";
import { fmtPD } from "@/lib/format";
import { proposeRole } from "@/lib/roleMapping";
import type { Action, BidState } from "@/lib/state";
import type { Capability, Role } from "@/lib/types";

const CAPS: Capability[] = ["AI Native", "AI Adaptive"];
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Mini bar chart of FTE per week. */
function Spark({ values, max, label, strong }: { values: number[]; max: number; label: string; strong?: boolean }) {
  return (
    <span className={`spark ${strong ? "strong" : ""}`} role="img" aria-label={label}>
      {values.map((v, i) => (
        <i key={i} className={v ? "" : "zero"} style={{ height: v ? `${Math.max(4, Math.round((v / max) * 32))}px` : "2px" }} />
      ))}
    </span>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`check-item ${ok ? "ok" : "warn"}`}>
      <span className="check-icon" aria-hidden="true">{ok ? "✓" : "!"}</span>
      <span>{children}</span>
    </li>
  );
}

export function TimelineStep({ state, dispatch }: { state: BidState; dispatch: Dispatch<Action> }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
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

  const fileInput = (
    <input
      id={inputId}
      className="sr-only"
      type="file"
      accept=".xlsx"
      disabled={busy}
      onChange={(e) => {
        void upload(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  const errorBox = errors.length > 0 && (
    <div className="notice error">
      <strong>The timeline could not be used:</strong>
      <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
    </div>
  );

  const intro = (
    <div className="page-title survey-title">
      <h1>Staffing &amp; Skills</h1>
      <p>
        Upload the baseline: the manual, no-AI staffing plan in the Timeline Template format. Then check each line’s role
        and set the person capability of the people on it.
      </p>
    </div>
  );

  if (!t) {
    return (
      <section>
        {intro}
        <section className="panel upload-empty" aria-labelledby="upload-h">
          <h2 id="upload-h">Baseline timeline</h2>
          <p className="side-text">An Excel file (.xlsx) in the Timeline Template layout: month labels, working days and headers in the first three rows, one resource line per row with FTE per week.</p>
          {fileInput}
          <label htmlFor={inputId} className="btn primary icon upload-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21V9" /><path d="M7 14l5-5 5 5" /><path d="M5 3h14" /></svg>
            {busy ? "Reading…" : "Choose Excel file"}
          </label>
          {errorBox}
        </section>
      </section>
    );
  }

  const weeks = t.workingDays.length;
  const pds = t.lines.map((l) => baselinePD(l.fte, t.workingDays));
  const totalPD = pds.reduce((a, b) => a + b, 0);
  const lineMax = Math.max(0.5, ...t.lines.flatMap((l) => l.fte));
  const totals = t.workingDays.map((_, w) => t.lines.reduce((a, l) => a + (l.fte[w] || 0), 0));
  const totalMax = Math.max(0.5, ...totals);
  const unmapped = t.lines.filter((l) => !l.role).length;
  const auto = t.lines.filter((l) => l.role && l.role === proposeRole(l.title, config.roleMapping)).length;
  const missingCap = t.lines.filter((l) => !l.capability).length;
  const native = t.lines.filter((l) => l.capability === "AI Native").length;
  const adaptive = t.lines.filter((l) => l.capability === "AI Adaptive").length;
  const ready = unmapped === 0 && missingCap === 0;

  const mix = config.roles.map((role) => {
    const idx = t.lines.map((l, i) => (l.role === role ? i : -1)).filter((i) => i >= 0);
    return { role, pd: idx.reduce((a, i) => a + pds[i], 0), n: idx.length };
  });
  const mixMax = Math.max(1, ...mix.map((m) => m.pd));

  return (
    <section>
      {intro}

      <div className="staff-cards">
        <section className="side-card" aria-labelledby="file-h">
          <div className="side-row">
            <h2 id="file-h">Baseline timeline</h2>
            {fileInput}
            <label htmlFor={inputId} className="btn icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21V9" /><path d="M7 14l5-5 5 5" /><path d="M5 3h14" /></svg>
              {busy ? "Reading…" : "Replace file"}
            </label>
          </div>
          <div className="file-row">
            <span className="file-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13l2 2 4-4" /></svg>
            </span>
            <span className="file-meta">
              <strong>{t.fileName}</strong>
              <span>{t.warnings.length ? `Read with ${t.warnings.length} warning${t.warnings.length > 1 ? "s" : ""}` : "Read without errors"} · totals recalculated</span>
            </span>
          </div>
          <dl className="file-figures">
            <div><dt>Resource lines</dt><dd>{t.lines.length}</dd></div>
            <div><dt>Weeks</dt><dd>{weeks}</dd></div>
            <div><dt>Baseline PD</dt><dd>{int.format(totalPD)}</dd></div>
          </dl>
          {errorBox}
        </section>

        <section className="side-card" aria-labelledby="checks-h">
          <h2 id="checks-h">Checks</h2>
          <ul className="checks">
            <Check ok={t.warnings.length === 0}>
              {t.warnings.length === 0
                ? `Template read: ${weeks} week columns, working days found for every week`
                : `Template read with ${t.warnings.length} warning${t.warnings.length > 1 ? "s" : ""}`}
            </Check>
            {t.warnings.map((w) => <Check key={w} ok={false}>{w}</Check>)}
            <Check ok={unmapped === 0}>
              {unmapped === 0
                ? `Every line is mapped to a role (${auto} auto-mapped)`
                : `${unmapped} line${unmapped > 1 ? "s need" : " needs"} a role`}
            </Check>
            <Check ok={missingCap === 0}>
              {missingCap === 0 ? "Every line has a person capability" : `${missingCap} line${missingCap > 1 ? "s need" : " needs"} a person capability`}
            </Check>
          </ul>
          <p className="side-text checks-foot">{ready ? "Ready. Continue to Models & Harness." : "Complete the open items to continue."}</p>
        </section>

        <section className="side-card" aria-labelledby="mix-h">
          <div className="side-row">
            <h2 id="mix-h">Role mix</h2>
            <span className="side-text">Baseline PD · lines</span>
          </div>
          {mix.map((m) => (
            <div className="mix-row" key={m.role}>
              <span className="re-role">{m.role}</span>
              <span className="re-track"><span style={{ width: `${(m.pd / mixMax) * 100}%`, background: "var(--bar-base)" }} /></span>
              <span className="mix-val">{int.format(m.pd)} · {m.n}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="panel" aria-labelledby="lines-h">
        <div className="panel-head">
          <div className="panel-title" style={{ marginBottom: 0 }}>
            <h2 id="lines-h">Resource lines</h2>
            <p>A line with more than 1 FTE shares one capability. If the people on a line differ, split it in Excel and upload again.</p>
          </div>
          <div className="bulk">
            <span className="side-text">Set all lines to</span>
            {CAPS.map((c) => (
              <button key={c} className="btn" onClick={() => dispatch({ type: "setAllCapabilities", capability: c })}>{c}</button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="roles-table staff-table">
            <thead>
              <tr>
                <th>Line</th>
                <th>Role</th>
                <th>Person capability</th>
                <th>Staffing W1–W{weeks} (FTE)</th>
                <th className="num">Weeks</th>
                <th className="num">Baseline PD</th>
              </tr>
            </thead>
            <tbody>
              {t.lines.map((l, i) => {
                const { activeWeeks } = activeRange(l.fte);
                const proposed = proposeRole(l.title, config.roleMapping);
                const label = `${l.title}, ${l.techDomain}`;
                const peak = Math.max(...l.fte);
                return (
                  <tr key={l.id} className={!l.capability || !l.role ? "needs" : ""}>
                    <td>
                      <span className="line-title">{l.title}</span>
                      <span className="line-sub">{[l.techDomain, l.name, `row ${l.row}`].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td>
                      <select
                        className={!l.role ? "missing" : ""}
                        value={l.role ?? ""}
                        onChange={(e) => dispatch({ type: "setLineRole", lineId: l.id, role: (e.target.value || null) as Role | null })}
                        aria-label={`Role for ${label}`}
                      >
                        <option value="">Choose…</option>
                        {config.roles.map((r) => <option key={r}>{r}</option>)}
                      </select>
                      <span className="line-sub">
                        {!l.role ? "No match in the title: choose a role" : l.role === proposed ? "Auto-mapped from title" : "Set by you"}
                      </span>
                    </td>
                    <td>
                      <div className={`seg ${!l.capability ? "open" : ""}`} role="radiogroup" aria-label={`Person capability for ${label}`}>
                        {CAPS.map((c) => (
                          <button
                            key={c}
                            role="radio"
                            aria-checked={l.capability === c}
                            className={l.capability === c ? "on" : ""}
                            onClick={() => dispatch({ type: "setLineCapability", lineId: l.id, capability: c })}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                      {!l.capability && <span className="choose">Choose one</span>}
                    </td>
                    <td>
                      <Spark values={l.fte} max={lineMax} label={`Staffing over ${weeks} weeks, ${activeWeeks} active weeks, peak ${peak} FTE`} />
                    </td>
                    <td className="num">{activeWeeks}</td>
                    <td className="num strong">{fmtPD(pds[i])}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td></td>
                <td className="foot-caps">
                  {native} AI Native · {adaptive} AI Adaptive{missingCap ? ` · ${missingCap} open` : ""}
                </td>
                <td>
                  <Spark values={totals} max={totalMax} strong label={`Total FTE per week, peaking at ${Math.max(...totals)} FTE`} />
                </td>
                <td className="num">{weeks}</td>
                <td className="num">{fmtPD(totalPD)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </section>
  );
}
