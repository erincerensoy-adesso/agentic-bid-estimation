/**
 * Checks the RFP pre-fill connection using the settings in .env.local:
 * sends a two-sentence sample RFP through the same code the app uses.
 *
 * Run: npm run check-llm
 */
import { config } from "../lib/config";
import { llmConfigured, prefillSurvey } from "../lib/prefill";

const base = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com (default)";
const model = process.env.BID_PREFILL_MODEL || "claude-opus-5-5";
console.log(`Address: ${base}\nModel:   ${model}`);

if (!llmConfigured()) {
  console.error("\nNo key found. Set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN in .env.local.");
  process.exit(1);
}

const sample =
  "The bank requires integration with 6 core banking systems through documented REST APIs. " +
  "The solution is subject to banking regulation and must be available 24x7.";

try {
  const t0 = Date.now();
  const result = await prefillSurvey([{ fileName: "sample.txt", text: sample }], config);
  const found = Object.entries(result).filter(([, v]) => v !== "not_found");
  console.log(`\nOK in ${((Date.now() - t0) / 1000).toFixed(1)} s. ${found.length} of 12 questions answered from the sample:`);
  for (const [q, v] of found) if (v !== "not_found") console.log(`  ${q}: level ${v.level} (${v.confidence}) — "${v.excerpt}"`);
} catch (e) {
  const err = e as { status?: number; message?: string };
  console.error(`\nFAILED${err.status ? ` (HTTP ${err.status})` : ""}: ${err.message ?? e}`);
  if (err.status === 401 || err.status === 403) console.error("→ The key was rejected. Try ANTHROPIC_AUTH_TOKEN instead of ANTHROPIC_API_KEY, or the other way round.");
  if (err.status === 404) console.error("→ Wrong address or model. ANTHROPIC_BASE_URL must not end in /v1, and the proxy must offer /v1/messages; check the model name with your AI hub admins.");
  if (err.status === 400) console.error("→ The proxy or model may not support structured outputs. Ask whether it passes Anthropic's output_config.format through.");
  process.exit(1);
}
