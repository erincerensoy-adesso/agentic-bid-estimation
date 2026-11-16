export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    llmConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    model: process.env.BID_PREFILL_MODEL || "claude-opus-5-5",
  });
}
