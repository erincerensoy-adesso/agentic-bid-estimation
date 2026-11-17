import { config } from "./config";
import { enforceLinks, setAnswer } from "./survey";
import type { PricingPlan } from "./types";
import type { AnswerSource, Capability, Level, LlmSuggestion, QuestionId, Role, SurveyAnswer, Timeline } from "./types";

export interface PrefillStatus {
  state: "idle" | "running" | "done" | "error";
  message?: string;
}

export interface BidState {
  bidName: string;
  clientName: string;
  rfpFileNames: string[];
  prefill: PrefillStatus;
  timeline: Timeline | null;
  allowedModelIds: string[];
  allowedHarnessIds: string[];
  answers: Partial<Record<QuestionId, SurveyAnswer>>;
  overrides: Partial<Record<Role, number>>;
  /** Claude plan shown in the headline cost and the role table. */
  pricingPlan: PricingPlan;
}

export const initialState: BidState = {
  bidName: "",
  clientName: "",
  rfpFileNames: [],
  prefill: { state: "idle" },
  timeline: null,
  allowedModelIds: [],
  allowedHarnessIds: [],
  answers: {},
  overrides: {},
  pricingPlan: "enterprise",
};

export type Action =
  | { type: "reset" }
  | { type: "load"; state: BidState }
  | { type: "setMeta"; bidName?: string; clientName?: string }
  | { type: "setRfpFiles"; names: string[] }
  | { type: "setPrefill"; status: PrefillStatus }
  | { type: "applySuggestions"; suggestions: Record<string, LlmSuggestion | "not_found"> }
  | { type: "setTimeline"; timeline: Timeline | null }
  | { type: "setLineRole"; lineId: string; role: Role | null }
  | { type: "setLineCapability"; lineId: string; capability: Capability | null }
  | { type: "setAllCapabilities"; capability: Capability }
  | { type: "toggleModel"; id: string; on: boolean }
  | { type: "setModels"; ids: string[] }
  | { type: "toggleHarness"; id: string; on: boolean }
  | { type: "setAnswer"; q: QuestionId; level: Level | null }
  | { type: "setOverride"; role: Role; gain: number | null }
  | { type: "setPricingPlan"; plan: PricingPlan };

function sourceFor(level: Level | null, suggestion?: LlmSuggestion): AnswerSource {
  if (!suggestion) return "operator";
  return level === suggestion.level ? "llm" : "llm-overridden";
}

function toggle(list: string[], id: string, on: boolean): string[] {
  const without = list.filter((x) => x !== id);
  return on ? [...without, id] : without;
}

export function reducer(s: BidState, a: Action): BidState {
  switch (a.type) {
    case "reset":
      return initialState;
    case "load": {
      const loaded = { ...initialState, ...a.state, prefill: { state: "idle" as const } };
      return { ...loaded, answers: enforceLinks(loaded.answers, config) };
    }
    case "setMeta":
      return { ...s, bidName: a.bidName ?? s.bidName, clientName: a.clientName ?? s.clientName };
    case "setRfpFiles":
      return { ...s, rfpFileNames: a.names };
    case "setPrefill":
      return { ...s, prefill: a.status };
    case "applySuggestions": {
      const answers = { ...s.answers };
      for (const [q, sug] of Object.entries(a.suggestions)) {
        const id = q as QuestionId;
        const prev = answers[id];
        const operatorTouched = prev && prev.level != null && prev.source !== "llm";
        if (sug === "not_found") {
          // The question stays empty for the operator unless they already answered it.
          answers[id] = operatorTouched
            ? { level: prev!.level, source: "operator", notFound: true }
            : { level: null, source: "operator", notFound: true };
        } else if (operatorTouched) {
          answers[id] = { level: prev!.level, source: sourceFor(prev!.level, sug), suggestion: sug };
        } else {
          answers[id] = { level: sug.level, source: "llm", suggestion: sug };
        }
      }
      return { ...s, answers: enforceLinks(answers, config) };
    }
    case "setTimeline":
      return { ...s, timeline: a.timeline, overrides: {} };
    case "setLineRole":
    case "setLineCapability":
      if (!s.timeline) return s;
      return {
        ...s,
        timeline: {
          ...s.timeline,
          lines: s.timeline.lines.map((l) =>
            l.id !== a.lineId ? l : a.type === "setLineRole" ? { ...l, role: a.role } : { ...l, capability: a.capability },
          ),
        },
      };
    case "setAllCapabilities":
      if (!s.timeline) return s;
      return { ...s, timeline: { ...s.timeline, lines: s.timeline.lines.map((l) => ({ ...l, capability: a.capability })) } };
    case "toggleModel":
      return { ...s, allowedModelIds: toggle(s.allowedModelIds, a.id, a.on) };
    case "setModels":
      return { ...s, allowedModelIds: a.ids };
    case "toggleHarness":
      return { ...s, allowedHarnessIds: toggle(s.allowedHarnessIds, a.id, a.on) };
    case "setAnswer":
      return { ...s, answers: setAnswer(s.answers, a.q, a.level, config) };
    case "setPricingPlan":
      return { ...s, pricingPlan: a.plan };
    case "setOverride": {
      const overrides = { ...s.overrides };
      if (a.gain == null) delete overrides[a.role];
      else overrides[a.role] = a.gain;
      return { ...s, overrides };
    }
  }
}

export const STORAGE_KEY = "bid-estimation:v1";
