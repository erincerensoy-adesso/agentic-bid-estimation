import { config } from "@/lib/config";
import { parseTimeline, TimelineParseError } from "@/lib/timelineParser";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ errors: ["No file uploaded."] }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return Response.json({ errors: ["The timeline must be an .xlsx file in the Timeline Template format."] }, { status: 400 });
  }
  try {
    const timeline = await parseTimeline(Buffer.from(await file.arrayBuffer()), file.name, config);
    return Response.json({ timeline });
  } catch (e) {
    if (e instanceof TimelineParseError) return Response.json({ errors: e.errors }, { status: 422 });
    console.error(e);
    return Response.json({ errors: ["The timeline could not be parsed."] }, { status: 500 });
  }
}
