/** Excel report file name: <bid-name>_estimation_<YYYY-MM-DD>.xlsx (spec 8.2). Kept free of exceljs so pages can import it. */
export function reportFileName(bidName: string, date = new Date()): string {
  const safe = (bidName.trim() || "bid").replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-");
  return `${safe}_estimation_${date.toISOString().slice(0, 10)}.xlsx`;
}
