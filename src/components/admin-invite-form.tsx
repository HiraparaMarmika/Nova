"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";
import { getAdminCopy } from "@/lib/admin-copy";
import { useLocale } from "@/lib/i18n";

export function AdminInviteForm() {
  const router = useRouter(); const { showToast, updateToast } = useToast(); const { locale } = useLocale(); const copy = getAdminCopy(locale); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError("");
    const toast = showToast(copy.messages.inviteSending, "loading");
    try {
      const response = await fetch("/api/admin/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: values.get("email"), reason: values.get("reason") }) });
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        updateToast(toast, body.delivery?.queued ? "Invitation queued for delivery" : copy.messages.inviteCreated, body.delivery?.queued ? "success" : "error");
        form.reset();
        router.refresh();
      } else {
        setError(body.error === "invitation_delivery_failed" ? copy.messages.inviteDeliveryFailed : copy.messages.inviteInvalid);
        updateToast(toast, copy.messages.inviteFailed, "error");
      }
    } catch {
      setError(copy.messages.inviteFailed);
      updateToast(toast, copy.messages.inviteFailed, "error");
    } finally { setBusy(false); }
  }
  return <form className="card settings-panel" onSubmit={submit}><div><span className="eyebrow">{copy.eyebrow.inviteOnly}</span><h2>{copy.actions.sendInvitation}</h2><p className="muted">{copy.messages.inviteDescription}</p></div><div className="form-grid"><div className="field"><label>{copy.labels.adminEmail}</label><input name="email" type="email" placeholder="admin@company.com" required /></div><div className="field"><label>{copy.labels.invitationReason}</label><input name="reason" minLength={3} placeholder={locale === "de" ? "Zum Beispiel Zugang für Betriebsleitung" : "For example, Operations manager access"} required /></div></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary button-small" disabled={busy}>{busy ? copy.actions.sending : copy.actions.sendInvitation}</button></form>;
}
