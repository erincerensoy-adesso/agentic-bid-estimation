"use client";

import type { Dispatch } from "react";
import type { CalcResult } from "@/lib/calc";
import { fmtUSD } from "@/lib/format";
import { PLANS } from "@/lib/pricing";
import type { Action } from "@/lib/state";
import type { PricingPlan } from "@/lib/types";

export const PLAN_SHORT: Record<PricingPlan, string> = {
  enterprise: "Enterprise",
  team: "Team",
  individual: "Individual",
};

const PLAN_NAME: Record<PricingPlan, string> = {
  enterprise: "Claude Enterprise",
  team: "Claude Team",
  individual: "Claude Individual",
};

const PLAN_BASIS: Record<PricingPlan, string> = {
  enterprise: "Seat fee + token usage",
  team: "Standard and Premium seats",
  individual: "Max 5x to Max 20x per person",
};

/** Three selectable plan cards; the chosen plan drives the headline cost and the role table. */
export function PlanCards({ result, plan, dispatch }: { result: CalcResult; plan: PricingPlan; dispatch: Dispatch<Action> }) {
  const costs = result.costs;
  if (!costs) return null;
  const sel = costs[plan];

  return (
    <section className="panel" aria-labelledby="plans-h">
      <div className="panel-title">
        <h2 id="plans-h">AI cost by Claude plan</h2>
        <p>Choose the plan the bid will use. It drives the headline cost and the role table.</p>
      </div>
      <div className="plan-cards" role="radiogroup" aria-label="Claude plan">
        {PLANS.map((p) => {
          const c = costs[p];
          const on = p === plan;
          return (
            <button key={p} role="radio" aria-checked={on} className={`plan-card ${on ? "on" : ""}`} onClick={() => dispatch({ type: "setPricingPlan", plan: p })}>
              <span className="plan-top">
                <span className="plan-name">{PLAN_NAME[p]}</span>
                <span className="plan-dot" aria-hidden="true" />
              </span>
              <span className="plan-basis">{PLAN_BASIS[p]}</span>
              <span className="plan-cost">
                {fmtUSD(c.min)} <span>to {fmtUSD(c.max)}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="footnote">
        Seats: each line needs its peak AI FTE rounded up to whole people, paid in whole months while it is active.
        Team and Individual plans have usage limits that heavy agentic work can reach.
      </p>

      <details className="plan-details">
        <summary>{sel.label}: cost by role</summary>
        <div className="table-wrap">
          <table className="roles-table">
            <thead>
              <tr>
                <th>Role</th><th>Seat / plan</th><th className="num">People</th><th className="num">Seat-months</th>
                <th className="num">Seats / subscriptions</th>{plan === "enterprise" && <th className="num">Token usage</th>}
                <th className="num">Min</th><th className="num">Max</th>
              </tr>
            </thead>
            <tbody>
              {sel.roles.map((r) => (
                <tr key={r.role}>
                  <td>{r.role}</td><td className="muted-num">{r.detail}</td>
                  <td className="num">{r.people}</td><td className="num">{r.seatMonths}</td>
                  <td className="num">{range(r.seatMin, r.seatMax)}</td>
                  {plan === "enterprise" && <td className="num">{range(r.usageMin, r.usageMax)}</td>}
                  <td className="num">{fmtUSD(r.min)}</td><td className="num">{fmtUSD(r.max)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td><td></td><td className="num">{sel.people}</td><td className="num">{sel.seatMonths}</td>
                <td></td>{plan === "enterprise" && <td></td>}
                <td className="num">{fmtUSD(sel.min)}</td><td className="num">{fmtUSD(sel.max)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <ul className="notes-list">{sel.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      </details>
    </section>
  );
}

function range(a: number, b: number): string {
  return Math.round(a) === Math.round(b) ? fmtUSD(a) : `${fmtUSD(a)} – ${fmtUSD(b)}`;
}
