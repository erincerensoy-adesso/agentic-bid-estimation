import { describe, expect, it } from "vitest";
import { CONTEXT_MAX, initialState, reducer } from "../lib/state";

describe("bid context", () => {
  it("is stored and capped at the maximum length", () => {
    const s = reducer(initialState, { type: "setContext", context: "x".repeat(CONTEXT_MAX + 50) });
    expect(s.context).toHaveLength(CONTEXT_MAX);
  });

  it("survives a reload of saved state, which defaults it for older saves", () => {
    const { context: _drop, ...old } = { ...initialState, context: "" };
    const s = reducer(initialState, { type: "load", state: old as typeof initialState });
    expect(s.context).toBe("");
  });
});
