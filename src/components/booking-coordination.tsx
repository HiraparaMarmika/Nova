"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";

type ThreadMessage = { id: string; body: string; createdAt: string; senderAccountId: string; senderName: string };
type BookingThread = { id: string; startsAt: string; status: string; counterpartName: string; counterpartDetail?: string | null; hourlyRateCents?: number | null; messages: ThreadMessage[] };
const stages = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"] as const;

function stageIndex(status: string) {
  if (["REQUESTED", "ACCEPTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CONFIRMED", "SETTLED"].includes(status)) {
    if (status === "REQUESTED") return 0;
    if (["ACCEPTED", "SCHEDULED"].includes(status)) return 1;
    if (status === "IN_PROGRESS") return 2;
    return 3;
  }
  return -1;
}
function stageLabel(status: string) { return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()); }

export function BookingCoordination({ bookings, viewer, currentAccountId }: { bookings: BookingThread[]; viewer: "customer" | "cleaner"; currentAccountId: string }) {
  if (!bookings.length) return null;
  return <section className="coordination-stack" aria-label="Booking coordination">{bookings.map(booking => <BookingThreadCard booking={booking} viewer={viewer} currentAccountId={currentAccountId} key={booking.id} />)}</section>;
}

function BookingThreadCard({ booking, viewer, currentAccountId }: { booking: BookingThread; viewer: "customer" | "cleaner"; currentAccountId: string }) {
  const router = useRouter(); const { showToast, updateToast } = useToast(); const [body, setBody] = useState(""); const [busy, setBusy] = useState(false); const activeStage = stageIndex(booking.status);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!body.trim()) return; setBusy(true); const toast = showToast("Sending message...", "loading");
    const response = await fetch(`/api/bookings/${booking.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
    if (response.ok) { setBody(""); updateToast(toast, "Message sent securely", "success"); router.refresh(); }
    else updateToast(toast, "Message could not be sent", "error");
    setBusy(false);
  }
  return <article className="card coordination-card"><div className="coordination-head"><div><span className="eyebrow">Assigned booking</span><h2>{viewer === "customer" ? `Your cleaner: ${booking.counterpartName}` : `Customer: ${booking.counterpartName}`}</h2><p>{new Date(booking.startsAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · <strong>{stageLabel(booking.status)}</strong></p></div><span className="status">{stageLabel(booking.status)}</span></div><div className="booking-progress" aria-label={`Booking progress: ${stageLabel(booking.status)}`}>{stages.map((stage, index) => <div className={index <= activeStage ? "is-complete" : ""} key={stage}><i>{index < activeStage ? "✓" : index + 1}</i><span>{stage === "REQUESTED" ? "Assigned" : stageLabel(stage)}</span></div>)}</div>{viewer === "customer" && <div className="assigned-profile"><div className="profile-monogram" aria-hidden="true">{booking.counterpartName.slice(0, 1).toUpperCase()}</div><div><strong>{booking.counterpartName}</strong>{booking.counterpartDetail && <p>{booking.counterpartDetail}</p>}{booking.hourlyRateCents && <small>From €{(booking.hourlyRateCents / 100).toFixed(2)} per hour</small>}</div></div>}<div className="booking-message-thread"><div className="thread-head"><strong>Secure messages</strong><span>Only you and the assigned {viewer === "customer" ? "cleaner" : "customer"} can view this conversation.</span></div><div className="thread-messages" aria-live="polite">{booking.messages.length ? booking.messages.map(message => <div className={message.senderAccountId === currentAccountId ? "is-own" : ""} key={message.id}><strong>{message.senderAccountId === currentAccountId ? "You" : message.senderName}</strong><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></div>) : <p className="thread-empty">Send the first message about this booking.</p>}</div><form className="thread-compose" onSubmit={send}><label className="sr-only" htmlFor={`message-${booking.id}`}>Message</label><textarea id={`message-${booking.id}`} value={body} onChange={event => setBody(event.target.value)} maxLength={1000} rows={2} placeholder="Write a message about this booking" disabled={busy} required /><button className="button button-primary button-small" disabled={busy}>{busy ? "Sending..." : "Send message"}</button></form></div></article>;
}
