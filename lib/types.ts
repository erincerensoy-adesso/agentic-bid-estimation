export type Role = "Delivery Manager" | "RE" | "QA" | "UX-UI" | "Architect" | "Dev" | "DevOps";
export type Capability = "AI Native" | "AI Adaptive";
export type ModelTier = "AI Native" | "AI Assisted" | "Not Recommended" | "Unproven";
export type QuestionId = `Q${number}`;
/** Answer level index: 0..3, scored as level / 3. */
export type Level = 0 | 1 | 2 | 3;
export type AnswerSource = "llm" | "llm-overridden" | "operator";
export type Confidence = "high" | "medium" | "low";

export interface ResourceLine {
  id: string;
  /** Excel row number in the uploaded file, for operator reference. */
  row: number;
  techDomain: string;
  name: string;
  title: string;
  role: Role | null;
  capability: Capability | null;
  /** FTE per baseline week, in column order (W1..Wn). */
  fte: number[];
}

export interface Timeline {
  fileName: string;
  /** Working days per week column (row 2), same length as each line's fte array. */
  workingDays: number[];
  lines: ResourceLine[];
  warnings: string[];
}

export interface LlmSuggestion {
  level: Level;
  confidence: Confidence;
  excerpt: string;
  location: string;
}

export interface SurveyAnswer {
  level: Level | null;
  source: AnswerSource;
  /** Present when the RFP pre-fill suggested an answer. */
  suggestion?: LlmSuggestion;
}

export interface ModelEntry {
  id: string;
  name: string;
  vendor: string;
  origin: string;
  licence: "Closed" | "Open weights" | "UAE sovereign";
  tier: ModelTier;
  /** Flagged borderline in the study. Only changes M for AI Native models. */
  borderline: boolean;
  /** Benchmark that placed the model in its tier, as stated in the study. */
  benchmark: string | null;
  score: string | null;
  effort: string | null;
  notes: string;
}

export interface HarnessEntry {
  id: string;
  name: string;
  factor: number;
}

export interface SurveyQuestion {
  id: QuestionId;
  question: string;
  levels: [string, string, string, string];
  /** One-line explanation shown under the question. */
  help: string;
}

/** `dependent` must be at `level` exactly when `primary` is (e.g. Q1 "None" and Q2 "No integrations"). */
export interface SurveyLink {
  primary: QuestionId;
  dependent: QuestionId;
  level: Level;
}

export interface RoleMappingRule {
  role: Role;
  contains: string[];
  wholeWords: string[];
}

export interface EstimationConfig {
  roles: Role[];
  floor: number;
  maxGain: number;
  minPotential: number;
  pdPerMonth: number;
  aiWeekWorkingDays: number;
  defaultWorkingDaysPerWeek: number;
  slider: { min: number; max: number; step: number };
  modelTierFactors: Record<"AI Native" | "AI Native (borderline)" | "AI Assisted" | "Not Recommended" | "Unproven", number>;
  harnesses: HarnessEntry[];
  personFactors: Record<Capability, number>;
  tokenRates: Record<Role, { min: number; max: number }>;
  roleMapping: RoleMappingRule[];
  survey: SurveyQuestion[];
  /** Plain-language name for each answer level, simplest first. */
  surveyScaleLabels: [string, string, string, string];
  surveyLinks: SurveyLink[];
  weights: Record<string, Record<Role, number>>;
}

export interface CalcInput {
  timeline: Timeline | null;
  allowedModelIds: string[];
  allowedHarnessIds: string[];
  answers: Partial<Record<QuestionId, SurveyAnswer>>;
  /** Manual gain per role (slider). Absent = use computed gain. */
  overrides: Partial<Record<Role, number>>;
}
