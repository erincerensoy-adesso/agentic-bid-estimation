"use client";

import { useId, useState, type Dispatch, type RefObject } from "react";
import { config } from "@/lib/config";
import { reportFileName } from "@/lib/fileName";
import { CONTEXT_MAX, type Action, type BidState } from "@/lib/state";
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
  const ctxId = useId();
  const inMemory = rfpFiles.current ?? [];
  const running = state.prefill.state === "running";
  const ctx = state.context.trim();
  const hasSource = inMemory.length > 0 || ctx !== "";
  const canRun = hasSource && !running;
  const done = state.prefill.state === "done";
  // Files or context changed since the last finished run.
  const changed =
    done &&
    ((state.prefill.context ?? "") !== ctx ||
      (state.prefill.files ?? []).join("\n") !== inMemory.map((f) => f.name).join("\n"));
  const run = () => void runPrefill(inMemory, state.context, dispatch);

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
  }

  function remove(name: string) {
    const remaining = inMemory.filter((f) => f.name !== name);
    rfpFiles.current = remaining;
    dispatch({ type: "setRfpFiles", names: state.rfpFileNames.filter((n) => n !== name) });
  }

  const suggested = config.survey.filter((q) => state.answers[q.id]?.suggestion).length;
  const open = config.survey.filter((q) => state.answers[q.id]?.level == null).length;

  return (
    <section>
      <div className="page-title survey-title">
        <h1>Initials</h1>
        <p>Name the bid, upload the RFP and add any context the RFP does not say. When both are ready, select Suggest answers to pre-fill the Domain Complexity questions.</p>
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
            <h2 id="rfp-h">RFP and context</h2>
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
            <span>Adding files replaces the current set</span>
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

          <div className="field context-field">
            <label htmlFor={ctxId}>Context <span className="optional">optional</span></label>
            <p className="field-help" id={`${ctxId}-help`}>
              What the team knows beyond the RFP: client background, constraints, notes from calls. Kept in this browser and
              added to the Excel report. Do not paste secrets or personal data.
            </p>
            <textarea
              id={ctxId}
              aria-describedby={`${ctxId}-help ${ctxId}-count`}
              rows={6}
              maxLength={CONTEXT_MAX}
              value={state.context}
              onChange={(e) => dispatch({ type: "setContext", context: e.target.value })}
              placeholder="e.g. The client confirmed in the kick-off call that the legacy core banking API stays; only the mobile front end and BFF are in scope. Go-live must be before the Q3 regulatory deadline."
            />
            <p id={`${ctxId}-count`} className="side-text small context-count">
              {state.context.length.toLocaleString("en-US")} / {CONTEXT_MAX.toLocaleString("en-US")} characters
            </p>
          </div>

          <div className="prefill-action">
            <span className="side-text">
              {running
                ? "Suggesting answers…"
                : !hasSource
                  ? state.rfpFileNames.length > 0
                    ? "Upload the RFP again after a page reload, or write some context, to suggest answers."
                    : "Add the RFP, the context or both, then suggest answers."
                  : changed
                    ? "The files or context changed since the last run."
                    : done
                      ? "Answers were suggested from the current files and context."
                      : "Nothing is sent until you select Suggest answers."}
            </span>
            {(!done || changed) && state.prefill.state !== "error" && (
              <button className="btn primary" disabled={!canRun} onClick={run}>
                {done ? "Re-run with changes" : "Suggest answers"}
              </button>
            )}
          </div>

          {state.prefill.state === "running" && (
            <div className="status-card info" role="status">
              <span className="spinner" aria-hidden="true" />
              <span className="status-text">
                <strong>Reading the {inMemory.length ? "RFP" : "context"}{inMemory.length && ctx ? " and context" : ""} and suggesting answers…</strong>
                <span>This can take a minute. You can continue with Staffing &amp; Skills meanwhile.</span>
              </span>
            </div>
          )}
          {state.prefill.state === "done" && (
            <div className="status-card ok" role="status">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
              <span className="status-text">
                <strong>{suggested} of {config.survey.length} questions suggested from the {state.prefill.context ? "RFP and context" : "RFP"}</strong>
                <span>{open === 0 ? "Every question has an answer." : `${open} ${open === 1 ? "is" : "are"} not covered and need${open === 1 ? "s" : ""} your answer.`}</span>
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
              {canRun && <button className="btn" onClick={run}>Try again</button>}
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
