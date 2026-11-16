import { config, modelCatalog } from "@/lib/config";
import { buildReport, reportFileName, type ReportInput } from "@/lib/report";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const input = (await req.json()) as ReportInput;
  try {
    const buf = await buildReport(input, config, modelCatalog);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${reportFileName(input.bidName)}"`,
      },
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Export failed." }, { status: 400 });
  }
}
