/** Excel report (spec 8.2). Numbers are written as numbers; display rounding uses number formats. */
import ExcelJS from "exceljs";
import { calculate } from "./calc";
import { PLANS } from "./pricing";
import type { CalcInput, EstimationConfig, ModelEntry, PricingPlan, QuestionId } from "./types";

export interface ReportInput extends CalcInput {
  bidName: string;
  clientName: string;
  /** Claude plan used for the headline AI cost; defaults to Enterprise. */
  pricingPlan?: PricingPlan;
}

const PD = "#,##0.0";
const GAIN = '0.00"x"';
const USD = '"$"#,##0';
const FTE = "0.00";
const BRAND = "FF006EC7"; // adesso blue

function headerRow(ws: ExcelJS.Worksheet, values: (string | number)[]) {
  const row = ws.addRow(values);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF333333" } }));
  return row;
}

function boldRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((c) => (c.border = { top: { style: "thin" } }));
}

function widths(ws: ExcelJS.Worksheet, w: number[]) {
  w.forEach((width, i) => (ws.getColumn(i + 1).width = width));
}

export function reportFileName(bidName: string, date = new Date()): string {
  const safe = (bidName.trim() || "bid").replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-");
  return `${safe}_estimation_${date.toISOString().slice(0, 10)}.xlsx`;
}

