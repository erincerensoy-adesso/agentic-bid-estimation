"use client";

import type { Dispatch, RefObject } from "react";
import { complexityScore, gainPotential } from "@/lib/calc";
import { config } from "@/lib/config";
import type { Action, BidState } from "@/lib/state";
import { availability } from "@/lib/survey";
import type { Level, QuestionId, SurveyAnswer } from "@/lib/types";
import { PrefillNotice } from "../PrefillNotice";
import { runPrefill } from "../runPrefill";

type Source = "llm" | "overridden" | "missing" | "operator" | "empty";

function sourceOf(a: SurveyAnswer | undefined): Source {
  if (a?.suggestion) return a.level === a.suggestion.level ? "llm" : "overridden";
  if (a?.notFound) return a.level == null ? "missing" : "operator";
  return a?.level == null ? "empty" : "operator";
}

const CONFIDENCE: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

function Badge({ a }: { a: SurveyAnswer | undefined }) {
  const s = sourceOf(a);
  if (s === "llm") return <span className="q-badge llm">Suggested from RFP · {CONFIDENCE[a!.suggestion!.confidence]} confidence</span>;
  if (s === "overridden") return <span className="q-badge over">Overridden</span>;
  if (s === "missing") return <span className="q-badge plain">Not found in RFP · answer manually</span>;
  if (s === "operator") return <span className="q-badge plain">Your answer</span>;
  return <span className="q-badge plain">Unanswered</span>;
}

function Meter({ level }: { level: number }) {
  return (
    <span className="meter" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => <i key={i} className={i <= level ? "on" : ""} />)}
    </span>
  );
}

