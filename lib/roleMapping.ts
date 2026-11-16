import type { EstimationConfig, Role } from "./types";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Propose a canonical role from a timeline Title (spec 5.2). Rules are tested in
 * config order, case-insensitively; `contains` keywords match anywhere,
 * `wholeWords` keywords match only as whole words (so "ba" does not match "database").
 */
export function proposeRole(title: string, rules: EstimationConfig["roleMapping"]): Role | null {
  const t = title.toLowerCase();
  for (const rule of rules) {
    if (rule.contains.some((k) => t.includes(k.toLowerCase()))) return rule.role;
    if (rule.wholeWords.some((k) => new RegExp(`\\b${escapeRegex(k.toLowerCase())}\\b`).test(t))) return rule.role;
  }
  return null;
}
