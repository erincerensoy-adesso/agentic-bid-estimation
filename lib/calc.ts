/**
 * Pure, side-effect-free estimation engine (spec section 6).
 * No rounding is applied to intermediate values; rounding is a display concern.
 */
import { computePlanCosts, type PlanCost } from "./pricing";
import { contradictions } from "./survey";
import type {
  CalcInput,
  Capability,
  EstimationConfig,
  HarnessEntry,
  ModelEntry,
  QuestionId,
  ResourceLine,
  Role,
  Timeline,
} from "./types";

export interface ModelInEffect {
  model: ModelEntry | null;
  tierLabel: keyof EstimationConfig["modelTierFactors"] | null;
  M: number;
}

export interface LineResult {
  line: ResourceLine;
  role: Role;
  capability: Capability;
  baselinePD: number;
  activeWeeks: number;
  /** Average FTE over active weeks. */
  avgBaselineFte: number;
  /** First active week (0-based) and the week after the last active week. */
  start: number;
  end: number;
  E: number;
  computedGain: number;
  appliedGain: number;
  adjustedPD: number;
}

export interface RoleResult {
  role: Role;
  baselinePD: number;
  complexity: number;
  potential: number;
  computedGain: number;
  appliedGain: number;
  overridden: boolean;
  adjustedPD: number;
  pdSaved: number;
  fteMonths: number;
  tokenCostMin: number;
  tokenCostMax: number;
  rateMin: number;
  rateMax: number;
  /**
   * Share of full AI token usage (0..1). 1 at or above the computed gain; lowering the gain with the
   * override scales usage down linearly to 0 at 1.0x (AI doing none of the work). Seats are unaffected.
   */
  aiUsage: number;
}

export interface AiTimelineLine {
  lineId: string;
  startWeek: number; // 0-based, inclusive
  endWeek: number; // 0-based, exclusive
  weeks: number;
  fte: number;
  adjustedPD: number;
}

export interface AiTimeline {
  baselineWeeks: number;
  slowestGain: number;
  slowestLineId: string | null;
  aiWeeks: number;
  lines: AiTimelineLine[];
}

export interface Totals {
  baselinePD: number;
  adjustedPD: number;
  pdSaved: number;
  overallGain: number;
  tokenCostMin: number;
  tokenCostMax: number;
  fteMonths: number;
}

export interface CalcResult {
  ready: boolean;
  missing: string[];
  warnings: string[];
  blockingWarning: string | null;
  modelInEffect: ModelInEffect;
  harnessInEffect: HarnessEntry | null;
  H: number;
  lines: LineResult[];
  roles: RoleResult[];
  totals: Totals;
  aiTimeline: AiTimeline | null;
  /** AI cost under each Claude plan; null until results are available. */
  costs: Record<import("./types").PricingPlan, PlanCost> | null;
}

export const NO_MODEL_WARNING =
  "No allowed model reaches the AI Assisted tier. Gains are held at the minimum gain for each role.";

const EPS = 1e-9;

export function baselinePD(fte: number[], workingDays: number[]): number {
  let sum = 0;
  for (let i = 0; i < fte.length; i++) sum += (fte[i] || 0) * (workingDays[i] ?? 0);
  return sum;
}

export function activeRange(fte: number[]): { start: number; end: number; activeWeeks: number } {
  let start = -1;
  let end = -1;
  let activeWeeks = 0;
  fte.forEach((v, i) => {
    if (v !== 0) {
      activeWeeks++;
      if (start < 0) start = i;
      end = i + 1;
    }
  });
  return { start, end, activeWeeks };
}

/** C(role) = Σ w·score / Σ w, range 0..1. Unanswered questions count as 0 (results are gated on completeness anyway). */
export function complexityScore(role: Role, answers: CalcInput["answers"], cfg: EstimationConfig): number {
  let num = 0;
  let den = 0;
  for (const q of cfg.survey) {
    const w = cfg.weights[q.id]?.[role] ?? 0;
    const level = answers[q.id as QuestionId]?.level;
    num += w * (level == null ? 0 : level / 3);
    den += w;
  }
  return den === 0 ? 0 : num / den;
}

/** Geometric interpolation from the role's maxGain (complexity 0) to its minPotential (complexity 1). */
export function gainPotential(c: number, role: Role, cfg: EstimationConfig): number {
  const r = cfg.gainRanges[role];
  return r.maxGain * Math.pow(r.minPotential / r.maxGain, c);
}

