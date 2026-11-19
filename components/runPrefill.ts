import type { Dispatch } from "react";
import type { Action } from "@/lib/state";

/** Sends the RFP files and the bid context to the pre-fill. Either one is enough. */
export async function runPrefill(files: File[], context: string, dispatch: Dispatch<Action>) {
  const ctx = context.trim();
  if (files.length === 0 && !ctx) return;
  dispatch({ type: "setPrefill", status: { state: "running" } });
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  if (ctx) form.append("context", ctx);
  try {
    const res = await fetch("/api/rfp", { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok) {
      dispatch({ type: "setPrefill", status: { state: "error", message: body.error ?? "The RFP pre-fill failed." } });
      return;
    }
    dispatch({ type: "applySuggestions", suggestions: body.suggestions });
    const found = Object.values(body.suggestions).filter((s) => s !== "not_found").length;
    dispatch({
      type: "setPrefill",
      status: { state: "done", context: ctx, message: `${found} of ${Object.keys(body.suggestions).length} questions suggested from the RFP and context.` },
    });
  } catch {
    dispatch({ type: "setPrefill", status: { state: "error", message: "The RFP pre-fill could not reach the server. Answer the survey manually." } });
  }
}
