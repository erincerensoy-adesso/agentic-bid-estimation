"use client";

import { useId, useState, type Dispatch, type RefObject } from "react";
import { config } from "@/lib/config";
import { reportFileName } from "@/lib/fileName";
import type { Action, BidState } from "@/lib/state";
import { runPrefill } from "../runPrefill";

const MAX = 50 * 1024 * 1024;

const NEXT = [
  { num: 2, title: "Staffing & Skills", text: "Upload the manual, no-AI staffing plan and set each line’s person capability." },
  { num: 3, title: "Models & Harness", text: "Tick the models and tooling the client allows." },
  { num: 4, title: "Domain Complexity", text: "Review the 12 complexity answers suggested from the RFP." },
  { num: 5, title: "Results", text: "See the AI-adjusted effort, timeline and cost, and download the Excel report." },
];

function size(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function BidStep({ state, dispatch, rfpFiles, onGoTo }: {
  state: BidState;
  dispatch: Dispatch<Action>;
  rfpFiles: RefObject<File[]>;
  onGoTo: (step: number) => void;
}) {
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputId = useId();
  const inMemory = rfpFiles.current ?? [];
  const canRetry = inMemory.length > 0 && state.prefill.state !== "running";

  function acceptFiles(files: File[]) {
    if (files.length === 0) return;
    const bad = files.filter((f) => !/\.(pdf|docx)$/i.test(f.name));
    if (bad.length) {
      setFileError(`Only PDF and DOCX files are accepted: ${bad.map((f) => f.name).join(", ")}`);
      return;
    }
    if (files.reduce((a, f) => a + f.size, 0) > MAX) {
      setFileError("The RFP files exceed the 50 MB total limit.");
      return;
    }
    setFileError(null);
    rfpFiles.current = files;
    dispatch({ type: "setRfpFiles", names: files.map((f) => f.name) });
    void runPrefill(files, dispatch);
  }

  function remove(name: string) {
    const remaining = inMemory.filter((f) => f.name !== name);
    rfpFiles.current = remaining;
    dispatch({ type: "setRfpFiles", names: state.rfpFileNames.filter((n) => n !== name) });
    if (remaining.length > 0) void runPrefill(remaining, dispatch);
    else dispatch({ type: "setPrefill", status: { state: "idle" } });
  }

  const suggested = config.survey.filter((q) => state.answers[q.id]?.suggestion).length;
  const open = config.survey.filter((q) => state.answers[q.id]?.level == null).length;

  return (
    <section>
      <div className="page-title survey-title">
        <h1>Initials</h1>
        <p>Name the bid and upload the RFP. The RFP is read once to suggest answers for the Domain Complexity questions.</p>
      </div>

      <div className="initials">
        <section className="panel bid-card" aria-labelledby="bid-h">
          <div className="panel-title">
            <h2 id="bid-h">Bid details</h2>
            <p>Shown in the header and used to name the Excel report.</p>
          </div>
          <label className="field">
            <span>Bid name</span>
            <input value={state.bidName} onChange={(e) => dispatch({ type: "setMeta", bidName: e.target.value })} placeholder="e.g. Customer Portal Renewal" />
          </label>
          <label className="field">
            <span>Client</span>
            <input value={state.clientName} onChange={(e) => dispatch({ type: "setMeta", clientName: e.target.value })} placeholder="e.g. Acme Insurance" />
          </label>
          <div className="file-preview">
            <span>Report file name</span>
            <strong>{reportFileName(state.bidName)}</strong>
          </div>
        </section>

        <section className="panel rfp-card" aria-labelledby="rfp-h">
          <div className="panel-title">
            <h2 id="rfp-h">RFP</h2>
            <p>PDF or DOCX, one or more files, 50 MB in total. Read once, never stored.</p>
          </div>

          <input
            id={inputId}
            className="sr-only"
            type="file"
            accept=".pdf,.docx"
            multiple
            onChange={(e) => { acceptFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
          />
          <label
            htmlFor={inputId}
            className={`dropzone ${dragging ? "over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); acceptFiles(Array.from(e.dataTransfer.files)); }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
            </svg>
            <strong>Drop RFP files here or <u>browse</u></strong>
            <span>Adding files replaces the current set and runs the pre-fill again</span>
          </label>
          {fileError && <div className="notice error">{fileError}</div>}

          {state.rfpFileNames.length > 0 && (
            <ul className="rfp-list" aria-label="Uploaded RFP files">
              {state.rfpFileNames.map((name) => {
                const f = inMemory.find((x) => x.name === name);
                const ext = name.split(".").pop()?.toUpperCase() ?? "";
                return (
                  <li key={name}>
                    <span className="ext" aria-hidden="true">{ext}</span>
                    <span className="rfp-meta">
                      <strong>{name}</strong>
                      <span>{f ? size(f.size) : "Upload again to re-run the pre-fill after a page reload"}</span>
                    </span>
                    <button className="icon-btn" onClick={() => remove(name)} aria-label={`Remove ${name}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {state.prefill.state === "running" && (
            <div className="status-card info" role="status">
              <span className="spinner" aria-hidden="true" />
              <span className="status-text">
                <strong>Reading the RFP and suggesting answers…</strong>
                <span>This can take a minute. You can continue with Staffing &amp; Skills meanwhile.</span>
              </span>
            </div>
          )}
          {state.prefill.state === "done" && (
            <div className="status-card ok" role="status">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
              <span className="status-text">
                <strong>{suggested} of {config.survey.length} questions suggested from the RFP</strong>
                <span>{open === 0 ? "Every question has an answer." : `${open} ${open === 1 ? "is" : "are"} not covered by the RFP and need${open === 1 ? "s" : ""} your answer.`}</span>
              </span>
              <button className="link-btn" onClick={() => onGoTo(3)}>Review in Domain Complexity</button>
            </div>
          )}
          {state.prefill.state === "error" && (
            <div className="status-card warn" role="status">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
              <span className="status-text">
                <strong>The RFP pre-fill did not finish</strong>
                <span>{state.prefill.message ?? "You can answer the questions yourself, or try again."}</span>
              </span>
              {canRetry && <button className="btn" onClick={() => void runPrefill(inMemory, dispatch)}>Try again</button>}
            </div>
          )}
        </section>
      </div>

      <section className="next-steps" aria-labelledby="next-h">
        <h2 id="next-h">What happens next</h2>
        <ol>
          {NEXT.map((n) => (
            <li key={n.num}>
              <span className="next-num" aria-hidden="true">{n.num}</span>
              <strong>{n.title}</strong>
              <span>{n.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