export function modelInEffect(allowedIds: string[], catalog: ModelEntry[], cfg: EstimationConfig): ModelInEffect {
  let best: ModelInEffect = { model: null, tierLabel: null, M: 0 };
  let bestScore = -1;
  for (const id of allowedIds) {
    const m = catalog.find((x) => x.id === id);
    if (!m) continue;
    const tierLabel: ModelInEffect["tierLabel"] =
      m.tier === "AI Native" && m.borderline ? "AI Native (borderline)" : m.tier;
    const M = cfg.modelTierFactors[tierLabel!] ?? 0;
    if (M > bestScore) {
      bestScore = M;
      best = { model: m, tierLabel, M };
    }
  }
  return best;
}

export function harnessInEffect(allowedIds: string[], cfg: EstimationConfig): HarnessEntry | null {
  let best: HarnessEntry | null = null;
  for (const id of allowedIds) {
    const h = cfg.harnesses.find((x) => x.id === id);
    if (h && (!best || h.factor > best.factor)) best = h;
  }
  return best;
}

/**
 * How much of full AI token usage a role still has (0..1). A gain lowered below the computed gain by an
 * override means AI does less of the work: usage falls linearly from 1 at the computed gain to 0 at 1.0x.
 * At or above the computed gain, usage is full.
 */
export function aiUsage(appliedGain: number, computedGain: number): number {
  if (appliedGain >= computedGain || computedGain <= 1) return 1;
  return Math.min(1, Math.max(0, (appliedGain - 1) / (computedGain - 1)));
}

export function lineGain(potential: number, E: number, role: Role, cfg: EstimationConfig): number {
  const floor = cfg.gainRanges[role].floor;
  return floor + (potential - floor) * E;
}

/** Checks the preconditions in spec section 4. */
export function missingInputs(input: CalcInput, cfg: EstimationConfig): string[] {
  const missing: string[] = [];
  const t = input.timeline;
  if (!t || t.lines.length === 0) missing.push("Upload and parse the baseline timeline.");
  else {
    const noRole = t.lines.filter((l) => !l.role).length;
    const noCap = t.lines.filter((l) => !l.capability).length;
    if (noRole) missing.push(`${noRole} resource line(s) have no role.`);
    if (noCap) missing.push(`${noCap} resource line(s) have no person capability.`);
  }
  if (input.allowedModelIds.length === 0) missing.push("Select at least one allowed model.");
  if (input.allowedHarnessIds.length === 0) missing.push("Select at least one allowed harness.");
  const unanswered = cfg.survey.filter((q) => input.answers[q.id as QuestionId]?.level == null).length;
  if (unanswered) missing.push(`${unanswered} survey question(s) are unanswered.`);
  missing.push(...contradictions(input.answers, cfg));
  return missing;
}

function emptyTotals(): Totals {
  return { baselinePD: 0, adjustedPD: 0, pdSaved: 0, overallGain: 0, tokenCostMin: 0, tokenCostMax: 0, fteMonths: 0 };
}