export function SurveyStep({ state, dispatch, rfpFiles }: { state: BidState; dispatch: Dispatch<Action>; rfpFiles: RefObject<File[]> }) {
  const scale = config.surveyScaleLabels;
  const byId = new Map(config.survey.map((q) => [q.id, q]));
  const answered = config.survey.filter((q) => state.answers[q.id]?.level != null).length;
  const total = config.survey.length;
  const left = total - answered;
  const counts = { llm: 0, overridden: 0, missing: 0 };
  for (const q of config.survey) {
    const s = sourceOf(state.answers[q.id]);
    if (s === "llm") counts.llm++;
    if (s === "overridden") counts.overridden++;
    if (s === "missing") counts.missing++;
  }
  const canRerun = ((rfpFiles.current?.length ?? 0) > 0 || state.context.trim() !== "") && state.prefill.state !== "running";

  return (
    <section>
      <div className="page-title survey-title">
        <h1>Domain Complexity</h1>
        <p>
          Twelve questions about the project. Pick the answer that fits best on each scale, from {scale[0].toLowerCase()} on
          the left to {scale[3].toLowerCase()} on the right. More complex answers mean a lower AI gain.
        </p>
      </div>

      <div className="survey-layout">
        <div className="survey-main">
          {config.surveyGroups.map((g) => {
            const done = g.questions.filter((id) => state.answers[id]?.level != null).length;
            return (
              <section key={g.name} className="q-group" aria-labelledby={`grp-${g.name}`}>
                <div className="q-group-head">
                  <h2 id={`grp-${g.name}`}>{g.name}</h2>
                  <span>{done} of {g.questions.length} answered</span>
                </div>
                {g.questions.map((id) => {
                  const q = byId.get(id)!;
                  const a = state.answers[id as QuestionId];
                  const sug = a?.suggestion;
                  const avail = availability(id as QuestionId, state.answers, config);
                  return (
                    <fieldset key={id} className={`q-card ${a?.level == null ? "unanswered" : ""}`}>
                      <legend className="sr-only">{q.id} {q.question}</legend>
                      <div className="q-head">
                        <div className="q-heading">
                          <div><span className="qid">{q.id}</span> <span className="qtext">{q.question}</span></div>
                          <span className="qhelp">{q.help}</span>
                        </div>
                        <Badge a={a} />
                      </div>
                      <div className="q-options">
                        {q.levels.map((text, i) => {
                          const chosen = a?.level === i;
                          const disabled = !avail.allowed.has(i as Level);
                          const suggested = sug?.level === i;
                          return (
                            <label
                              key={i}
                              className={`q-option ${chosen ? "chosen" : ""} ${suggested ? "suggested" : ""} ${disabled ? "disabled" : ""}`}
                              title={disabled ? avail.reason : `${scale[i]} (score ${(i / 3).toFixed(2)})`}
                            >
                              <input
                                type="radio"
                                name={q.id}
                                checked={chosen}
                                disabled={disabled}
                                onChange={() => dispatch({ type: "setAnswer", q: id as QuestionId, level: i as Level })}
                              />
                              <span className="q-scale"><Meter level={i} /> {scale[i]}</span>
                              <span className="q-text">{text}</span>
                              {suggested && !chosen && <span className="q-suggested">Suggested from RFP</span>}
                            </label>
                          );
                        })}
                      </div>
                      {avail.reason && (
                        <p className="q-note">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
                          </svg>
                          {avail.reason}
                        </p>
                      )}
                      {sug && (
                        <div className="q-excerpt">
                          <span>“{sug.excerpt}”</span>
                          <span className="q-loc">
                            {sug.location}
                            {sourceOf(a) === "overridden" && <> · suggested: {q.levels[sug.level]}</>}
                          </span>
                        </div>
                      )}
                    </fieldset>
                  );
                })}
              </section>
            );
          })}
        </div>

        <aside className="survey-side" aria-label="Survey summary">
          <section className="side-card">
            <div className="side-row">
              <h2>Progress</h2>
              <strong>{answered} of {total}</strong>
            </div>
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered} aria-label="Questions answered">
              <span style={{ width: `${(answered / total) * 100}%` }} />
            </div>
            <p className="side-text">
              {left === 0 ? "All questions answered. Results are ready." : `${left} ${left === 1 ? "question needs" : "questions need"} an answer before results are available.`}
            </p>
          </section>

          <section className="side-card">
            <h2>RFP pre-fill</h2>
            {state.rfpFileNames.length > 0 ? (
              <ul className="rfp-files">
                {state.rfpFileNames.map((f) => (
                  <li key={f}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="side-text">No RFP uploaded. Upload one under Initials to get suggested answers.</p>
            )}
            {state.context.trim() && <p className="side-text small">Context from Initials is used too ({state.context.trim().length.toLocaleString("en-US")} characters).</p>}
            <dl className="prefill-counts">
              <div className="c-llm"><dt>Suggested</dt><dd>{counts.llm}</dd></div>
              <div className="c-over"><dt>Overridden</dt><dd>{counts.overridden}</dd></div>
              <div className="c-miss"><dt>Not in RFP</dt><dd>{counts.missing}</dd></div>
            </dl>
            <PrefillNotice status={state.prefill} />
            <button className="btn icon" disabled={!canRerun} onClick={() => void runPrefill(rfpFiles.current ?? [], state.context, dispatch)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v5h-5" />
              </svg>
              Re-run pre-fill
            </button>
            {!canRerun && state.rfpFileNames.length > 0 && state.prefill.state !== "running" && (
              <p className="side-text small">After a page reload, upload the RFP again under Initials to re-run it.</p>
            )}
          </section>

          <section className="side-card">
            <div className="side-title">
              <h2>Effect on each role</h2>
              <p className="side-text">Complexity from your answers, and the gain each role could reach with full AI enablement.</p>
            </div>
            <div className="role-effect head" aria-hidden="true"><span>Role</span><span>Complexity</span><span>Gain</span></div>
            {config.roles.map((role) => {
              const c = complexityScore(role, state.answers, config);
              return (
                <div className="role-effect" key={role}>
                  <span className="re-role">{role}</span>
                  <span className="re-bar">
                    <span className="re-track"><span style={{ width: `${c * 100}%` }} /></span>
                    <span className="re-c">{c.toFixed(2)}</span>
                  </span>
                  <span className="re-gain">{gainPotential(c, role, config).toFixed(2)}x</span>
                </div>
              );
            })}
          </section>
        </aside>
      </div>
    </section>
  );
}
