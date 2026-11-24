"use client";

import { FormEvent, ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";

type Visit = {
  id: string;
  status: string;
  startsAt: string;
  postcode?: string;
  reviewed?: boolean;
  complaintStatus?: string | null;
};

async function requestJson(url: string, method: "POST" | "PATCH", body: object) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.replaceAll("_", " ") ?? "Action could not be completed");
  }
}

function WorkflowDialog({ title, description, children, busy, onClose, onSubmit }: {
  title: string;
  description: string;
  children: ReactNode;
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <div className="workflow-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}>
    <form className="workflow-dialog card" role="dialog" aria-modal="true" aria-labelledby="workflow-title" onSubmit={onSubmit}>
      <div className="workflow-dialog-head"><div><span className="eyebrow">Visit workflow</span><h2 id="workflow-title">{title}</h2><p className="muted">{description}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close">&times;</button></div>
      {children}
      <div className="actions"><button type="button" className="button button-secondary button-small" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-primary button-small" disabled={busy}>{busy ? "Saving..." : "Confirm"}</button></div>
    </form>
  </div>;
}

export function CustomerVisitActions({ visits }: { visits: Visit[] }) {
  const router = useRouter();
  const { showToast, updateToast } = useToast();
  const [dialog, setDialog] = useState<{ kind: "reschedule" | "review" | "complaint"; visit: Visit } | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [rating, setRating] = useState(5);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  function open(kind: "reschedule" | "review" | "complaint", visit: Visit) {
    setStartsAt(new Date(visit.startsAt).toISOString().slice(0, 16));
    setRating(5);
    setNotes("");
    setDialog({ kind, visit });
  }

  async function updateStatus(visit: Visit, status: string, success: string) {
    if (status === "CANCELLED_BY_CUSTOMER" && !window.confirm("Cancel this visit? The demo authorization will be released.")) return;
    const toast = showToast("Updating visit...", "loading");
    try { await requestJson(`/api/occurrences/${visit.id}`, "PATCH", { status }); updateToast(toast, success, "success"); router.refresh(); }
    catch (error) { updateToast(toast, error instanceof Error ? error.message : "Action failed", "error"); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) return;
    setBusy(true);
    const toast = showToast("Saving your update...", "loading");
    try {
      if (dialog.kind === "reschedule") await requestJson(`/api/occurrences/${dialog.visit.id}/reschedule`, "PATCH", { startsAt: new Date(startsAt).toISOString() });
      if (dialog.kind === "review") await requestJson(`/api/occurrences/${dialog.visit.id}/review`, "POST", { rating, body: notes || undefined });
      if (dialog.kind === "complaint") await requestJson(`/api/occurrences/${dialog.visit.id}/complaint`, "POST", { reason: notes });
      updateToast(toast, dialog.kind === "reschedule" ? "Visit rescheduled" : dialog.kind === "review" ? "Review saved" : "Support case opened", "success");
      setDialog(null);
      router.refresh();
    } catch (error) { updateToast(toast, error instanceof Error ? error.message : "Action failed", "error"); }
    finally { setBusy(false); }
  }

  return <>
    <div className="workflow-list">{visits.map(visit => {
      const scheduled = ["REQUESTED", "ACCEPTED", "SCHEDULED"].includes(visit.status);
      const completed = ["COMPLETED", "CONFIRMED", "SETTLED"].includes(visit.status);
      return <article className="workflow-row" key={visit.id}><div><strong>{new Date(visit.startsAt).toLocaleString("en-GB")}</strong><span>{visit.postcode ? `${visit.postcode} · ` : ""}{visit.status.replaceAll("_", " ")}</span></div><div className="workflow-buttons">
        {scheduled && <button className="button button-secondary button-small" onClick={() => open("reschedule", visit)}>Reschedule</button>}
        {scheduled && <button className="button button-danger button-small" onClick={() => updateStatus(visit, "CANCELLED_BY_CUSTOMER", "Visit cancelled")}>Cancel</button>}
        {visit.status === "COMPLETED" && <button className="button button-primary button-small" onClick={() => updateStatus(visit, "CONFIRMED", "Completion confirmed; settlement is scheduled after the support window")}>Confirm service</button>}
        {completed && !visit.reviewed && <button className="button button-secondary button-small" onClick={() => open("review", visit)}>Review</button>}
        {["IN_PROGRESS", "COMPLETED", "CONFIRMED", "SETTLED"].includes(visit.status) && !visit.complaintStatus && <button className="button button-secondary button-small" onClick={() => open("complaint", visit)}>Get support</button>}
        {visit.complaintStatus && <span className="status">Case {visit.complaintStatus}</span>}
        {["DECLINED", "EXPIRED"].includes(visit.status) && <button className="button button-primary button-small" onClick={() => window.location.assign(`/booking?postcode=${encodeURIComponent(visit.postcode ?? "")}`)}>Find an alternative</button>}
      </div></article>;
    })}</div>
    {dialog && <WorkflowDialog title={dialog.kind === "reschedule" ? "Reschedule visit" : dialog.kind === "review" ? "Rate your service" : "Open a support case"} description={dialog.kind === "reschedule" ? "Choose a future date and time." : dialog.kind === "review" ? "Your feedback helps maintain service quality." : "Describe what happened so the operations team can investigate."} busy={busy} onClose={() => setDialog(null)} onSubmit={submit}>
      {dialog.kind === "reschedule" ? <div className="field"><label htmlFor="new-start">New start</label><input id="new-start" type="datetime-local" value={startsAt} min={new Date().toISOString().slice(0, 16)} onChange={event => setStartsAt(event.target.value)} required /></div> : dialog.kind === "review" ? <><div className="field"><label htmlFor="rating">Rating</label><select id="rating" value={rating} onChange={event => setRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} star{value === 1 ? "" : "s"}</option>)}</select></div><div className="field"><label htmlFor="review-notes">Comments (optional)</label><textarea id="review-notes" value={notes} onChange={event => setNotes(event.target.value)} maxLength={1000} rows={4} /></div></> : <div className="field"><label htmlFor="case-notes">What happened?</label><textarea id="case-notes" value={notes} onChange={event => setNotes(event.target.value)} minLength={10} maxLength={1000} rows={5} required /></div>}
    </WorkflowDialog>}
  </>;
}