export function calculate(input: CalcInput, cfg: EstimationConfig, catalog: ModelEntry[]): CalcResult {
  const missing = missingInputs(input, cfg);
  const mie = modelInEffect(input.allowedModelIds, catalog, cfg);
  const hie = harnessInEffect(input.allowedHarnessIds, cfg);
  const H = hie?.factor ?? 0;
  const warnings: string[] = [...(input.timeline?.warnings ?? [])];
  const blockingWarning = input.allowedModelIds.length > 0 && mie.M === 0 ? NO_MODEL_WARNING : null;

  const base: CalcResult = {
    ready: missing.length === 0,
    missing,
    warnings,
    blockingWarning,
    modelInEffect: mie,
    harnessInEffect: hie,
    H,
    lines: [],
    roles: [],
    totals: emptyTotals(),
    aiTimeline: null,
    costs: null,
  };
  if (!base.ready) return base;

  const timeline = input.timeline as Timeline;

  const complexity = {} as Record<Role, number>;
  const potential = {} as Record<Role, number>;
  for (const role of cfg.roles) {
    complexity[role] = complexityScore(role, input.answers, cfg);
    potential[role] = gainPotential(complexity[role], role, cfg);
  }

  const lines: LineResult[] = timeline.lines.map((line) => {
    const role = line.role as Role;
    const capability = line.capability as Capability;
    const pd = baselinePD(line.fte, timeline.workingDays);
    const { start, end, activeWeeks } = activeRange(line.fte);
    const fteSum = line.fte.reduce((a, b) => a + (b || 0), 0);
    const E = mie.M * H * cfg.personFactors[capability];
    const computedGain = lineGain(potential[role], E, role, cfg);
    const override = input.overrides[role];
    const appliedGain = override ?? computedGain;
    return {
      line,
      role,
      capability,
      baselinePD: pd,
      activeWeeks,
      avgBaselineFte: activeWeeks ? fteSum / activeWeeks : 0,
      start,
      end,
      E,
      computedGain,
      appliedGain,
      adjustedPD: pd / appliedGain,
    };
  });

  const roles: RoleResult[] = [];
  for (const role of cfg.roles) {
    const rl = lines.filter((l) => l.role === role);
    if (rl.length === 0) continue;
    const bpd = rl.reduce((a, l) => a + l.baselinePD, 0);
    const computedAdj = rl.reduce((a, l) => a + l.baselinePD / l.computedGain, 0);
    const adj = rl.reduce((a, l) => a + l.adjustedPD, 0);
    const computedGain = computedAdj > EPS ? bpd / computedAdj : lineGain(potential[role], 0, role, cfg);
    const override = input.overrides[role];
    const appliedGain = override ?? computedGain;
    const fteMonths = adj / cfg.pdPerMonth;
    const rate = cfg.tokenRates[role];
    const usage = aiUsage(appliedGain, computedGain);
    roles.push({
      role,
      baselinePD: bpd,
      complexity: complexity[role],
      potential: potential[role],
      computedGain,
      appliedGain,
      overridden: override != null,
      adjustedPD: adj,
      pdSaved: bpd - adj,
      fteMonths,
      tokenCostMin: rate.min * fteMonths * usage,
      tokenCostMax: rate.max * fteMonths * usage,
      rateMin: rate.min,
      rateMax: rate.max,
      aiUsage: usage,
    });
  }

  const totals = emptyTotals();
  for (const r of roles) {
    totals.baselinePD += r.baselinePD;
    totals.adjustedPD += r.adjustedPD;
    totals.tokenCostMin += r.tokenCostMin;
    totals.tokenCostMax += r.tokenCostMax;
    totals.fteMonths += r.fteMonths;
  }
  totals.pdSaved = totals.baselinePD - totals.adjustedPD;
  totals.overallGain = totals.adjustedPD > EPS ? totals.baselinePD / totals.adjustedPD : 0;

  const aiTimeline = computeAiTimeline(lines, cfg);
  const costs = aiTimeline ? computePlanCosts(lines, roles, aiTimeline, cfg) : null;
  return { ...base, lines, roles, totals, aiTimeline, costs };
}

/** Spec 6.7: compress the plan until the slowest line works at its baseline staffing. */
export function computeAiTimeline(lines: LineResult[], cfg: EstimationConfig): AiTimeline | null {
  const active = lines.filter((l) => l.activeWeeks > 0);
  if (active.length === 0) return null;
  const projectStart = Math.min(...active.map((l) => l.start));
  const projectEnd = Math.max(...active.map((l) => l.end));
  const N = projectEnd - projectStart;
  let slowest = active[0];
  for (const l of active) if (l.appliedGain < slowest.appliedGain) slowest = l;
  const gMin = slowest.appliedGain;
  // Guard against floating-point noise pushing an exact ratio over an integer (e.g. 28 / 3.5).
  const N_ai = Math.max(1, Math.ceil(N / gMin - EPS));

  const out: AiTimelineLine[] = active.map((l) => {
    const s = l.start - projectStart;
    const e = l.end - projectStart;
    const s_ai = Math.floor((s * N_ai) / N + EPS);
    const e_ai = Math.max(s_ai + 1, Math.ceil((e * N_ai) / N - EPS));
    const weeks = e_ai - s_ai;
    return {
      lineId: l.line.id,
      startWeek: s_ai,
      endWeek: e_ai,
      weeks,
      fte: l.adjustedPD / (weeks * cfg.aiWeekWorkingDays),
      adjustedPD: l.adjustedPD,
    };
  });

  return { baselineWeeks: N, slowestGain: gMin, slowestLineId: slowest.line.id, aiWeeks: N_ai, lines: out };
}
