"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";
import { useLocale } from "@/lib/i18n";

export type NotificationItem = { id: string; kind: string; subject: string; body: string; readAt: string | null; createdAt: string };
export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter(); const { showToast, updateToast } = useToast(); const { locale } = useLocale();
  const wording = locale === "de" ? { updating: "Benachrichtigung wird aktualisiert...", read: "Als gelesen markiert", failed: "Benachrichtigung konnte nicht aktualisiert werden", mark: "Als gelesen markieren", empty: "Keine Benachrichtigungen", hint: "Workflow-Updates werden hier angezeigt." } : { updating: "Updating notification...", read: "Marked as read", failed: "Could not update notification", mark: "Mark read", empty: "No notifications", hint: "Workflow updates will appear here." };
  async function markRead(id: string) { const toast = showToast(wording.updating, "loading"); const response = await fetch(`/api/notifications/${id}`, { method: "PATCH" }); if (response.ok) { updateToast(toast, wording.read, "success"); router.refresh(); } else updateToast(toast, wording.failed, "error"); }
  return <div className="notification-list">{items.length ? items.map(item => <article className={`notification-row ${item.readAt ? "is-read" : ""}`} key={item.id}><span className="notification-kind">{item.kind.replaceAll("_", " ")}</span><div><strong>{item.subject}</strong><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString(locale === "de" ? "de-DE" : "en-GB")}</small></div>{!item.readAt && <button className="button button-secondary button-small" onClick={() => markRead(item.id)}>{wording.mark}</button>}</article>) : <div className="table-empty"><strong>{wording.empty}</strong><span>{wording.hint}</span></div>}</div>;
}
