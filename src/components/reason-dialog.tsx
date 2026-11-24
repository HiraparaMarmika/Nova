"use client";

import { FormEvent, useEffect, useState } from "react";

type ReasonDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
};

export function ReasonDialog({ open, title, description, confirmLabel, busy = false, onCancel, onConfirm }: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setReason(""); setError(""); } }, [open]);
  if (!open) return null;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = reason.trim();
    if (value.length < 3) { setError("Enter a clear reason of at least 3 characters."); return; }
    void onConfirm(value);
  }
  return <div className="workflow-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className="workflow-dialog" role="dialog" aria-modal="true" aria-labelledby="decision-dialog-title">
      <form onSubmit={submit}>
        <div className="workflow-dialog-head"><div><span className="eyebrow">Review decision</span><h2 id="decision-dialog-title">{title}</h2></div><button type="button" className="dialog-close" onClick={onCancel} disabled={busy} aria-label="Close dialog">&times;</button></div>
        <p className="muted">{description}</p>
        <div className="field"><label htmlFor="decision-reason">Reason</label><textarea id="decision-reason" value={reason} onChange={event => { setReason(event.target.value); setError(""); }} rows={4} placeholder="Explain the decision and any next steps for the cleaner" aria-invalid={Boolean(error)} autoFocus /></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="workflow-dialog-actions"><button type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving..." : confirmLabel}</button></div>
      </form>
    </section>
  </div>;
}
