"use client";

import { useState } from "react";
import type { CalcResult } from "@/lib/calc";
import type { BidState } from "@/lib/state";

export function ExportStep({ state, result }: { state: BidState; result: CalcResult }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bidName: state.bidName,
          clientName: state.clientName,
          timeline: state.timeline,
          allowedModelIds: state.allowedModelIds,
          allowedHarnessIds: state.allowedHarnessIds,
          answers: state.answers,
          overrides: state.overrides,
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
    <section>
      <h1>Export</h1>
      <p className="lead">
        Download the Excel report: Summary, Role Comparison, Resource Lines, AI Timeline, Token Cost, Inputs and Parameters.
      </p>
      {!result.ready ? (
        <div className="notice warn">
          <strong>The report needs complete inputs.</strong>
          <ul>{result.missing.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      ) : (
        <div className="card">
          {!state.bidName && <div className="notice warn">The bid has no name; the file will be named “bid_estimation_…”.</div>}
          <button className="btn primary" onClick={download} disabled={busy}>
            {busy ? "Preparing…" : "Download Excel report"}
          </button>
          {error && <div className="notice error">{error}</div>}
        </div>
      )}
    </section>
  );
}
