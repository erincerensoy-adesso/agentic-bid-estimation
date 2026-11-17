"use client";

import type { Dispatch, RefObject } from "react";
import { config } from "@/lib/config";
import type { Action, BidState } from "@/lib/state";
import { availability } from "@/lib/survey";
import type { Level, QuestionId } from "@/lib/types";
import { PrefillNotice } from "../PrefillNotice";
import { runPrefill } from "../runPrefill";

/** Four-step bar showing how far along the simplest-to-most-complex scale an answer sits. */
function Meter({ level }: { level: number }) {
  return (
    <span className="meter" aria-hidden>
      {[0, 1, 2, 3].map((i) => <i key={i} className={i <= level ? "on" : ""} />)}
    </span>
  );
}

export function SurveyStep({ state, dispatch, rfpFiles }: { state: BidState; dispatch: Dispatch<Action>; rfpFiles: RefObject<File[]> }) {
  const answered = config.survey.filter((q) => state.answers[q.id]?.level != null).length;
  const canRerun = (rfpFiles.current?.length ?? 0) > 0 && state.prefill.state !== "running";
  const scale = config.surveyScaleLabels;

  return (
    <section>
      <h1>Complexity Survey</h1>
      <p className="lead">
        Twelve questions about the project. For each, pick the answer that fits best. Answers run from{" "}
        <strong>{scale[0].toLowerCase()}</strong> on the left to <strong>{scale[3].toLowerCase()}</strong> on the right; the
        more complex the answers, the lower the AI gain.
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
          const id = q.id as QuestionId;
          const a = state.answers[id];
          const sug = a?.suggestion;
          const avail = availability(id, state.answers, config);
          return (
            <li key={q.id} className={`question ${a?.level == null ? "unanswered" : ""}`}>
              <div className="question-head">
                <span className="qid">{q.id}</span>
                <span className="qtext">{q.question}</span>
                {sug && a?.source === "llm" && <span className="badge llm">Suggested from RFP · {sug.confidence} confidence</span>}
                {sug && a?.source === "llm-overridden" && <span className="badge overridden">Overridden</span>}
              </div>
              <p className="qhelp">{q.help}</p>
              <div className="levels" role="radiogroup" aria-label={q.question}>
                {q.levels.map((text, i) => {
                  const disabled = !avail.allowed.has(i as Level);
                  return (
                    <label
                      key={i}
                      className={`level ${a?.level === i ? "chosen" : ""} ${sug?.level === i ? "suggested" : ""} ${disabled ? "disabled" : ""}`}
                      title={disabled ? avail.reason : `${scale[i]} (score ${(i / 3).toFixed(2)})`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={a?.level === i}
                        disabled={disabled}
                        onChange={() => dispatch({ type: "setAnswer", q: id, level: i as Level })}
                      />
                      <span className="level-body">
                        <span className="level-scale"><Meter level={i} /> {scale[i]}</span>
                        <span className="level-text">{text}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {avail.reason && <p className="qlink">{avail.reason}</p>}
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
