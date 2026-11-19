"use client";

import { useState } from "react";
import type { CalcResult } from "@/lib/calc";
import type { BidState } from "@/lib/state";

/** Downloads the Excel report (Summary, Role Comparison, Resource Lines, AI Timeline, Token Cost, Inputs, Parameters). */
export function ExportButton({ state, result }: { state: BidState; result: CalcResult }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!result.ready) return null;

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bidName: state.bidName,
          context: state.context,
          clientName: state.clientName,
          timeline: state.timeline,
          allowedModelIds: state.allowedModelIds,
          allowedHarnessIds: state.allowedHarnessIds,
          answers: state.answers,
          overrides: state.overrides,
          pricingPlan: state.pricingPlan,
        }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Export failed.");
        return;
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "estimation.xlsx";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("The server could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="export">
      <button className="btn primary icon" onClick={download} disabled={busy} title="Excel report with all results, inputs and parameters">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" />
        </svg>
        {busy ? "Preparing…" : "Download Excel report"}
      </button>
      {error && <span className="notice error inline">{error}</span>}
    </span>
  );
}
