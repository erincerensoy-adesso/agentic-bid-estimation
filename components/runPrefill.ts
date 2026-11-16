import type { Dispatch } from "react";
import type { Action } from "@/lib/state";

export async function runPrefill(files: File[], dispatch: Dispatch<Action>) {
  if (files.length === 0) return;
  dispatch({ type: "setPrefill", status: { state: "running" } });
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
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
      status: { state: "done", message: `${found} of ${Object.keys(body.suggestions).length} questions suggested from the RFP.` },
    });
  } catch {
    dispatch({ type: "setPrefill", status: { state: "error", message: "The RFP pre-fill could not reach the server. Answer the survey manually." } });
  }
}
