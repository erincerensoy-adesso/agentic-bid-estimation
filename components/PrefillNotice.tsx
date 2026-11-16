import type { PrefillStatus } from "@/lib/state";

export function PrefillNotice({ status }: { status: PrefillStatus }) {
  if (status.state === "idle") return null;
  if (status.state === "running")
    return <div className="notice info"><span className="spinner" aria-hidden /> Reading the RFP and pre-filling the survey… This can take a minute. You can keep working.</div>;
  if (status.state === "error") return <div className="notice warn">{status.message}</div>;
  return <div className="notice ok">{status.message}</div>;
}
