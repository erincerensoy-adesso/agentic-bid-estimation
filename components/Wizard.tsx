"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { calculate } from "@/lib/calc";
import { config, modelCatalog } from "@/lib/config";
import { initialState, reducer, STORAGE_KEY } from "@/lib/state";
import { ExportButton } from "./ExportButton";
import { BidStep } from "./steps/BidStep";
import { ModelsStep } from "./steps/ModelsStep";
import { ResultsStep } from "./steps/ResultsStep";
import { SurveyStep } from "./steps/SurveyStep";
import { TimelineStep } from "./steps/TimelineStep";

const STEPS = ["Initials", "Staffing & Skills", "Models & Harness", "Domain Complexity", "Results"] as const;

export function Wizard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  /** RFP files live only in memory so the pre-fill can be re-run; they are never persisted. */
  const rfpFiles = useRef<File[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "load", state: JSON.parse(raw) });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setLoaded(true);
  }, []);

  // Each step opens at the top of the page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

  const result = useMemo(
    () =>
      calculate(
        {
          timeline: state.timeline,
          allowedModelIds: state.allowedModelIds,
          allowedHarnessIds: state.allowedHarnessIds,
          answers: state.answers,
          overrides: state.overrides,
        },
        config,
        modelCatalog,
      ),
    [state.timeline, state.allowedModelIds, state.allowedHarnessIds, state.answers, state.overrides],
  );

  const stepDone = [
    Boolean(state.bidName && state.clientName),
    Boolean(state.timeline && state.timeline.lines.every((l) => l.role && l.capability)),
    state.allowedModelIds.length > 0 && state.allowedHarnessIds.length > 0,
    config.survey.every((q) => state.answers[q.id]?.level != null),
    result.ready,
  ];

  function newBid() {
    if (!confirm("Start a new bid? The current bid will be cleared from this browser.")) return;
    rfpFiles.current = [];
    dispatch({ type: "reset" });
    setStep(0);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="product">Agentic Estimation Platform</div>
          <div className="topbar-meta">
            {state.bidName && (
              <span className="bid-label">
                {state.bidName}
                {state.clientName && <span className="bid-client"> · {state.clientName}</span>}
              </span>
            )}
            <button className="btn" onClick={newBid}>New bid</button>
          </div>
        </div>
        <nav className="stepper" aria-label="Steps">
          {STEPS.map((label, i) => (
            <button
              key={label}
              className={`step ${i === step ? "active" : ""} ${stepDone[i] ? "done" : ""}`}
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
            >
              <span className="step-num" aria-hidden="true">{stepDone[i] ? "✓" : i + 1}</span>
              <span>{label}</span>
              {stepDone[i] && <span className="sr-only"> (done)</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="content">
        {!loaded ? null : (
          <>
            {step === 0 && <BidStep state={state} dispatch={dispatch} rfpFiles={rfpFiles} />}
            {step === 1 && <TimelineStep state={state} dispatch={dispatch} />}
            {step === 2 && <ModelsStep state={state} dispatch={dispatch} result={result} />}
            {step === 3 && <SurveyStep state={state} dispatch={dispatch} rfpFiles={rfpFiles} />}
            {step === 4 && <ResultsStep state={state} dispatch={dispatch} result={result} />}
          </>
        )}
        <div className="step-nav">
          <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
            ← Back
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn primary" onClick={() => setStep(step + 1)}>
              Next: {STEPS[step + 1]} →
            </button>
          ) : (
            <ExportButton state={state} result={result} />
          )}
        </div>
      </main>
    </div>
  );
}
