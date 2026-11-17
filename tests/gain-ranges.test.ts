import { describe, expect, it } from "vitest";
import { calculate, complexityScore, gainPotential, lineGain } from "../lib/calc";
import { config, modelCatalog } from "../lib/config";
import type { CalcInput, QuestionId, Role, Timeline } from "../lib/types";

describe("per-role gain ranges (config)", () => {
  it("every role has a valid range inside the slider scale", () => {
    for (const role of config.roles) {
      const r = config.gainRanges[role];
      expect(r, role).toBeDefined();
      expect(r.floor).toBeLessThanOrEqual(r.minPotential);
      expect(r.minPotential).toBeLessThanOrEqual(r.maxGain);
      expect(r.floor).toBeGreaterThanOrEqual(config.slider.min);
      expect(r.maxGain).toBeLessThanOrEqual(config.slider.max);
    }
  });

  it("hits each role's maxGain at complexity 0, minPotential at 1, and floor without enablement", () => {
    for (const role of config.roles) {
      const r = config.gainRanges[role];
      expect(gainPotential(0, role, config)).toBeCloseTo(r.maxGain, 12);
      expect(gainPotential(1, role, config)).toBeCloseTo(r.minPotential, 12);
      expect(lineGain(gainPotential(0.5, role, config), 0, role, config)).toBeCloseTo(r.floor, 12);
    }
  });

  it("keeps people-facing roles low and Dev highest for a typical bid", () => {
    // Complexity scores from an operator's bid (NBF Mobile App), full enablement.
    const C: Record<Role, number> = {
      "Delivery Manager": 0.646, RE: 0.667, QA: 0.615, "UX-UI": 0.778, Architect: 0.6, Dev: 0.605, DevOps: 0.583,
    };
    const g = Object.fromEntries(config.roles.map((r) => [r, gainPotential(C[r], r, config)])) as Record<Role, number>;
    expect(g["Delivery Manager"]).toBeGreaterThanOrEqual(1);
    expect(g["Delivery Manager"]).toBeLessThanOrEqual(1.5);
    expect(g.RE).toBeGreaterThan(g["Delivery Manager"]);
    expect(g.RE).toBeLessThan(2.5);
    for (const r of config.roles) if (r !== "Dev") expect(g.Dev).toBeGreaterThan(g[r]);
  });

  it("holds every role at its own floor when no capable model is allowed", () => {
    const timeline: Timeline = {
      fileName: "t.xlsx",
      workingDays: [5, 5],
      warnings: [],
      lines: config.roles.map((role, i) => ({ id: `l${i}`, row: i + 4, techDomain: "", name: "", title: role, role, capability: "AI Native", fte: [1, 1] })),
    };
    const answers: CalcInput["answers"] = {};
    config.survey.forEach((q) => (answers[q.id as QuestionId] = { level: 1, source: "operator" }));
    const res = calculate({ timeline, allowedModelIds: ["gpt-5.2"], allowedHarnessIds: ["aifactory-claude-code"], answers, overrides: {} }, config, modelCatalog);
    expect(res.ready).toBe(true);
    for (const r of res.roles) expect(r.appliedGain).toBeCloseTo(config.gainRanges[r.role].floor, 12);
    expect(complexityScore("Dev", answers, config)).toBeCloseTo(1 / 3, 12);
  });
});
