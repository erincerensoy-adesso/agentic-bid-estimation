/**
 * Consistency rules between survey questions (config `surveyLinks`).
 * Example: Q1 "None" (no integration points) forces Q2 "No integrations",
 * and Q2 "No integrations" is unavailable while Q1 reports integrations.
 */
import type { AnswerSource, EstimationConfig, Level, QuestionId, SurveyAnswer } from "./types";

type Answers = Partial<Record<QuestionId, SurveyAnswer>>;

export interface LevelAvailability {
  /** Levels the operator may pick for this question right now. */
  allowed: Set<Level>;
  /** Why some levels are unavailable or the answer is fixed; empty if unrestricted. */
  reason: string;
  /** True when the answer is fully determined by another question. */
  locked: boolean;
}

const ALL: Level[] = [0, 1, 2, 3];

function sourceFor(level: Level | null, a?: SurveyAnswer): AnswerSource {
  if (!a?.suggestion) return "operator";
  return level === a.suggestion.level ? "llm" : "llm-overridden";
}

/**
 * Questions in the order the survey shows them (by group, then any ungrouped ones).
 * Question ids (Q1–Q12) stay fixed because weights, links and saved answers use them;
 * the operator sees numbers that follow this order instead.
 */
export function surveyOrder(cfg: EstimationConfig): EstimationConfig["survey"] {
  const byId = new Map(cfg.survey.map((q) => [q.id, q]));
  const grouped = cfg.surveyGroups.flatMap((g) => g.questions.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => Boolean(q)));
  const seen = new Set(grouped.map((q) => q.id));
  return [...grouped, ...cfg.survey.filter((q) => !seen.has(q.id))];
}

/** The label the operator sees for a question, e.g. "Q5" for the fifth question shown. */
export function questionLabel(cfg: EstimationConfig, id: string): string {
  const i = surveyOrder(cfg).findIndex((q) => q.id === id);
  return i < 0 ? id : `Q${i + 1}`;
}

function label(cfg: EstimationConfig, q: QuestionId, level: Level): string {
  const sq = cfg.survey.find((x) => x.id === q);
  return sq ? `${questionLabel(cfg, q)} "${sq.levels[level]}"` : q;
}

export function availability(q: QuestionId, answers: Answers, cfg: EstimationConfig): LevelAvailability {
  for (const link of cfg.surveyLinks) {
    if (link.dependent !== q) continue;
    const p = answers[link.primary]?.level;
    if (p == null) continue;
    if (p === link.level) {
      return {
        allowed: new Set([link.level]),
        reason: `Set by ${label(cfg, link.primary, link.level)}. Change ${questionLabel(cfg, link.primary)} to choose another answer.`,
        locked: true,
      };
    }
    return {
      allowed: new Set(ALL.filter((l) => l !== link.level)),
      reason: `${label(cfg, q, link.level)} is unavailable because ${questionLabel(cfg, link.primary)} reports ${cfg.survey.find((x) => x.id === link.primary)?.levels[p]}.`,
      locked: false,
    };
  }
  return { allowed: new Set(ALL), reason: "", locked: false };
}

/** Set one answer and bring linked answers into line. Returns a new answers object. */
export function setAnswer(answers: Answers, q: QuestionId, level: Level | null, cfg: EstimationConfig): Answers {
  const prev = answers[q];
  const next: Answers = {
    ...answers,
    [q]: { level, source: sourceFor(level, prev), suggestion: prev?.suggestion, ...(prev?.notFound ? { notFound: true } : {}) },
  };
  return enforceLinks(next, cfg, q);
}

/**
 * Make linked answers consistent. When both sides were set together (e.g. by the RFP pre-fill),
 * the primary question wins. `changed` names the question the operator just answered.
 */
export function enforceLinks(answers: Answers, cfg: EstimationConfig, changed?: QuestionId): Answers {
  const out: Answers = { ...answers };
  for (const link of cfg.surveyLinks) {
    const p = out[link.primary];
    const d = out[link.dependent];
    if (changed === link.dependent && d?.level === link.level && p?.level == null) {
      // Answering "No integrations" first implies "None" for the primary question.
      out[link.primary] = { level: link.level, source: sourceFor(link.level, p), suggestion: p?.suggestion };
      continue;
    }
    if (p?.level == null) continue;
    if (p.level === link.level && d?.level !== link.level) {
      out[link.dependent] = { level: link.level, source: sourceFor(link.level, d), suggestion: d?.suggestion };
    } else if (p.level !== link.level && d?.level === link.level) {
      // Contradiction: the dependent answer must be chosen again.
      out[link.dependent] = { level: null, source: "operator", suggestion: d.suggestion };
    }
  }
  return out;
}

/** Contradictions remaining in a set of answers (e.g. restored from an older saved bid). */
export function contradictions(answers: Answers, cfg: EstimationConfig): string[] {
  const out: string[] = [];
  for (const link of cfg.surveyLinks) {
    const p = answers[link.primary]?.level;
    const d = answers[link.dependent]?.level;
    if (p == null || d == null) continue;
    if ((p === link.level) !== (d === link.level)) {
      out.push(`${label(cfg, link.primary, p)} contradicts ${label(cfg, link.dependent, d)}.`);
    }
  }
  return out;
}
