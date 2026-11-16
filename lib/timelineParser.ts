/**
 * Parser for the "Timeline Template" baseline workbook (spec 5.2).
 * Reads the first worksheet. Totals, `#`, `Domain` and `Total per Tech Domain`
 * columns are ignored; the app recomputes everything.
 */
import ExcelJS from "exceljs";
import { proposeRole } from "./roleMapping";
import type { EstimationConfig, ResourceLine, Timeline } from "./types";

export class TimelineParseError extends Error {
  constructor(public errors: string[]) {
    super(errors.join("\n"));
  }
}

const IGNORED_BETWEEN = new Set(["total per tech domain", "domain", "#"]);

type Cell = ExcelJS.CellValue;

/** Resolve formulas to cached results and flag Excel error values. */
function resolve(v: Cell): { value: string | number | null; error?: string } {
  if (v == null) return { value: null };
  if (typeof v === "number") return { value: v };
  if (typeof v === "string") return { value: v };
  if (typeof v === "boolean") return { value: v ? 1 : 0 };
  if (v instanceof Date) return { value: null, error: "date" };
  if (typeof v === "object") {
    if ("error" in v) return { value: null, error: String((v as ExcelJS.CellErrorValue).error) };
    if ("result" in v) return resolve((v as ExcelJS.CellFormulaValue).result as Cell);
    if ("formula" in v || "sharedFormula" in v) return { value: null };
    if ("richText" in v) return { value: (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("") };
    if ("text" in v) return { value: String((v as ExcelJS.CellHyperlinkValue).text) };
  }
  return { value: String(v) };
}

function text(v: Cell): string {
  const r = resolve(v);
  return r.value == null ? "" : String(r.value).trim();
}

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function parseTimeline(
  data: ArrayBuffer | Buffer,
  fileName: string,
  cfg: EstimationConfig,
): Promise<Timeline> {
  const wb = new ExcelJS.Workbook();
  try {
    // exceljs accepts Buffer/ArrayBuffer; its typings lag behind Node's Buffer generics.
    await wb.xlsx.load(data as unknown as ArrayBuffer);
  } catch {
    throw new TimelineParseError(["The file could not be read as an Excel (.xlsx) workbook."]);
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new TimelineParseError(["The workbook has no worksheets."]);

  // Header row is row 3 in the template; search the first rows to tolerate a shifted layout.
  let headerRow = -1;
  const maxCol = ws.columnCount;
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    for (let c = 1; c <= maxCol; c++) {
      if (text(ws.getCell(r, c).value).toLowerCase() === "title") {
        headerRow = r;
        break;
      }
    }
    if (headerRow > 0) break;
  }
  if (headerRow < 0) throw new TimelineParseError(["No `Title` header found in the first worksheet."]);

  const headers: string[] = [];
  for (let c = 1; c <= maxCol; c++) headers[c] = text(ws.getCell(headerRow, c).value);
  const find = (name: string) => headers.findIndex((h, i) => i > 0 && h?.toLowerCase() === name.toLowerCase());

  const titleCol = find("Title");
  const roleCol = find("Role");
  const domainCol = find("Tech Domain");
  const nameCol = find("Name Surname");
  const totalCol = headers.findIndex((h, i) => i > roleCol && h?.toLowerCase() === "total");

  const weekCols: number[] = [];
  if (roleCol > 0) {
    const last = totalCol > 0 ? totalCol - 1 : maxCol;
    for (let c = roleCol + 1; c <= last; c++) {
      const h = (headers[c] ?? "").toLowerCase();
      if (IGNORED_BETWEEN.has(h)) continue;
      if (totalCol < 0 && h === "") break; // no Total column: stop at the first blank header
      weekCols.push(c);
    }
  }
  if (weekCols.length === 0) {
    throw new TimelineParseError([
      roleCol < 0
        ? "No `Role` header found, so the week columns cannot be located."
        : "No week columns found between `Role` and `Total`.",
    ]);
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const daysRow = headerRow - 1;
  const workingDays = weekCols.map((c, i) => {
    const r = daysRow >= 1 ? resolve(ws.getCell(daysRow, c).value) : { value: null };
    const n = typeof r.value === "number" ? r.value : Number(r.value);
    if (r.value == null || r.value === "" || !Number.isFinite(n)) {
      warnings.push(
        `W${i + 1} (column ${colLetter(c)}) has no working-days value in row ${daysRow}; defaulting to ${cfg.defaultWorkingDaysPerWeek}.`,
      );
      return cfg.defaultWorkingDaysPerWeek;
    }
    return n;
  });

  const lines: ResourceLine[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const title = text(ws.getCell(r, titleCol).value);
    if (!title) break; // an empty Title ends the table
    const fte = weekCols.map((c, i) => {
      const cell = resolve(ws.getCell(r, c).value);
      const ref = `${colLetter(c)}${r} (W${i + 1})`;
      if (cell.error) {
        errors.push(`Row ${r}, cell ${ref}: non-numeric FTE (${cell.error}).`);
        return 0;
      }
      if (cell.value == null || cell.value === "") return 0;
      const n = typeof cell.value === "number" ? cell.value : Number(String(cell.value).replace(",", "."));
      if (!Number.isFinite(n)) {
        errors.push(`Row ${r}, cell ${ref}: non-numeric FTE "${cell.value}".`);
        return 0;
      }
      if (n < 0) {
        errors.push(`Row ${r}, cell ${ref}: negative FTE (${n}).`);
        return 0;
      }
      return n;
    });
    lines.push({
      id: `r${r}`,
      row: r,
      techDomain: domainCol > 0 ? text(ws.getCell(r, domainCol).value) : "",
      name: nameCol > 0 ? text(ws.getCell(r, nameCol).value) : "",
      title,
      role: proposeRole(title, cfg.roleMapping),
      capability: null,
      fte,
    });
  }

  if (lines.length === 0) errors.push("No resource lines found below the header row.");
  if (errors.length) throw new TimelineParseError(errors);

  return { fileName, workingDays, lines, warnings };
}