export async function buildReport(
  input: ReportInput,
  cfg: EstimationConfig,
  catalog: ModelEntry[],
  date = new Date(),
): Promise<Buffer> {
  const res = calculate(input, cfg, catalog);
  if (!res.ready) throw new Error(`Results are not available: ${res.missing.join(" ")}`);
  const t = res.aiTimeline!;
  const costs = res.costs!;
  const plan: PricingPlan = input.pricingPlan ?? "enterprise";
  const wb = new ExcelJS.Workbook();
  wb.created = date;

  // Summary
  const sum = wb.addWorksheet("Summary");
  widths(sum, [34, 40]);
  sum.addRow(["Agentic Estimation Platform — bid estimation report"]).font = { bold: true, size: 14 };
  const kv: [string, string | number | Date, string?][] = [
    ["Bid name", input.bidName],
    ["Client", input.clientName],
    ["Date", date.toISOString().slice(0, 10)],
    ["Baseline PD", res.totals.baselinePD, PD],
    ["AI-adjusted PD", res.totals.adjustedPD, PD],
    ["PD saved", res.totals.pdSaved, PD],
    ["Overall gain", res.totals.overallGain, GAIN],
    ["Baseline weeks", t.baselineWeeks],
    ["AI weeks", t.aiWeeks],
    ["Claude plan", costs[plan].label],
    ["AI cost min (USD)", costs[plan].min, USD],
    ["AI cost max (USD)", costs[plan].max, USD],
    ...PLANS.filter((p) => p !== plan).map(
      (p) => [`Alternative: ${costs[p].label} (USD)`, `${Math.round(costs[p].min).toLocaleString("en-US")} – ${Math.round(costs[p].max).toLocaleString("en-US")}`] as [string, string],
    ),
    ["Best allowed model", res.modelInEffect.model?.name ?? "—"],
    ["Model tier", res.modelInEffect.tierLabel ?? "—"],
    ["Model factor M", res.modelInEffect.M, "0.00"],
    ["Harness in effect", res.harnessInEffect?.name ?? "—"],
    ["Harness factor H", res.H, "0.00"],
  ];
  for (const [k, v, fmt] of kv) {
    const row = sum.addRow([k, v]);
    row.getCell(1).font = { bold: true };
    if (fmt) row.getCell(2).numFmt = fmt;
    row.getCell(2).alignment = { horizontal: "left" };
  }
  sum.addRow([]);
  const warnings = [...(res.blockingWarning ? [res.blockingWarning] : []), ...res.warnings];
  const overrides = res.roles.filter((r) => r.overridden).map((r) => r.role);
  if (overrides.length) warnings.push(`Manual gain override applied to: ${overrides.join(", ")}.`);
  sum.addRow(["Warnings"]).font = { bold: true };
  if (warnings.length === 0) sum.addRow(["None"]);
  for (const w of warnings) sum.addRow([w]);

  // Role Comparison
  const rc = wb.addWorksheet("Role Comparison");
  widths(rc, [18, 12, 12, 12, 14, 14, 12, 12, 12, 12, 16, 16]);
  headerRow(rc, [
    "Role", "Baseline PD", "Complexity", "Potential", "Computed gain", "Applied gain", "Overridden",
    "Adjusted PD", "PD saved", "FTE-months", "Token cost min", "Token cost max",
  ]);
  for (const r of res.roles) {
    const row = rc.addRow([
      r.role, r.baselinePD, r.complexity, r.potential, r.computedGain, r.appliedGain, r.overridden ? "Yes" : "No",
      r.adjustedPD, r.pdSaved, r.fteMonths, r.tokenCostMin, r.tokenCostMax,
    ]);
    if (r.overridden) {
      row.getCell(6).font = { bold: true, color: { argb: BRAND } };
      row.getCell(7).font = { bold: true, color: { argb: BRAND } };
    }
  }
  boldRow(
    rc.addRow([
      "Total", res.totals.baselinePD, null, null, null, res.totals.overallGain, null,
      res.totals.adjustedPD, res.totals.pdSaved, res.totals.fteMonths, res.totals.tokenCostMin, res.totals.tokenCostMax,
    ]),
  );
  [PD, "0.000", GAIN, GAIN, GAIN, null, PD, PD, FTE, USD, USD].forEach((f, i) => f && (rc.getColumn(i + 2).numFmt = f));

  // Resource Lines
  const rl = wb.addWorksheet("Resource Lines");
  widths(rl, [16, 18, 22, 18, 14, 12, 12, 12, 12]);
  headerRow(rl, ["Tech Domain", "Name", "Title", "Role", "Capability", "Baseline PD", "Active weeks", "Gain", "Adjusted PD"]);
  for (const l of res.lines) {
    rl.addRow([l.line.techDomain, l.line.name, l.line.title, l.role, l.capability, l.baselinePD, l.activeWeeks, l.appliedGain, l.adjustedPD]);
  }
  boldRow(rl.addRow(["Total", null, null, null, null, res.totals.baselinePD, null, res.totals.overallGain, res.totals.adjustedPD]));
  rl.getColumn(6).numFmt = PD;
  rl.getColumn(8).numFmt = GAIN;
  rl.getColumn(9).numFmt = PD;

  // AI Timeline (template layout)
  const at = wb.addWorksheet("AI Timeline");
  const firstWeekCol = 6;
  const lastWeekCol = firstWeekCol + t.aiWeeks - 1;
  const totalCol = lastWeekCol + 1;
  widths(at, [5, 16, 18, 22, 18, ...Array(t.aiWeeks).fill(7), 10]);
  at.addRow([null, null, null, null, "Working days", ...Array(t.aiWeeks).fill(cfg.aiWeekWorkingDays)]);
  headerRow(at, ["#", "Tech Domain", "Name Surname", "Title", "Role", ...Array.from({ length: t.aiWeeks }, (_, i) => `W${i + 1}`), "Total"]);
  res.lines.forEach((l, i) => {
    const a = t.lines.find((x) => x.lineId === l.line.id);
    const weeks = Array.from({ length: t.aiWeeks }, (_, w) => (a && w >= a.startWeek && w < a.endWeek ? a.fte : null));
    const row = at.addRow([i + 1, l.line.techDomain, l.line.name, l.line.title, l.role, ...weeks, null]);
    const r = row.number;
    const from = `${at.getColumn(firstWeekCol).letter}`;
    const to = `${at.getColumn(lastWeekCol).letter}`;
    row.getCell(totalCol).value = {
      formula: `SUMPRODUCT(${from}${r}:${to}${r},${from}$1:${to}$1)`,
      result: l.adjustedPD,
    };
  });
  const lastLineRow = 2 + res.lines.length;
  const totalRow = at.addRow(["", "Total"]);
  for (let c = firstWeekCol; c <= totalCol; c++) {
    const L = at.getColumn(c).letter;
    const result =
      c === totalCol
        ? res.totals.adjustedPD
        : t.lines.reduce((s, a) => s + (c - firstWeekCol >= a.startWeek && c - firstWeekCol < a.endWeek ? a.fte : 0), 0);
    totalRow.getCell(c).value = { formula: `SUM(${L}3:${L}${lastLineRow})`, result };
  }
  boldRow(totalRow);
  for (let c = firstWeekCol; c <= lastWeekCol; c++) at.getColumn(c).numFmt = FTE;
  at.getColumn(totalCol).numFmt = PD;
  at.getRow(1).numFmt = "0";

  // AI Cost: all three Claude plans
  const tc = wb.addWorksheet("AI Cost");
  widths(tc, [34, 26, 10, 13, 16, 16, 16, 16, 16, 16]);
  tc.addRow(["Comparison"]).font = { bold: true };
  headerRow(tc, ["Plan", "Used for headline", "People", "Seat-months", "Total min (USD)", "Total max (USD)"]);
  for (const p of PLANS) {
    const row = tc.addRow([costs[p].label, p === plan ? "Yes" : "", costs[p].people, costs[p].seatMonths, costs[p].min, costs[p].max]);
    row.getCell(5).numFmt = USD;
    row.getCell(6).numFmt = USD;
    if (p === plan) row.font = { bold: true };
  }
  tc.addRow([
    `Seats: each resource line needs its peak AI FTE rounded up to whole people, paid in whole months (${cfg.pricing.weeksPerMonth} weeks) for the weeks it is active on the AI timeline.`,
  ]);
  for (const p of PLANS) {
    tc.addRow([]);
    tc.addRow([costs[p].label]).font = { bold: true };
    headerRow(tc, ["Role", "Seat / plan", "People", "Seat-months", "Seats min", "Seats max", "Token usage min", "Token usage max", "Total min", "Total max"]);
    for (const r of costs[p].roles) {
      const row = tc.addRow([r.role, r.detail, r.people, r.seatMonths, r.seatMin, r.seatMax, r.usageMin, r.usageMax, r.min, r.max]);
      for (let c = 5; c <= 10; c++) row.getCell(c).numFmt = USD;
    }
    const tot = tc.addRow([
      "Total", null, costs[p].people, costs[p].seatMonths,
      ...(["seatMin", "seatMax", "usageMin", "usageMax"] as const).map((k) => costs[p].roles.reduce((a, r) => a + r[k], 0)),
      costs[p].min, costs[p].max,
    ]);
    for (let c = 5; c <= 10; c++) tot.getCell(c).numFmt = USD;
    boldRow(tot);
    for (const n of costs[p].notes) tc.addRow([n]).font = { italic: true, color: { argb: "FF52514E" } };
  }
  tc.addRow([]);
  tc.addRow(["Token usage (Enterprise)"]).font = { bold: true };
  headerRow(tc, ["Role", "Rate min (USD/FTE-month)", "Rate max (USD/FTE-month)", "FTE-months", "Cost min (USD)", "Cost max (USD)"]);
  for (const r of res.roles) {
    const row = tc.addRow([r.role, r.rateMin, r.rateMax, r.fteMonths, r.tokenCostMin, r.tokenCostMax]);
    [2, 3, 5, 6].forEach((c) => (row.getCell(c).numFmt = USD));
    row.getCell(4).numFmt = FTE;
  }

  // Inputs
  const inp = wb.addWorksheet("Inputs");
  widths(inp, [40, 24, 16, 22, 50, 22, 14, 60]);
  inp.addRow(["Allowed models"]).font = { bold: true };
  headerRow(inp, ["Model", "Vendor (origin)", "Licence", "Tier", "Borderline", "Benchmark", "Score", "Notes"]);
  for (const id of input.allowedModelIds) {
    const m = catalog.find((x) => x.id === id);
    if (m) inp.addRow([m.name, `${m.vendor} (${m.origin})`, m.licence, m.tier, m.borderline ? "Yes" : "No", m.benchmark ?? "", m.score ?? "", m.notes]);
  }
  inp.addRow([]);
  inp.addRow(["Allowed harnesses"]).font = { bold: true };
  headerRow(inp, ["Harness", "Factor H"]);
  for (const id of input.allowedHarnessIds) {
    const h = cfg.harnesses.find((x) => x.id === id);
    if (h) inp.addRow([h.name, h.factor]);
  }
  inp.addRow([]);
  inp.addRow(["Complexity survey"]).font = { bold: true };
  headerRow(inp, ["Question", "Score", "Source", "Answer", "RFP excerpt"]);
  for (const q of cfg.survey) {
    const a = input.answers[q.id as QuestionId];
    const level = a?.level ?? null;
    inp.addRow([
      `${q.id} ${q.question}`,
      level == null ? null : level / 3,
      a?.source ?? "",
      level == null ? "" : q.levels[level],
      a?.suggestion ? `${a.suggestion.excerpt} (${a.suggestion.location}; confidence ${a.suggestion.confidence})` : "",
    ]).getCell(2).numFmt = "0.000";
  }

  // Parameters
  const p = wb.addWorksheet("Parameters");
  widths(p, [28, ...cfg.roles.map(() => 16)]);
  p.addRow(["Scalars"]).font = { bold: true };
  for (const [k, v] of [
    ["PD_PER_MONTH", cfg.pdPerMonth], ["AI week working days", cfg.aiWeekWorkingDays],
  ] as const) p.addRow([k, v]);
  p.addRow([]);
  p.addRow(["Gain ranges per role"]).font = { bold: true };
  headerRow(p, ["Role", "Minimum gain (weak models only)", "Min potential (complexity 1)", "Max gain (complexity 0)"]);
  for (const r of cfg.roles) {
    const g = cfg.gainRanges[r];
    p.addRow([r, g.floor, g.minPotential, g.maxGain]);
  }
  p.addRow([]);
  p.addRow(["Weights matrix"]).font = { bold: true };
  headerRow(p, ["Question", ...cfg.roles]);
  for (const q of cfg.survey) p.addRow([`${q.id} ${q.question}`, ...cfg.roles.map((r) => cfg.weights[q.id][r])]);
  p.addRow([]);
  p.addRow(["Model tier factors (M)"]).font = { bold: true };
  for (const [k, v] of Object.entries(cfg.modelTierFactors)) p.addRow([k, v]);
  p.addRow([]);
  p.addRow(["Harness factors (H)"]).font = { bold: true };
  for (const h of cfg.harnesses) p.addRow([h.name, h.factor]);
  p.addRow([]);
  p.addRow(["Person factors (P)"]).font = { bold: true };
  for (const [k, v] of Object.entries(cfg.personFactors)) p.addRow([k, v]);
  p.addRow([]);
  p.addRow(["Claude plan prices (USD per seat or person per month)"]).font = { bold: true };
  const pr = cfg.pricing;
  p.addRow(["Enterprise seat", pr.enterprise.seatPerMonth]);
  for (const st of Object.values(pr.team.seatTypes)) p.addRow([`Team ${st.name}, annual / monthly billing`, st.annualPerMonth, st.monthlyPerMonth]);
  p.addRow([`Individual ${pr.individual.minPlan.name}`, pr.individual.minPlan.perMonth]);
  p.addRow([`Individual ${pr.individual.maxPlan.name}`, pr.individual.maxPlan.perMonth]);
  p.addRow(["Weeks per month (seat billing)", pr.weeksPerMonth]);
  p.addRow([]);
  p.addRow(["Token rates (USD / FTE-month)"]).font = { bold: true };
  headerRow(p, ["Role", "Min", "Max"]);
  for (const r of cfg.roles) p.addRow([r, cfg.tokenRates[r].min, cfg.tokenRates[r].max]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
