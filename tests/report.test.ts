import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { config, modelCatalog } from "../lib/config";
import { buildReport, reportFileName } from "../lib/report";
import { parseTimeline } from "../lib/timelineParser";
import type { QuestionId } from "../lib/types";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("Excel report", () => {
  it("writes all sheets with numeric values and correct AI timeline totals", async () => {
    const timeline = await parseTimeline(await readFile(path.join(here, "fixtures", "timeline-template.xlsx")), "t.xlsx", config);
    timeline.lines = timeline.lines.map((l) => ({ ...l, capability: "AI Native" }));
    const levels = [2, 2, 2, 2, 1, 0, 1, 1, 1, 0, 1, 2] as const;
    const answers = Object.fromEntries(levels.map((level, i) => [`Q${i + 1}` as QuestionId, { level, source: "operator" as const }]));
    const buf = await buildReport(
      { bidName: "Acme Portal", clientName: "Acme", timeline, allowedModelIds: ["claude-opus-5"], allowedHarnessIds: ["aifactory-claude-code"], answers, overrides: { QA: 3 }, pricingPlan: "team" },
      config,
      modelCatalog,
      new Date("2026-11-16T10:00:00Z"),
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Summary", "Role Comparison", "Resource Lines", "AI Timeline", "AI Cost", "Inputs", "Parameters",
    ]);
    const rc = wb.getWorksheet("Role Comparison")!;
    const qa = rc.getRows(2, 7)!.find((r) => r.getCell(1).value === "QA")!;
    expect(qa.getCell(6).value).toBe(3);
    expect(qa.getCell(7).value).toBe("Yes");
    expect(typeof qa.getCell(5).value).toBe("number"); // computed gain kept alongside
    const at = wb.getWorksheet("AI Timeline")!;
    const last = at.getRow(at.rowCount);
    const totalCell = last.getCell(last.cellCount).value as ExcelJS.CellFormulaValue;
    expect(typeof totalCell.result).toBe("number");
    const summary = wb.getWorksheet("Summary")!;
    const planRow = summary.getRows(1, summary.rowCount)!.find((r) => r.getCell(1).value === "Claude plan")!;
    expect(planRow.getCell(2).value).toBe(config.pricing.team.label);
    const ai = wb.getWorksheet("AI Cost")!;
    expect(ai.getRows(1, ai.rowCount)!.some((r) => r.getCell(1).value === config.pricing.individual.label)).toBe(true);
    expect(reportFileName("Acme Portal", new Date("2026-11-16T10:00:00Z"))).toBe("Acme-Portal_estimation_2026-11-16.xlsx");
  });
});
