"use client";

import type { Dispatch, RefObject } from "react";
import type { Action, BidState } from "@/lib/state";
import { PrefillNotice } from "../PrefillNotice";
import { runPrefill } from "../runPrefill";

const MAX = 50 * 1024 * 1024;

export function BidStep({ state, dispatch, rfpFiles }: { state: BidState; dispatch: Dispatch<Action>; rfpFiles: RefObject<File[]> }) {
  function onFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    const bad = files.filter((f) => !/\.(pdf|docx)$/i.test(f.name));
    if (bad.length) {
      dispatch({ type: "setPrefill", status: { state: "error", message: `Only PDF and DOCX files are accepted: ${bad.map((f) => f.name).join(", ")}` } });
      return;
    }
    if (files.reduce((a, f) => a + f.size, 0) > MAX) {
      dispatch({ type: "setPrefill", status: { state: "error", message: "The RFP files exceed the 50 MB total limit." } });
      return;
    }
    rfpFiles.current = files;
    dispatch({ type: "setRfpFiles", names: files.map((f) => f.name) });
    void runPrefill(files, dispatch);
  }

  return (
    <section>
      <h1>Initials</h1>
      <p className="lead">Name the bid and upload the RFP. The RFP is read once to suggest answers for the Domain Complexity questions; it is not stored.</p>
      <div className="form-grid">
        <label>
          Bid name
          <input value={state.bidName} onChange={(e) => dispatch({ type: "setMeta", bidName: e.target.value })} placeholder="e.g. Customer Portal Renewal" />
        </label>
        <label>
          Client name
          <input value={state.clientName} onChange={(e) => dispatch({ type: "setMeta", clientName: e.target.value })} placeholder="e.g. Acme Insurance" />
        </label>
      </div>
      <div className="card">
        <h2>RFP</h2>
        <p className="muted">PDF or DOCX, one or more files, 50 MB in total.</p>
        <input type="file" accept=".pdf,.docx" multiple onChange={(e) => onFiles(e.target.files)} />
        {state.rfpFileNames.length > 0 && (
          <p className="muted small">
            Uploaded: {state.rfpFileNames.join(", ")}
            {rfpFiles.current?.length === 0 && " (upload again to re-run the pre-fill after a page reload)"}
          </p>
        )}
        <PrefillNotice status={state.prefill} />
      </div>
    </section>
  );
}
