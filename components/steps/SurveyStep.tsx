"use client";

import type { Dispatch, RefObject } from "react";
import { config } from "@/lib/config";
import type { Action, BidState } from "@/lib/state";
import type { Level, QuestionId } from "@/lib/types";
import { PrefillNotice } from "../PrefillNotice";
import { runPrefill } from "../runPrefill";

const SCORES = ["0", "1/3", "2/3", "1"];

export function SurveyStep({ state, dispatch, rfpFiles }: { state: BidState; dispatch: Dispatch<Action>; rfpFiles: RefObject<File[]> }) {
  const answered = config.survey.filter((q) => state.answers[q.id]?.level != null).length;
  const canRerun = (rfpFiles.current?.length ?? 0) > 0 && state.prefill.state !== "running";

  return (
    <section>
      <h1>Complexity survey</h1>
      <p className="lead">
        Twelve questions; 0 is simplest. Answers suggested from the RFP are marked. Change any answer you disagree with.
        <span className="muted"> {answered} of {config.survey.length} answered.</span>
      </p>
      <div className="toolbar">
        <button className="btn small" disabled={!canRerun} onClick={() => void runPrefill(rfpFiles.current ?? [], dispatch)}>
          Re-run RFP pre-fill
        </button>
        {!canRerun && state.prefill.state !== "running" && <span className="muted small">Upload the RFP in step 1 to run the pre-fill.</span>}
      </div>
      <PrefillNotice status={state.prefill} />

      <ol className="survey">
        {config.survey.map((q) => {
          const a = state.answers[q.id as QuestionId];
          const sug = a?.suggestion;
          return (
            <li key={q.id} className={`question ${a?.level == null ? "unanswered" : ""}`}>
              <div className="question-head">
                <span className="qid">{q.id}</span>
                <span className="qtext">{q.question}</span>
                {sug && a?.source === "llm" && <span className="badge llm">Suggested from RFP · {sug.confidence} confidence</span>}
                {sug && a?.source === "llm-overridden" && <span className="badge overridden">Overridden</span>}
              </div>
              <div className="levels" role="radiogroup" aria-label={q.question}>
                {q.levels.map((label, i) => (
                  <label key={i} className={`level ${a?.level === i ? "chosen" : ""} ${sug?.level === i ? "suggested" : ""}`}>
                    <input
                      type="radio"
                      name={q.id}
                      checked={a?.level === i}
                      onChange={() => dispatch({ type: "setAnswer", q: q.id as QuestionId, level: i as Level })}
                    />
                    <span className="score">{SCORES[i]}</span>
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {sug && (
                <blockquote className="excerpt">
                  “{sug.excerpt}” <cite>— {sug.location}</cite>
                  {a?.source === "llm-overridden" && <span className="muted"> (suggested: {q.levels[sug.level]})</span>}
                </blockquote>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