export function CleanerJobActions({ visits }: { visits: Visit[] }) {
  const router = useRouter();
  const { showToast, updateToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const next: Record<string, { status: string; label: string }> = { REQUESTED: { status: "ACCEPTED", label: "Accept" }, ACCEPTED: { status: "SCHEDULED", label: "Schedule" }, SCHEDULED: { status: "IN_PROGRESS", label: "Start job" }, IN_PROGRESS: { status: "COMPLETED", label: "Complete" } };
  async function act(visit: Visit, status: string) {
    setBusyId(visit.id);
    const toast = showToast("Updating job...", "loading");
    try { await requestJson(`/api/occurrences/${visit.id}`, "PATCH", { status }); updateToast(toast, `Job marked ${status.replaceAll("_", " ").toLowerCase()}`, "success"); router.refresh(); }
    catch (error) { updateToast(toast, error instanceof Error ? error.message : "Action failed", "error"); }
    finally { setBusyId(null); }
  }
  return <div className="workflow-list">{visits.map(visit => <article className="workflow-row" key={visit.id}><div><strong>{new Date(visit.startsAt).toLocaleString("en-GB")}</strong><span>{visit.postcode} · {visit.status.replaceAll("_", " ")}</span></div><div className="workflow-buttons">{next[visit.status] && <button className="button button-primary button-small" disabled={busyId === visit.id} onClick={() => act(visit, next[visit.status].status)}>{next[visit.status].label}</button>}{visit.status === "REQUESTED" && <button className="button button-secondary button-small" disabled={busyId === visit.id} onClick={() => act(visit, "DECLINED")}>Decline</button>}{["ACCEPTED", "SCHEDULED"].includes(visit.status) && <button className="button button-danger button-small" disabled={busyId === visit.id} onClick={() => window.confirm("Cancel this job?") && act(visit, "CANCELLED_BY_CLEANER")}>Cancel job</button>}{visit.status === "SCHEDULED" && <button className="button button-secondary button-small" disabled={busyId === visit.id} onClick={() => window.confirm("Mark the customer as a no-show?") && act(visit, "NO_SHOW")}>No-show</button>}</div></article>)}</div>;
}

export function RecurringSeriesActions({ series }: { series: { id: string; cleaner: string; frequency: number; active: boolean; nextDate: string | null }[] }) {
  const router = useRouter(); const { showToast, updateToast } = useToast(); const [busyId, setBusyId] = useState<string | null>(null);
  async function cancel(id: string) { if (!window.confirm("Cancel this recurring series and release all future demo authorizations?")) return; setBusyId(id); const toast = showToast("Cancelling recurring series...", "loading"); try { await requestJson(`/api/bookings/${id}/series`, "PATCH", {}); updateToast(toast, "Recurring series cancelled", "success"); router.refresh(); } catch (error) { updateToast(toast, error instanceof Error ? error.message : "Could not cancel series", "error"); } finally { setBusyId(null); } }
  return <div className="workflow-list">{series.map(item => <article className="workflow-row" key={item.id}><div><strong>{item.cleaner}</strong><span>Every {item.frequency} week{item.frequency === 1 ? "" : "s"}{item.nextDate ? ` · next ${new Date(item.nextDate).toLocaleString("en-GB")}` : ""}</span></div><div className="workflow-buttons"><span className="status">{item.active ? "ACTIVE" : "CANCELLED"}</span>{item.active && <button className="button button-danger button-small" disabled={busyId === item.id} onClick={() => cancel(item.id)}>Cancel series</button>}</div></article>)}</div>;
}

export function AdminDisputeActions({ complaints }: { complaints: { id: string; reason: string; status: string; openedAt: string; resolution?: string | null }[] }) {
  const router = useRouter();
  const { showToast, updateToast } = useToast();
  const [active, setActive] = useState<(typeof complaints)[number] | null>(null);
  const [resolution, setResolution] = useState("");
  const [outcome, setOutcome] = useState("SETTLE");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!active) return; setBusy(true); const toast = showToast("Resolving case...", "loading");
    try { await requestJson(`/api/complaints/${active.id}`, "PATCH", { resolution, outcome }); updateToast(toast, "Case resolved and audited", "success"); setActive(null); router.refresh(); }
    catch (error) { updateToast(toast, error instanceof Error ? error.message : "Action failed", "error"); }
    finally { setBusy(false); }
  }
  return <><div className="workflow-list">{complaints.map(item => <article className="workflow-row" key={item.id}><div><strong>{item.reason}</strong><span>{new Date(item.openedAt).toLocaleString("en-GB")} · {item.status}</span>{item.resolution && <small>{item.resolution}</small>}</div>{item.status !== "RESOLVED" && <button className="button button-primary button-small" onClick={() => { setActive(item); setResolution(""); setOutcome("SETTLE"); }}>Resolve case</button>}</article>)}</div>{active && <WorkflowDialog title="Resolve support case" description="Choose a financial and lifecycle outcome. Every decision is audited." busy={busy} onClose={() => setActive(null)} onSubmit={submit}><div className="field"><label htmlFor="outcome">Outcome</label><select id="outcome" value={outcome} onChange={event => setOutcome(event.target.value)}><option value="SETTLE">Approve service and settle</option><option value="FULL_REFUND">Issue full demo refund</option><option value="RELEASE">Cancel and release authorization</option><option value="NO_ACTION">Close with no financial adjustment</option></select></div><div className="field"><label htmlFor="resolution">Resolution</label><textarea id="resolution" value={resolution} onChange={event => setResolution(event.target.value)} minLength={5} maxLength={1000} rows={5} required /></div></WorkflowDialog>}</>;
}
