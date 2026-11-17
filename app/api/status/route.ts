import { llmConfigured } from "@/lib/prefill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    llmConfigured: llmConfigured(),
    model: process.env.BID_PREFILL_MODEL || "claude-opus-5-5",
  });
}
