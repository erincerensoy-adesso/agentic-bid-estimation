"use client";

import type { Dispatch } from "react";
import type { CalcResult } from "@/lib/calc";
import { config } from "@/lib/config";
import { fmt2, fmt3, fmtGain, fmtPD, fmtUSD } from "@/lib/format";
import type { Action, BidState } from "@/lib/state";
import { ComparisonChart } from "../ComparisonChart";
import { ExportButton } from "../ExportButton";

export function ResultsStep({ state, dispatch, result }: { state: BidState; dispatch: Dispatch<Action>; result: CalcResult }) {
  if (!result.ready) {
    return (
      <section>
        <h1>Results</h1>
        <div className="notice warn">
          <strong>Results and the Excel report are not available yet.</strong>
          <ul>{result.missing.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      </section>
    );
  }

  const t = result.aiTimeline!;
  const { totals } = result;
  const s = config.slider;
  const slowest = result.lines.find((l) => l.line.id === t.slowestLineId);

  return (
    <section>
      <div className="page-head">
        <h1>Results</h1>
        <ExportButton state={state} result={result} />
      </div>
      {result.blockingWarning && <div className="notice error">{result.blockingWarning}</div>}
      {result.warnings.map((w, i) => <div key={i} className="notice warn">{w}</div>)}

      <div className="stats">
        <Stat label="Baseline PD" value={fmtPD(totals.baselinePD)} />
        <Stat label="AI-adjusted PD" value={fmtPD(totals.adjustedPD)} />
        <Stat label="PD saved" value={fmtPD(totals.pdSaved)} />
        <Stat label="Overall gain" value={fmtGain(totals.overallGain)} accent />
        <Stat label="Baseline weeks" value={String(t.baselineWeeks)} />
        <Stat label="AI weeks" value={String(t.aiWeeks)} accent />
        <Stat label="Token cost" value={`${fmtUSD(totals.tokenCostMin)} – ${fmtUSD(totals.tokenCostMax)}`} />
      </div>

      <div className="card">
        <h2>Inputs in effect</h2>
        <div className="inputs-in-effect">
          <div><span className="muted">Best allowed model</span><strong>{result.modelInEffect.model?.name}</strong></div>
          <div><span className="muted">Model tier</span><strong>{result.modelInEffect.tierLabel}</strong></div>
          <div><span className="muted">M</span><strong>{result.modelInEffect.M.toFixed(2)}</strong></div>
          <div><span className="muted">Harness</span><strong>{result.harnessInEffect?.name}</strong></div>
          <div><span className="muted">H</span><strong>{result.H.toFixed(2)}</strong></div>
        </div>
        {!result.blockingWarning && result.warnings.length === 0 && <p className="muted small">No warnings.</p>}
      </div>

      <div className="card">
        <h2>Gain per role</h2>
        <p className="muted small">Drag a slider to override a role&apos;s gain ({s.min}x–{s.max}x). The override applies to every line of that role.</p>
        <div className="table-wrap">
          <table className="roles">
            <thead>
              <tr>
                <th>Role</th><th className="num">Baseline PD</th><th className="num">Complexity</th><th className="num">Computed gain</th>
                <th className="slider-col">Applied gain</th><th className="num">Adjusted PD</th><th className="num">PD saved</th>
                <th className="num">FTE-months</th><th className="num">Token min</th><th className="num">Token max</th>
              </tr>
            </thead>
            <tbody>
              {result.roles.map((r) => (
                <tr key={r.role} className={r.overridden ? "overridden" : ""}>
                  <td>{r.role}</td>
                  <td className="num">{fmtPD(r.baselinePD)}</td>
                  <td className="num">{fmt3(r.complexity)}</td>
                  <td className="num">{fmtGain(r.computedGain)}</td>
                  <td className="slider-col">
                    <div className="slider">
                      <input
                        type="range"
                        min={s.min}
                        max={s.max}
                        step={s.step}
                        value={r.appliedGain}
                        onChange={(e) => dispatch({ type: "setOverride", role: r.role, gain: Number(e.target.value) })}
                        aria-label={`Gain for ${r.role}`}
                      />
                      <output>{fmtGain(r.appliedGain)}</output>
                      {r.overridden ? (
                        <button className="btn tiny" onClick={() => dispatch({ type: "setOverride", role: r.role, gain: null })}>Reset</button>
                      ) : <span className="reset-placeholder" />}
                    </div>
                  </td>
                  <td className="num">{fmtPD(r.adjustedPD)}</td>
                  <td className="num">{fmtPD(r.pdSaved)}</td>
                  <td className="num">{fmt2(r.fteMonths)}</td>
                  <td className="num">{fmtUSD(r.tokenCostMin)}</td>
                  <td className="num">{fmtUSD(r.tokenCostMax)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{fmtPD(totals.baselinePD)}</td>
                <td></td><td></td>
                <td className="slider-col"><strong>{fmtGain(totals.overallGain)}</strong></td>
                <td className="num">{fmtPD(totals.adjustedPD)}</td>
                <td className="num">{fmtPD(totals.pdSaved)}</td>
                <td className="num">{fmt2(totals.fteMonths)}</td>
                <td className="num">{fmtUSD(totals.tokenCostMin)}</td>
                <td className="num">{fmtUSD(totals.tokenCostMax)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Baseline against AI-adjusted effort</h2>
        <ComparisonChart roles={result.roles} />
      </div>

      <div className="card">
        <h2>AI timeline</h2>
        <p className="muted small">
          {t.baselineWeeks} baseline weeks compressed by the slowest line
          {slowest && <> ({slowest.line.techDomain} · {slowest.line.title}, {fmtGain(t.slowestGain)})</>}: ceil({t.baselineWeeks} / {fmt2(t.slowestGain)}) = {t.aiWeeks} weeks. FTE per week; client waiting time is not modelled.
        </p>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Tech domain</th><th>Title</th>
                {Array.from({ length: t.aiWeeks }, (_, i) => <th key={i} className="num">W{i + 1}</th>)}
                <th className="num">PD</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((l) => {
                const a = t.lines.find((x) => x.lineId === l.line.id);
                return (
                  <tr key={l.line.id}>
                    <td>{l.line.techDomain}</td>
                    <td>{l.line.title}</td>
                    {Array.from({ length: t.aiWeeks }, (_, w) => {
                      const on = a && w >= a.startWeek && w < a.endWeek;
                      return <td key={w} className={`num ${on ? "filled" : ""}`}>{on ? fmt2(a!.fte) : ""}</td>;
                    })}
                    <td className="num">{fmtPD(l.adjustedPD)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <details className="card">
        <summary>Resource lines</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tech domain</th><th>Title</th><th>Role</th><th>Person capability</th>
                <th className="num">Baseline PD</th><th className="num">Gain</th><th className="num">Adjusted PD</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((l) => (
                <tr key={l.line.id}>
                  <td>{l.line.techDomain}</td><td>{l.line.title}</td><td>{l.role}</td><td>{l.capability}</td>
                  <td className="num">{fmtPD(l.baselinePD)}</td><td className="num">{fmtGain(l.appliedGain)}</td><td className="num">{fmtPD(l.adjustedPD)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {state.prefill.state === "running" && <p className="muted small">The RFP pre-fill is still running; survey answers may change.</p>}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`stat ${accent ? "accent" : ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
