"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReasonDialog } from "@/components/reason-dialog";
import { useToast } from "@/components/toast-provider";
import { getAdminCopy } from "@/lib/admin-copy";
import { useLocale } from "@/lib/i18n";

type WaitlistDecision = { id: string; email: string; status: "CONTACTED" | "CLOSED" };
export function WaitlistActions({ entries }: { entries: { id: string; email: string; postcode: string; status: string; createdAt: string }[] }) {
  const router = useRouter(); const { showToast, updateToast } = useToast(); const { locale } = useLocale(); const copy = getAdminCopy(locale); const [decision, setDecision] = useState<WaitlistDecision | null>(null); const [busy, setBusy] = useState(false);
  async function update(reason: string) { if (!decision) return; setBusy(true); const toast = showToast(copy.messages.waitlistUpdating, "loading"); const response = await fetch(`/api/admin/waitlist/${decision.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: decision.status, reason }) }); if (response.ok) { updateToast(toast, copy.messages.waitlistUpdated, "success"); setDecision(null); router.refresh(); } else updateToast(toast, copy.messages.waitlistFailed, "error"); setBusy(false); }
  const dialogTitle = decision?.status === "CONTACTED" ? (locale === "de" ? "Kundenkontakt markieren" : "Mark customer as contacted") : (locale === "de" ? "Wartelisteneintrag schließen" : "Close waitlist entry");
  return <><div className="workflow-list">{entries.map(item => <article className="workflow-row" key={item.id}><div><strong>{item.email}</strong><span>{item.postcode} · {copy.labels.joined} {new Date(item.createdAt).toLocaleDateString(locale === "de" ? "de-DE" : "en-GB")}</span></div><div className="workflow-buttons"><span className="status">{item.status}</span>{item.status === "WAITING" && <button className="button button-primary button-small" onClick={() => setDecision({ id: item.id, email: item.email, status: "CONTACTED" })}>{copy.actions.markContacted}</button>}{item.status !== "CLOSED" && <button className="button button-secondary button-small" onClick={() => setDecision({ id: item.id, email: item.email, status: "CLOSED" })}>{copy.actions.close}</button>}</div></article>)}</div><ReasonDialog open={Boolean(decision)} title={dialogTitle} description={`${locale === "de" ? "Ergebnis dokumentieren für" : "Record the outcome for"} ${decision?.email ?? (locale === "de" ? "diesen Wartelisteneintrag" : "this waitlist entry")}.`} confirmLabel={copy.actions.updateWaitlist} busy={busy} onCancel={() => setDecision(null)} onConfirm={update} /></>;
}
