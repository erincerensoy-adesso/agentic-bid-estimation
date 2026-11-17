/**
 * Checks the RFP pre-fill connection using the settings in .env.local:
 * sends a two-sentence sample RFP through the same code the app uses.
 *
 * Run: npm run check-llm
 */
import { existsSync, readFileSync } from "node:fs";
import { config } from "../lib/config";
import { llmSettings, prefillSurvey } from "../lib/prefill";

/** Show only the start of a key, e.g. "sk-aihub-…(51 characters)". */
const mask = (k: string) => `${k.slice(0, 9)}…(${k.length} characters)`;

const settings = llmSettings();
const model = process.env.BID_PREFILL_MODEL || "claude-opus-5-5";
console.log(`Address: ${settings.baseURL ?? "https://api.anthropic.com (default)"}`);
console.log(`Model:   ${model}`);
console.log(`Key:     ${settings.key ? `${mask(settings.key)} from ${settings.keySource}` : "none"}`);

// Values exported in the terminal take priority over .env.local; flag any that differ.
if (existsSync(".env.local")) {
  const file = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .map((l) => /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(l))
      .filter((m): m is RegExpExecArray => Boolean(m))
      .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
  );
  for (const [name, value] of Object.entries(file)) {
    const actual = process.env[name]?.trim();
    if (value && actual && actual !== value) {
      console.warn(`\nWarning: ${name} is also set in your terminal, and that value is used instead of the one in .env.local.`);
      console.warn(`         Open a new terminal or run:  unset ${name}`);
    }
  }
}

if (!settings.key) {
  console.error("\nNo key found. Set BID_LLM_API_KEY in .env.local.");
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
  if (err.status === 401 || err.status === 403)
    console.error("→ The key was rejected. Check that the Key line above starts with the hub key's prefix (e.g. sk-aihub-) and that there is no warning about the terminal.");
  if (err.status === 404) console.error("→ Wrong address or model. The address must not end in /v1, and the proxy must offer /v1/messages; check the model name.");
  if (err.status === 400) console.error("→ The proxy or model may not support structured outputs. Ask whether it passes Anthropic's output_config.format through.");
  process.exit(1);
}
