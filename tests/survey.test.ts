import { describe, expect, it } from "vitest";
import { calculate } from "../lib/calc";
import { config, modelCatalog } from "../lib/config";
import { initialState, reducer } from "../lib/state";
import { availability, contradictions, enforceLinks, setAnswer } from "../lib/survey";
import type { CalcInput, LlmSuggestion } from "../lib/types";

const ans = (level: 0 | 1 | 2 | 3) => ({ level, source: "operator" as const });

describe("survey link: Q1 integration points -> Q2 integration complexity", () => {
  it("Q1 'None' sets Q2 to 'No integrations' and locks it", () => {
    const a = setAnswer({ Q2: ans(2) }, "Q1", 0, config);
    expect(a.Q2?.level).toBe(0);
    const av = availability("Q2", a, config);
    expect(av.locked).toBe(true);
    expect([...av.allowed]).toEqual([0]);
  });

  it("Q1 above 'None' makes 'No integrations' unavailable and clears it", () => {
    const a = setAnswer({ Q1: ans(0), Q2: ans(0) }, "Q1", 2, config);
    expect(a.Q2?.level).toBeNull();
    expect([...availability("Q2", a, config).allowed]).toEqual([1, 2, 3]);
  });

  it("keeps a valid Q2 answer when Q1 moves between non-zero levels", () => {
    const a = setAnswer({ Q1: ans(1), Q2: ans(3) }, "Q1", 3, config);
    expect(a.Q2?.level).toBe(3);
  });

  it("answering Q2 'No integrations' first fills Q1 'None'", () => {
    const a = setAnswer({}, "Q2", 0, config);
    expect(a.Q1?.level).toBe(0);
  });

  it("Q1 is unrestricted", () => {
    expect([...availability("Q1", { Q2: ans(2) }, config).allowed]).toEqual([0, 1, 2, 3]);
  });

  it("resolves contradictory RFP suggestions in favour of Q1", () => {
    const sug = (level: 0 | 1 | 2 | 3): LlmSuggestion => ({ level, confidence: "medium", excerpt: "x", location: "p1" });
    const s = reducer(initialState, { type: "applySuggestions", suggestions: { Q1: sug(2), Q2: sug(0) } });
    expect(s.answers.Q1?.level).toBe(2);
    expect(s.answers.Q2?.level).toBeNull();
  });

  it("repairs a contradictory saved bid on load", () => {
    const s = reducer(initialState, { type: "load", state: { ...initialState, answers: { Q1: ans(0), Q2: ans(3) } } });
    expect(s.answers.Q2?.level).toBe(0);
    expect(contradictions(enforceLinks({ Q1: ans(2), Q2: ans(0) }, config), config)).toEqual([]);
  });

  it("blocks results while answers contradict each other", () => {
    const answers: CalcInput["answers"] = {};
    config.survey.forEach((q) => (answers[q.id] = ans(1)));
    answers.Q1 = ans(2);
    answers.Q2 = ans(0);
    const res = calculate(
      { timeline: null, allowedModelIds: ["claude-opus-5"], allowedHarnessIds: ["aifactory-claude-code"], answers, overrides: {} },
      config,
      modelCatalog,
    );
    expect(res.missing.some((m) => m.includes("contradicts"))).toBe(true);
  });
});

describe("survey groups and not-found questions", () => {
  it("puts every question in exactly one group", () => {
    const ids = config.surveyGroups.flatMap((g) => g.questions);
    expect([...ids].sort()).toEqual(config.survey.map((q) => q.id).sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marks questions the RFP does not address, and keeps the mark after a manual answer", () => {
    let s = reducer(initialState, { type: "applySuggestions", suggestions: { Q10: "not_found" } });
    expect(s.answers.Q10).toEqual({ level: null, source: "operator", notFound: true });
    s = reducer(s, { type: "setAnswer", q: "Q10", level: 1 });
    expect(s.answers.Q10).toMatchObject({ level: 1, source: "operator", notFound: true });
  });
});
