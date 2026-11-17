/**
 * AI cost under three Claude plans (pure, no I/O):
 * - enterprise: seat fee plus token usage at the per-role token rates
 * - team: seat based, Standard or Premium seat per role; min = annual billing, max = monthly billing
 * - individual: one Max (min) or Ultra / Max 20x (max) subscription per person
 *
 * Seats: each resource line needs ceil(peak AI FTE) people, paid in whole months for the
 * weeks the line is active on the AI timeline.
 */
import type { AiTimeline, LineResult, RoleResult } from "./calc";
import type { EstimationConfig, PricingPlan, Role } from "./types";

export interface PlanRoleCost {
  role: Role;
  people: number;
  seatMonths: number;
  /** Seat or subscription part of the cost (min and max). */
  seatMin: number;
  seatMax: number;
  /** Token usage part (Enterprise only). */
  usageMin: number;
  usageMax: number;
  min: number;
  max: number;
  /** e.g. "Premium seat" for Team. */
  detail: string;
}

export interface PlanCost {
  plan: PricingPlan;
  label: string;
  roles: PlanRoleCost[];
  people: number;
  seatMonths: number;
  min: number;
  max: number;
  notes: string[];
}

export const PLANS: PricingPlan[] = ["enterprise", "team", "individual"];

const EPS = 1e-9;

interface LineSeats {
  role: Role;
  people: number;
  months: number;
}

export function lineSeats(lines: LineResult[], timeline: AiTimeline, cfg: EstimationConfig): LineSeats[] {
  return lines.flatMap((l) => {
    const a = timeline.lines.find((x) => x.lineId === l.line.id);
    if (!a || a.fte <= 0) return [];
    return [{ role: l.role, people: Math.max(1, Math.ceil(a.fte - EPS)), months: Math.ceil(a.weeks / cfg.pricing.weeksPerMonth - EPS) }];
  });
}

export function computePlanCosts(
  lines: LineResult[],
  roles: RoleResult[],
  timeline: AiTimeline,
  cfg: EstimationConfig,
): Record<PricingPlan, PlanCost> {
  const seats = lineSeats(lines, timeline, cfg);
  const p = cfg.pricing;

  const perRole = (plan: PricingPlan): PlanRoleCost[] =>
    roles.map((r) => {
      const rs = seats.filter((s) => s.role === r.role);
      const people = rs.reduce((a, s) => a + s.people, 0);
      const seatMonths = rs.reduce((a, s) => a + s.people * s.months, 0);
      let seatMin = 0, seatMax = 0, usageMin = 0, usageMax = 0, detail = "";
      if (plan === "enterprise") {
        seatMin = seatMax = seatMonths * p.enterprise.seatPerMonth;
        usageMin = r.tokenCostMin;
        usageMax = r.tokenCostMax;
        detail = "Seat + token usage";
      } else if (plan === "team") {
        const type = p.team.seatTypes[p.team.seatTypeByRole[r.role]];
        seatMin = seatMonths * type.annualPerMonth;
        seatMax = seatMonths * type.monthlyPerMonth;
        detail = type.name;
      } else {
        seatMin = seatMonths * p.individual.minPlan.perMonth;
        seatMax = seatMonths * p.individual.maxPlan.perMonth;
        detail = `${p.individual.minPlan.name} – ${p.individual.maxPlan.name}`;
      }
      return { role: r.role, people, seatMonths, seatMin, seatMax, usageMin, usageMax, min: seatMin + usageMin, max: seatMax + usageMax, detail };
    });

  const build = (plan: PricingPlan, label: string, notes: string[]): PlanCost => {
    const rs = perRole(plan);
    return {
      plan,
      label,
      roles: rs,
      people: rs.reduce((a, r) => a + r.people, 0),
      seatMonths: rs.reduce((a, r) => a + r.seatMonths, 0),
      min: rs.reduce((a, r) => a + r.min, 0),
      max: rs.reduce((a, r) => a + r.max, 0),
      notes,
    };
  };

  const people = seats.reduce((a, s) => a + s.people, 0);
  const teamNotes = [p.team.note];
  if (people < p.team.minSeats) teamNotes.push(`Team needs at least ${p.team.minSeats} seats; this plan uses ${people}.`);
  if (people > p.team.maxSeats) teamNotes.push(`Team allows at most ${p.team.maxSeats} seats; this plan needs ${people}.`);
  const entNotes = [p.enterprise.note];
  if (people < p.enterprise.minSeats) {
    entNotes.push(`The project uses ${people} seats, below Enterprise's ${p.enterprise.minSeats}-seat minimum; only the project's seats are costed.`);
  }

  return {
    enterprise: build("enterprise", p.enterprise.label, entNotes),
    team: build("team", p.team.label, teamNotes),
    individual: build("individual", p.individual.label, [p.individual.note]),
  };
}
