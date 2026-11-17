"use client";

import type { Dispatch } from "react";
import type { CalcResult } from "@/lib/calc";
import { config } from "@/lib/config";
import { fmt2, fmt3, fmtGain, fmtPD, fmtUSD } from "@/lib/format";
import type { Action, BidState } from "@/lib/state";
import { ExportButton } from "../ExportButton";
import { PLAN_SHORT, PlanCards } from "../PlanCosts";

const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

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
  const plan = result.costs![state.pricingPlan];
  const planRole = (role: string) => plan.roles.find((r) => r.role === role)!;
  const lines = state.timeline!.lines;
  const native = lines.filter((l) => l.capability === "AI Native").length;
  const adaptive = lines.length - native;
  const answered = config.survey.filter((q) => state.answers[q.id]?.level != null).length;
  const gains = result.roles.map((r) => r.appliedGain);
  const minRole = result.roles.find((r) => r.appliedGain === Math.min(...gains))!;
  const maxRole = result.roles.find((r) => r.appliedGain === Math.max(...gains))!;
  const weeksSaved = t.baselineWeeks - t.aiWeeks;

  // What limits the AI duration, and what the next bottleneck would allow.
  const slowest = result.lines.find((l) => l.line.id === t.slowestLineId)!;
  const others = result.lines.filter((l) => l.activeWeeks > 0 && l.appliedGain > t.slowestGain + 1e-9);
  const next = others.length ? others.reduce((a, b) => (b.appliedGain < a.appliedGain ? b : a)) : null;
  const weeksWithoutSlowest = next ? Math.ceil(t.baselineWeeks / next.appliedGain - 1e-9) : null;

  const warnings = [...(result.blockingWarning ? [result.blockingWarning] : []), ...result.warnings];

  return (
    <section className="results">
      <div className="page-head">
        <div className="page-title">
          <h1>Results</h1>
          <p>
            {result.modelInEffect.model?.name} ({result.modelInEffect.tierLabel}) · {result.harnessInEffect?.name} · {lines.length} resource lines
          </p>
        </div>
        <ExportButton state={state} result={result} />
      </div>

      {result.blockingWarning && <div className="notice error">{result.blockingWarning}</div>}

      <div className="kpis" aria-label="Headline figures">
        <Kpi label="Effort" before={int.format(totals.baselinePD)} after={int.format(totals.adjustedPD)} unit="PD">
          <strong>−{int.format(totals.pdSaved)} PD</strong> · {pct(totals.pdSaved, totals.baselinePD)}% less effort
        </Kpi>
        <Kpi label="Duration" before={String(t.baselineWeeks)} after={String(t.aiWeeks)} unit="weeks">
          <strong>−{weeksSaved} weeks</strong> · {pct(weeksSaved, t.baselineWeeks)}% shorter
        </Kpi>
        <Kpi label="Overall gain" after={fmtGain(totals.overallGain)} accent>
          Range by role: {fmtGain(minRole.appliedGain)} ({minRole.role}) to {fmtGain(maxRole.appliedGain)} ({maxRole.role})
        </Kpi>
        <div className="kpi">
          <div className="kpi-label">AI cost · {PLAN_SHORT[state.pricingPlan]}</div>
          <div className="kpi-figure">
            <span className="kpi-cost">{fmtUSD(plan.min)}</span>
            <span className="kpi-before">to {fmtUSD(plan.max)}</span>
          </div>
          <div className="kpi-sub">{plan.people} people · {plan.seatMonths} seat-months</div>
        </div>
      </div>

      <div className="insight">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" />
        </svg>
        <p>
          The AI duration is set by the slowest line,{" "}
          <strong>{slowest.line.techDomain} · {slowest.line.title} at {fmtGain(slowest.appliedGain)}</strong>.
          {next && weeksWithoutSlowest != null && weeksWithoutSlowest < t.aiWeeks && (
            <> Without it, the next slowest line ({next.line.techDomain} · {next.line.title} at {fmtGain(next.appliedGain)}) would allow about {weeksWithoutSlowest} weeks.</>
          )}
        </p>
      </div>

      <div className="split">
        <section className="panel effort" aria-labelledby="effort-h">
          <div className="panel-head">
            <h2 id="effort-h">Effort by role</h2>
            <div className="legend" aria-hidden="true">
              <span><i className="sw base" />Baseline PD</span>
              <span><i className="sw ai" />AI-adjusted PD</span>
            </div>
          </div>
          <EffortBars roles={result.roles} />
        </section>

        <section className="panel inputs" aria-labelledby="inputs-h">
          <h2 id="inputs-h">Inputs in effect</h2>
          <dl>
            <div><dt>Best allowed model</dt><dd>{result.modelInEffect.model?.name}</dd></div>
            <div><dt>Model tier · M</dt><dd>{result.modelInEffect.tierLabel} · {result.modelInEffect.M.toFixed(2)}</dd></div>
            <div><dt>Harness</dt><dd>{result.harnessInEffect?.name}</dd></div>
            <div><dt>H</dt><dd>{result.H.toFixed(2)}</dd></div>
            <div><dt>People</dt><dd>{native} AI Native · {adaptive} AI Adaptive</dd></div>
            <div><dt>Survey</dt><dd>{answered} of {config.survey.length} answered</dd></div>
          </dl>
          {warnings.length === 0 ? (
            <div className="status ok">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
              No warnings
            </div>
          ) : (
            <ul className="status warn-list">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          )}
        </section>
      </div>

      <section className="panel" aria-labelledby="timeline-h">
        <div className="panel-head">
          <h2 id="timeline-h">AI timeline</h2>
          <div className="legend" aria-hidden="true">
            <span><i className="sw bar-base" />Baseline ({t.baselineWeeks} weeks)</span>
            <span><i className="sw bar-ai" />AI plan ({t.aiWeeks} weeks), FTE per week</span>
          </div>
        </div>
        <Gantt result={result} />
        <p className="footnote">Client-side waiting time (approvals, test cycles) is not modelled.</p>
      </section>

      <PlanCards result={result} plan={state.pricingPlan} dispatch={dispatch} />

      <section className="panel" aria-labelledby="roles-h">
        <div className="panel-title">
          <h2 id="roles-h">Gain per role</h2>
          <p>Drag a slider to override a role’s gain ({config.slider.min}x–{config.slider.max}x). Lowering it also lowers that role’s AI token use; seats are still charged.</p>
        </div>
        <div className="table-wrap">
          <table className="roles-table">
            <thead>
              <tr>
                <th>Role</th>
                <th className="num">Baseline PD</th>
                <th className="num">Complexity</th>
                <th>Gain</th>
                <th className="num">AI PD</th>
                <th className="num">Saved</th>
                <th className="num">AI cost · {PLAN_SHORT[state.pricingPlan]}</th>
              </tr>
            </thead>
            <tbody>
              {result.roles.map((r) => (
                <tr key={r.role} className={r.overridden ? "overridden" : ""}>
                  <td className="role">{r.role}</td>
                  <td className="num">{fmtPD(r.baselinePD)}</td>
                  <td className="num muted-num">{fmt3(r.complexity)}</td>
                  <td>
                    <div className="gain-cell">
                      <input
                        type="range"
                        min={config.slider.min}
                        max={config.slider.max}
                        step={config.slider.step}
                        value={r.appliedGain}
                        onChange={(e) => dispatch({ type: "setOverride", role: r.role, gain: Number(e.target.value) })}
                        aria-label={`Gain for ${r.role}`}
                      />
                      <output>{fmtGain(r.appliedGain)}</output>
                      {r.overridden && (
                        <>
                          <button className="btn tiny" onClick={() => dispatch({ type: "setOverride", role: r.role, gain: null })}>Reset</button>
                          <span className="hint">computed {fmtGain(r.computedGain)}</span>
                        </>
                      )}
                      {r.aiUsage < 1 && (
                        <span className="usage" title="Lowering the gain below the computed value scales AI token usage down, to 0% at 1.0x. Seats are still charged.">
                          AI use {Math.round(r.aiUsage * 100)}%
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="num">{fmtPD(r.adjustedPD)}</td>
                  <td className="num">{fmtPD(r.pdSaved)}</td>
                  <td className="num">{range(planRole(r.role).min, planRole(r.role).max)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{fmtPD(totals.baselinePD)}</td>
                <td></td>
                <td>{fmtGain(totals.overallGain)}</td>
                <td className="num">{fmtPD(totals.adjustedPD)}</td>
                <td className="num">{fmtPD(totals.pdSaved)}</td>
                <td className="num">{range(plan.min, plan.max)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <details className="panel">
        <summary>Resource lines</summary>
        <div className="table-wrap">
          <table className="roles-table">
            <thead>
              <tr>
                <th>Tech domain</th><th>Title</th><th>Role</th><th>Person capability</th>
                <th className="num">Baseline PD</th><th className="num">Gain</th><th className="num">AI PD</th>
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
      {state.prefill.state === "running" && <p className="footnote">The RFP pre-fill is still running; survey answers may change.</p>}
    </section>
  );
}

function range(a: number, b: number): string {
  return Math.round(a) === Math.round(b) ? fmtUSD(a) : `${fmtUSD(a)} – ${fmtUSD(b)}`;
}

function Kpi({ label, before, after, unit, accent, children }: {
  label: string; before?: string; after: string; unit?: string; accent?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-figure">
        {before && <span className="kpi-before"><span className="sr-only">from </span><s>{before}</s><span className="sr-only"> to</span></span>}
        <span className={`kpi-value ${accent ? "accent" : ""}`}>{after}</span>
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      <div className="kpi-sub">{children}</div>
    </div>
  );
}

function EffortBars({ roles }: { roles: CalcResult["roles"] }) {
  const max = Math.max(1, ...roles.map((r) => r.baselinePD));
  const w = (v: number) => `${Math.max(0.5, (v / max) * 82).toFixed(2)}%`;
  return (
    <ul className="effort-bars">
      {roles.map((r) => (
        <li key={r.role}>
          <span className="eb-role">{r.role}</span>
          <span className="eb-bars">
            <span className="eb-row"><span className="eb-bar base" style={{ width: w(r.baselinePD) }} /><span className="eb-val">{int.format(r.baselinePD)}</span></span>
            <span className="eb-row"><span className="eb-bar ai" style={{ width: w(r.adjustedPD) }} /><span className="eb-val strong">{fmtPD(r.adjustedPD)}</span></span>
          </span>
          <span className="eb-gain">{fmtGain(r.appliedGain)}</span>
        </li>
      ))}
    </ul>
  );
}

function Gantt({ result }: { result: CalcResult }) {
  const t = result.aiTimeline!;
  const active = result.lines.filter((l) => l.activeWeeks > 0);
  const start0 = Math.min(...active.map((l) => l.start));
  const N = t.baselineWeeks;
  const pos = (w: number) => `${((w / N) * 100).toFixed(2)}%`;
  const ticks = [...new Set([1, Math.round(N / 4), Math.round(N / 2), Math.round((3 * N) / 4), N])].filter((w) => w >= 1);
  return (
    <div className="table-wrap">
      <div className="gantt" role="table" aria-label="Baseline and AI timeline per resource line">
        <div className="g-row g-axis" role="row">
          <span role="columnheader"><span className="sr-only">Resource line</span></span>
          <span className="g-track" role="columnheader" aria-label="Weeks">
            <span className="g-scale">
              {ticks.map((w) => <span key={w} className="g-tick" style={{ left: pos(w - 0.5) }}>W{w}</span>)}
            </span>
          </span>
        </div>
        {active.map((l) => {
          const a = t.lines.find((x) => x.lineId === l.line.id)!;
          const label = `Baseline W${l.start - start0 + 1}–W${l.end - start0}; AI plan W${a.startWeek + 1}–W${a.endWeek} at ${fmt2(a.fte)} FTE`;
          return (
            <div className="g-row" role="row" key={l.line.id}>
              <span className="g-label" role="rowheader">
                <span className="g-title">{l.line.title}</span>
                <span className="g-sub">{l.line.techDomain}{l.capability === "AI Adaptive" ? " · AI Adaptive" : ""} · {fmtGain(l.appliedGain)}</span>
              </span>
              <span className="g-track" role="cell" aria-label={label}>
                <span className="g-scale">
                  <span className="g-base" style={{ left: pos(l.start - start0), width: pos(l.end - l.start) }} />
                  <span className="g-ai" style={{ left: pos(a.startWeek), width: pos(a.endWeek - a.startWeek) }} />
                  <span className="g-fte" style={{ left: `calc(${pos(a.endWeek)} + 8px)` }}>{fmt2(a.fte)} FTE</span>
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
