import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/lib/config";
import { CONTEXT_MAX } from "@/lib/state";
import { llmConfigured, PrefillError, prefillSurvey } from "@/lib/prefill";
import { extractRfpText, RFP_MAX_TOTAL_BYTES, RfpError, type RfpDocument } from "@/lib/rfp";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Extracts RFP text in memory and asks the LLM for survey suggestions, using the bid context too. Nothing is stored. */
export async function POST(req: Request) {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const raw = form.get("context");
  const context = typeof raw === "string" ? raw.trim() : "";
  if (files.length === 0 && !context) return Response.json({ error: "Upload an RFP or write some context first." }, { status: 400 });
  if (context.length > CONTEXT_MAX) {
    return Response.json({ error: `The context is longer than ${CONTEXT_MAX.toLocaleString("en-US")} characters.` }, { status: 413 });
  }
  const total = files.reduce((a, f) => a + f.size, 0);
  if (total > RFP_MAX_TOTAL_BYTES) {
    return Response.json({ error: "The RFP files exceed the 50 MB total limit." }, { status: 413 });
  }

  const docs: RfpDocument[] = [];
  try {
    for (const f of files) docs.push(await extractRfpText(f.name, new Uint8Array(await f.arrayBuffer())));
  } catch (e) {
    const msg = e instanceof RfpError ? e.message : "Text could not be extracted from the RFP.";
    if (!(e instanceof RfpError)) console.error(e);
    return Response.json({ error: msg }, { status: 422 });
  }

  if (!llmConfigured()) {
    return Response.json({ error: "Pre-fill is not configured (no LLM key is set). Answer the survey manually." }, { status: 503 });
  }

  try {
    const suggestions = await prefillSurvey(docs, config, context);
    return Response.json({ suggestions });
  } catch (e) {
    let msg = "The RFP pre-fill failed. Answer the survey manually.";
    if (e instanceof PrefillError) msg = `${e.message} Answer the survey manually.`;
    else if (e instanceof Anthropic.APIConnectionTimeoutError) msg = "The RFP pre-fill timed out. Answer the survey manually or re-run it.";
    else if (e instanceof Anthropic.AuthenticationError) msg = "The LLM API key was rejected. Answer the survey manually.";
    else if (e instanceof Anthropic.RateLimitError) msg = "The LLM is rate-limited. Try re-running the pre-fill shortly.";
    else if (e instanceof Anthropic.APIError) msg = `The LLM returned an error (${e.status}). Answer the survey manually.`;
    console.error(e);
    return Response.json({ error: msg }, { status: 502 });
  }
}
