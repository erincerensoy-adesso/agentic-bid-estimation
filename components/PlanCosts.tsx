"use client";

import type { Dispatch } from "react";
import type { CalcResult } from "@/lib/calc";
import { fmtUSD } from "@/lib/format";
import { PLANS } from "@/lib/pricing";
import type { Action } from "@/lib/state";
import type { PricingPlan } from "@/lib/types";

export const PLAN_SHORT: Record<PricingPlan, string> = {
  enterprise: "Enterprise (tokens)",
  team: "Team (seats)",
  individual: "Individual (Max 5x–20x)",
};

/** Compares the AI cost under each Claude plan; the chosen plan drives the headline and role table. */
export function PlanCosts({ result, plan, dispatch }: { result: CalcResult; plan: PricingPlan; dispatch: Dispatch<Action> }) {
  const costs = result.costs;
  if (!costs) return null;
  const sel = costs[plan];

  return (
    <div className="card">
      <h2>AI cost by Claude plan</h2>
      <p className="muted small">
        Seats: each resource line needs its peak AI FTE rounded up to whole people, paid in whole months for the weeks it is
        active on the AI timeline. Choose the plan the bid will use; it drives the headline cost and the role table.
      </p>
      <div className="segmented" role="radiogroup" aria-label="Claude plan">
        {PLANS.map((p) => (
          <button key={p} role="radio" aria-checked={p === plan} className={p === plan ? "on" : ""} onClick={() => dispatch({ type: "setPricingPlan", plan: p })}>
            {PLAN_SHORT[p]}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Plan</th><th className="num">People</th><th className="num">Seat-months</th>
              <th className="num">Seats / subscriptions</th><th className="num">Token usage</th>
              <th className="num">Total min</th><th className="num">Total max</th>
            </tr>
          </thead>
          <tbody>
            {PLANS.map((p) => {
              const c = costs[p];
              const seatMin = c.roles.reduce((a, r) => a + r.seatMin, 0);
              const seatMax = c.roles.reduce((a, r) => a + r.seatMax, 0);
              const useMin = c.roles.reduce((a, r) => a + r.usageMin, 0);
              const useMax = c.roles.reduce((a, r) => a + r.usageMax, 0);
              return (
                <tr key={p} className={`clickable ${p === plan ? "selected" : ""}`} onClick={() => dispatch({ type: "setPricingPlan", plan: p })}>
                  <td>{c.label}</td>
                  <td className="num">{c.people}</td>
                  <td className="num">{c.seatMonths}</td>
                  <td className="num">{range(seatMin, seatMax)}</td>
                  <td className="num">{useMax > 0 ? range(useMin, useMax) : "—"}</td>
                  <td className="num"><strong>{fmtUSD(c.min)}</strong></td>
                  <td className="num"><strong>{fmtUSD(c.max)}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3>{sel.label}: by role</h3>
      <div className="table-wrap">
        <table>
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
                <td>{r.role}</td><td className="muted">{r.detail}</td>
                <td className="num">{r.people}</td><td className="num">{r.seatMonths}</td>
                <td className="num">{range(r.seatMin, r.seatMax)}</td>
                {plan === "enterprise" && <td className="num">{range(r.usageMin, r.usageMax)}</td>}
                <td className="num">{fmtUSD(r.min)}</td><td className="num">{fmtUSD(r.max)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="notes-list">{sel.notes.map((n) => <li key={n}>{n}</li>)}</ul>
    </div>
  );
}

function range(a: number, b: number): string {
  return Math.round(a) === Math.round(b) ? fmtUSD(a) : `${fmtUSD(a)} – ${fmtUSD(b)}`;
}
