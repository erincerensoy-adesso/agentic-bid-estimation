import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { calculate, NO_MODEL_WARNING } from "../lib/calc";
import { config, modelCatalog } from "../lib/config";
import { proposeRole } from "../lib/roleMapping";
import { parseTimeline, TimelineParseError } from "../lib/timelineParser";
import type { CalcInput, Level, QuestionId, Role, Timeline } from "../lib/types";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "fixtures", "timeline-template.xlsx");

let template: Timeline;

beforeAll(async () => {
  template = await parseTimeline(await readFile(fixture), "timeline-template.xlsx", config);
});

function answersAll(levels: Level[]): CalcInput["answers"] {
  const a: CalcInput["answers"] = {};
  levels.forEach((level, i) => (a[`Q${i + 1}` as QuestionId] = { level, source: "operator" }));
  return a;
}

/** Spec section 11 inputs. */
function workedExample(): CalcInput {
  const timeline: Timeline = {
    ...template,
    lines: template.lines.map((l) => ({
      ...l,
      capability: l.techDomain === "Mobile" && l.title === "Sr AI Native Dev" ? "AI Adaptive" : "AI Native",
    })),
  };
  return {
    timeline,
    allowedModelIds: ["claude-opus-5"],
    allowedHarnessIds: ["aifactory-claude-code"],
    // Q1 2/3, Q2 2/3, Q3 2/3, Q4 2/3, Q5 1/3, Q6 0, Q7 1/3, Q8 1/3, Q9 1/3, Q10 0, Q11 1/3, Q12 2/3
    answers: answersAll([2, 2, 2, 2, 1, 0, 1, 1, 1, 0, 1, 2]),
    overrides: {},
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

describe("timeline parser (spec 5.2 reference check)", () => {
  it("parses 11 lines, 28 weeks and 1,610 PD despite the template's bugs", () => {
    expect(template.lines).toHaveLength(11);
    expect(template.workingDays).toHaveLength(28);
    expect(template.warnings).toEqual([]);
    const pd = template.lines.reduce(
      (a, l) => a + l.fte.reduce((s, f, i) => s + f * template.workingDays[i], 0),
      0,
    );
    expect(pd).toBe(1610);
  });

  it("proposes the expected role for every line", () => {
    const byRole: Partial<Record<Role, number>> = {};
    for (const l of template.lines) {
      const pd = l.fte.reduce((s, f, i) => s + f * template.workingDays[i], 0);
      byRole[l.role!] = (byRole[l.role!] ?? 0) + pd;
    }
    expect(byRole).toEqual({
      "Delivery Manager": 140,
      RE: 240,
      QA: 200,
      "UX-UI": 260,
      Architect: 280,
      Dev: 420,
      DevOps: 70,
    });
  });

  it("rejects a non-xlsx file", async () => {
    await expect(parseTimeline(Buffer.from("not excel"), "x.xlsx", config)).rejects.toBeInstanceOf(TimelineParseError);
  });
});

describe("role mapping", () => {
  it.each([
    ["Senior DevOps Engineer", "DevOps"],
    ["Solution Architect", "Architect"],
    ["Backend Engineer", "Dev"],
    ["Test Automation", "QA"],
    ["BA", "RE"],
    ["Senior BA", "RE"],
    ["Database Specialist", null],
    ["Business Analyst", "RE"],
    ["UI Designer", "UX-UI"],
    ["Project Manager", "Delivery Manager"],
    ["Scrum Master", null],
  ])("%s -> %s", (title, role) => {
    expect(proposeRole(title, config.roleMapping)).toBe(role);
  });
});

describe("worked example (spec 11)", () => {
  const expected: Record<Role, [number, number, number, number, number, number, number, number]> = {
    // baselinePD, C, potential, roleGain, adjustedPD, fteMonths, tokenMin, tokenMax
    "Delivery Manager": [140, 0.479, 4.62, 4.62, 30.3, 1.51, 454, 908],
    RE: [240, 0.456, 4.8, 4.8, 50.0, 2.5, 3751, 6251],
    QA: [200, 0.487, 4.57, 4.57, 43.8, 2.19, 2190, 4381],
    "UX-UI": [260, 0.333, 5.85, 5.85, 44.5, 2.22, 1111, 2223],
    Architect: [280, 0.427, 5.03, 5.03, 55.6, 2.78, 5564, 8346],
    Dev: [420, 0.395, 5.29, 4.52, 93.0, 4.65, 4649, 9298],
    DevOps: [70, 0.433, 4.98, 4.98, 14.1, 0.7, 703, 1406],
  };

  it("produces the expected role table", () => {
    const res = calculate(workedExample(), config, modelCatalog);
    expect(res.ready).toBe(true);
    expect(res.modelInEffect.M).toBe(1);
    expect(res.H).toBe(1);
    for (const r of res.roles) {
      const [bpd, c, pot, gain, adj, fm, tmin, tmax] = expected[r.role];
      expect(r.baselinePD).toBe(bpd);
      expect(r3(r.complexity)).toBe(c);
      expect(r2(r.potential)).toBe(pot);
      expect(r2(r.appliedGain)).toBe(gain);
      expect(r1(r.adjustedPD)).toBe(adj);
      expect(r2(r.fteMonths)).toBe(fm);
      expect(Math.round(r.tokenCostMin)).toBe(tmin);
      expect(Math.round(r.tokenCostMax)).toBe(tmax);
    }
  });

  it("produces the expected totals", () => {
    const { totals } = calculate(workedExample(), config, modelCatalog);
    expect(totals.baselinePD).toBe(1610);
    expect(r1(totals.adjustedPD)).toBe(331.2);
    expect(r2(totals.overallGain)).toBe(4.86);
    expect(Math.round(totals.tokenCostMin)).toBe(18423);
    expect(Math.round(totals.tokenCostMax)).toBe(32813);
  });

  it("explains the Dev gain via the AI Adaptive mobile line", () => {
    const res = calculate(workedExample(), config, modelCatalog);
    const dev = res.lines.filter((l) => l.role === "Dev").map((l) => r2(l.appliedGain));
    expect(dev).toEqual([5.29, 5.29, 3.78]);
  });

  it("produces the expected AI timeline", () => {
    const res = calculate(workedExample(), config, modelCatalog);
    const t = res.aiTimeline!;
    expect(t.baselineWeeks).toBe(28);
    expect(t.aiWeeks).toBe(8);
    const rows = res.lines.map((l) => {
      const a = t.lines.find((x) => x.lineId === l.line.id)!;
      return [l.line.techDomain, l.line.title, r2(l.avgBaselineFte), `W${a.startWeek + 1}–W${a.endWeek}`, r1(a.adjustedPD), r2(a.fte)];
    });
    expect(rows).toEqual([
      ["Management", "Delivery Manager", 1, "W1–W8", 30.3, 0.76],
      ["BA/QA", "BA", 1.71, "W1–W8", 50.0, 1.25],
      ["BA/QA", "Quality Assurance", 1.67, "W2–W8", 43.8, 1.25],
      ["UX/UI", "UX Designer", 1, "W1–W8", 23.9, 0.6],
      ["UX/UI", "UI Designer", 1, "W2–W8", 20.5, 0.59],
      ["BE", "Arch", 1, "W1–W8", 27.8, 0.7],
      ["BE", "Sr AI Native Dev", 1, "W2–W8", 22.7, 0.65],
      ["FE", "Sr AI Native Dev", 1, "W2–W8", 22.7, 0.65],
      ["Mobile", "Arch", 1, "W1–W8", 27.8, 0.7],
      ["Mobile", "Sr AI Native Dev", 1.5, "W2–W8", 47.7, 1.36],
      ["DevOps", "DevOps", 0.5, "W1–W8", 14.1, 0.35],
    ]);
    // AI timeline PD equals adjusted PD, and AI FTE never exceeds average baseline FTE.
    const aiPd = t.lines.reduce((a, l) => a + l.fte * l.weeks * 5, 0);
    expect(aiPd).toBeCloseTo(res.totals.adjustedPD, 9);
    for (const l of res.lines) {
      const a = t.lines.find((x) => x.lineId === l.line.id)!;
      expect(a.fte).toBeLessThanOrEqual(l.avgBaselineFte + 1e-9);
    }
  });
});

describe("boundary checks (spec 11)", () => {
  const allNative = (): CalcInput => ({
    ...workedExample(),
    timeline: { ...template, lines: template.lines.map((l) => ({ ...l, capability: "AI Native" as const })) },
  });

  it("all level 0, M = H = P = 1 gives 10.00 everywhere", () => {
    const res = calculate({ ...allNative(), answers: answersAll(Array(12).fill(0)) }, config, modelCatalog);
    for (const r of res.roles) expect(r2(r.appliedGain)).toBe(10);
  });

  it("all level 1, M = H = P = 1 gives 2.00 everywhere", () => {
    const res = calculate({ ...allNative(), answers: answersAll(Array(12).fill(3)) }, config, modelCatalog);
    for (const r of res.roles) expect(r2(r.appliedGain)).toBe(2);
  });

  it("M = 0 gives 1.50 everywhere with the blocking warning", () => {
    const res = calculate({ ...allNative(), allowedModelIds: ["gpt-5.2", "jais-2"] }, config, modelCatalog);
    expect(res.modelInEffect.M).toBe(0);
    expect(res.blockingWarning).toBe(NO_MODEL_WARNING);
    for (const r of res.roles) expect(r2(r.appliedGain)).toBe(1.5);
  });
});

describe("inputs in effect and overrides", () => {
  it("uses the best model tier and the best harness", () => {
    const base = workedExample();
    let res = calculate({ ...base, allowedModelIds: ["gpt-5", "claude-opus-4.5"] }, config, modelCatalog);
    expect(res.modelInEffect.M).toBe(0.85);
    expect(res.modelInEffect.model?.id).toBe("claude-opus-4.5");
    res = calculate({ ...base, allowedModelIds: ["gpt-5"], allowedHarnessIds: ["chat-only", "copilot"] }, config, modelCatalog);
    expect(res.modelInEffect.M).toBe(0.5);
    expect(res.H).toBe(0.75);
  });

  it("an override replaces every line's gain for that role and drives the AI timeline", () => {
    const res = calculate({ ...workedExample(), overrides: { Dev: 2.5 } }, config, modelCatalog);
    const dev = res.roles.find((r) => r.role === "Dev")!;
    expect(dev.overridden).toBe(true);
    expect(dev.appliedGain).toBeCloseTo(2.5, 12);
    expect(r2(dev.computedGain)).toBe(4.52);
    expect(dev.adjustedPD).toBeCloseTo(420 / 2.5, 9);
    expect(res.aiTimeline!.slowestGain).toBe(2.5);
    expect(res.aiTimeline!.aiWeeks).toBe(Math.ceil(28 / 2.5));
  });

  it("is not ready until every precondition is met", () => {
    const base = workedExample();
    const res = calculate(
      {
        ...base,
        allowedHarnessIds: [],
        answers: { ...base.answers, Q3: undefined },
        timeline: { ...base.timeline!, lines: base.timeline!.lines.map((l, i) => (i === 0 ? { ...l, capability: null } : l)) },
      },
      config,
      modelCatalog,
    );
    expect(res.ready).toBe(false);
    expect(res.missing).toHaveLength(3);
    expect(res.roles).toEqual([]);
  });

  it("recalculates well under 200 ms", () => {
    const input = workedExample();
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) calculate(input, config, modelCatalog);
    expect((performance.now() - t0) / 100).toBeLessThan(200);
  });
});

describe("model catalog (adFactory Model Comparison study)", () => {
  it("has the study's tiers and borderline flags", () => {
    const count = (tier: string) => modelCatalog.filter((m) => m.tier === tier).length;
    expect([count("AI Native"), count("AI Assisted"), count("Not Recommended"), count("Unproven")]).toEqual([25, 12, 10, 7]);
    const borderlineNative = modelCatalog.filter((m) => m.tier === "AI Native" && m.borderline).map((m) => m.id);
    expect(borderlineNative.sort()).toEqual(["claude-opus-4.5", "glm-5.2"]);
    // The study puts gemini-3.1-pro at the AI Native bar on one benchmark but says to treat it as AI Assisted.
    expect(modelCatalog.find((m) => m.id === "gemini-3.1-pro")?.tier).toBe("AI Assisted");
    expect(calculate({ ...workedExample(), allowedModelIds: ["gemini-3.1-pro"] }, config, modelCatalog).modelInEffect.M).toBe(0.5);
    // Every non-Unproven model carries the benchmark score that placed it.
    for (const m of modelCatalog) if (m.tier !== "Unproven") expect(m.score).toBeTruthy();
  });
});
