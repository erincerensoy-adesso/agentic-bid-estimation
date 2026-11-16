/**
 * Builds tests/fixtures/timeline-template.xlsx: a reconstruction of the
 * "Timeline Template" layout used for the spec's reference check (section 5.2)
 * and worked example (section 11). It reproduces the template's quirks on
 * purpose: repeating week labels, a Total formula that stops four weeks early
 * (SUM(I:AF) while weeks run to AJ), and #REF! errors in the `#` column.
 *
 * Run: npm run fixture
 */
import ExcelJS from "exceljs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "tests", "fixtures", "timeline-template.xlsx");

const WEEKS = 28;
const FIRST_WEEK_COL = 9; // column I
const weekLabels = [
  40, 41, 42, 43, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 49, 50, 51, 52, 49, 50, 51, 52, 1, 2, 3,
].map((n) => `CW${n}`);

/** [techDomain, name, title, role column text, fte(weekIndex)] */
const lines: [string, string, string, string, (w: number) => number][] = [
  ["Management", "Person A", "Delivery Manager", "Delivery Manager", () => 1],
  ["BA/QA", "Person B", "BA", "Business Analyst", (w) => (w < 20 ? 2 : 1)],
  ["BA/QA", "Person C", "Quality Assurance", "QA", (w) => (w < 4 ? 0 : w < 20 ? 2 : 1)],
  ["UX/UI", "Person D", "UX Designer", "UX", () => 1],
  ["UX/UI", "Person E", "UI Designer", "UI", (w) => (w < 4 ? 0 : 1)],
  ["BE", "Person F", "Arch", "Architect", () => 1],
  ["BE", "Person G", "Sr AI Native Dev", "Developer", (w) => (w < 4 ? 0 : 1)],
  ["FE", "Person H", "Sr AI Native Dev", "Developer", (w) => (w < 4 ? 0 : 1)],
  ["Mobile", "Person I", "Arch", "Architect", () => 1],
  ["Mobile", "Person J", "Sr AI Native Dev", "Developer", (w) => (w < 4 ? 0 : 1.5)],
  ["DevOps", "Person K", "DevOps", "DevOps", () => 0.5],
];

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("Timeline");

const months = ["Oct", "Oct", "Oct", "Oct", "Nov", "Nov", "Nov", "Nov", "Dec", "Dec", "Dec", "Dec", "Jan", "Jan"];
for (let w = 0; w < WEEKS; w++) {
  ws.getCell(1, FIRST_WEEK_COL + w).value = months[Math.floor(w / 2)] ?? "Feb";
  ws.getCell(2, FIRST_WEEK_COL + w).value = 5;
  ws.getCell(3, FIRST_WEEK_COL + w).value = weekLabels[w];
}
const header = ["#", "Domain", "Total per Tech Domain", "", "Tech Domain", "Name Surname", "Title", "Role"];
header.forEach((h, i) => (ws.getCell(3, i + 1).value = h || null));
const totalCol = FIRST_WEEK_COL + WEEKS; // AK
ws.getCell(3, totalCol).value = "Total";

lines.forEach(([domain, name, title, role, fte], i) => {
  const r = 4 + i;
  ws.getCell(r, 1).value = { error: "#REF!" } as ExcelJS.CellErrorValue;
  ws.getCell(r, 2).value = domain;
  ws.getCell(r, 5).value = domain;
  ws.getCell(r, 6).value = name;
  ws.getCell(r, 7).value = title;
  ws.getCell(r, 8).value = role;
  let buggyTotal = 0;
  for (let w = 0; w < WEEKS; w++) {
    const v = fte(w);
    if (v) ws.getCell(r, FIRST_WEEK_COL + w).value = v;
    if (w < 24) buggyTotal += v * 5;
  }
  // The template's bug: sums I..AF only (24 of 28 weeks).
  ws.getCell(r, totalCol).value = { formula: `SUM(I${r}:AF${r})*5`, result: buggyTotal };
});

await wb.xlsx.writeFile(out);
console.log(`Wrote ${out}`);
