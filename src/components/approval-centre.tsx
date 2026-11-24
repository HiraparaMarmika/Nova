"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ReasonDialog } from "@/components/reason-dialog";
import { useToast } from "@/components/toast-provider";

type Cleaner = { id: string; name: string; email: string; onboarding: string; accountState: string; createdAt: string; documentCount: number; approvedDocuments: number; areas: string[]; profileReady: boolean };
type Customer = { id: string; name: string; email: string; approvalStatus: string; accountState: string; createdAt: string; bookingCount: number };
type Tab = "all" | "cleaners" | "customers" | "approved" | "rejected";
type Decision = { kind: "cleaner" | "customer"; id: string; name: string; status: "APPROVED" | "REJECTED" | "NEEDS_CHANGES" };

export function ApprovalCentre({ cleaners, customers }: { cleaners: Cleaner[]; customers: Customer[] }) {
  const router = useRouter();
  const { showToast, updateToast } = useToast();
  const [tab, setTab] = useState<Tab>("all");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const items = useMemo(() => {
    const cleanerItems = cleaners.map(item => ({ kind: "cleaner" as const, status: item.onboarding, value: item }));
    const customerItems = customers.map(item => ({ kind: "customer" as const, status: item.approvalStatus, value: item }));
    const all = [...cleanerItems, ...customerItems].sort((a, b) => new Date(b.value.createdAt).valueOf() - new Date(a.value.createdAt).valueOf());
    if (tab === "cleaners") return all.filter(item => item.kind === "cleaner" && ["SUBMITTED", "UNDER_REVIEW", "NEEDS_CHANGES"].includes(item.status));
    if (tab === "customers") return all.filter(item => item.kind === "customer" && ["PENDING", "NEEDS_CHANGES"].includes(item.status));
    if (tab === "approved") return all.filter(item => item.status === "APPROVED");
    if (tab === "rejected") return all.filter(item => item.status === "REJECTED");
    return all.filter(item => ["SUBMITTED", "UNDER_REVIEW", "PENDING", "NEEDS_CHANGES"].includes(item.status));
  }, [cleaners, customers, tab]);

  async function submit(reason: string) {
    if (!decision) return;
    setBusy(true);
    const toast = showToast("Saving approval decision...", "loading");
    const endpoint = decision.kind === "cleaner" ? `/api/cleaners/${decision.id}` : `/api/customers/${decision.id}`;
    const body = decision.kind === "cleaner" ? { onboarding: decision.status, reason } : { approvalStatus: decision.status, reason };
    const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (response.ok) {
      updateToast(toast, decision.status === "APPROVED" ? "Account approved and confirmation email queued." : "Review decision saved.", "success");
      setDecision(null);
      router.refresh();
    } else {
      const result = await response.json().catch(() => ({}));
      updateToast(toast, result.error === "customer_already_decided" || result.error === "cleaner_already_decided" ? "This application has already been decided." : "Could not save the review decision.", "error");
    }
    setBusy(false);
  }

  const tabs: { key: Tab; label: string }[] = [{ key: "all", label: "All reviews" }, { key: "cleaners", label: "Cleaner applications" }, { key: "customers", label: "Customer verification" }, { key: "approved", label: "Recently approved" }, { key: "rejected", label: "Rejected applications" }];
  const decisionTitle = decision ? `${decision.status === "APPROVED" ? "Approve" : decision.status === "REJECTED" ? "Reject" : "Request information from"} ${decision.name}` : "";

  return <section className="approval-centre"><div className="section-heading"><div><span className="eyebrow">Account governance</span><h2>Approval Centre</h2><p className="muted">Review customer registrations and cleaner applications using the existing auditable workflows.</p></div></div><div className="approval-tabs" role="tablist" aria-label="Approval Centre filters">{tabs.map(item => <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} className={tab === item.key ? "is-active" : ""} onClick={() => setTab(item.key)}>{item.label}</button>)}</div><div className="workflow-list">{items.map(item => item.kind === "cleaner" ? <CleanerRow key={`cleaner-${item.value.id}`} item={item.value} onDecide={(status) => setDecision({ kind: "cleaner", id: item.value.id, name: item.value.name, status })} /> : <CustomerRow key={`customer-${item.value.id}`} item={item.value} onDecide={(status) => setDecision({ kind: "customer", id: item.value.id, name: item.value.name, status })} />)}</div>{!items.length && <p className="muted">No records match this review filter.</p>}<ReasonDialog open={Boolean(decision)} title={decisionTitle} description="A reason is required and will be recorded in the existing audit log." confirmLabel="Save decision" busy={busy} onCancel={() => setDecision(null)} onConfirm={submit} /></section>;
}

function CleanerRow({ item, onDecide }: { item: Cleaner; onDecide: (status: Decision["status"]) => void }) {
  const pending = ["SUBMITTED", "UNDER_REVIEW", "NEEDS_CHANGES"].includes(item.onboarding);
  return <article className="workflow-row approval-row"><div><strong>{item.name}</strong><span>{item.email} · Submitted {formatApprovalDate(item.createdAt)} · {item.areas.join(", ") || "No service area recorded"}</span><small>Profile {item.profileReady ? "complete" : "incomplete"} · Documents {item.approvedDocuments}/{item.documentCount} approved · {item.onboarding.replaceAll("_", " ")} · Account {item.accountState}</small></div><div className="workflow-buttons"><Link className="button button-secondary button-small" href="/admin/cleaners">View profile</Link>{pending && <><button className="button button-primary button-small" onClick={() => onDecide("APPROVED")}>Approve</button><button className="button button-secondary button-small" onClick={() => onDecide("NEEDS_CHANGES")}>Request information</button><button className="button button-danger button-small" onClick={() => onDecide("REJECTED")}>Reject</button></>}</div></article>;
}

function CustomerRow({ item, onDecide }: { item: Customer; onDecide: (status: Decision["status"]) => void }) {
  const pending = ["PENDING", "NEEDS_CHANGES"].includes(item.approvalStatus);
  return <article className="workflow-row approval-row"><div><strong>{item.name}</strong><span>{item.email} · Registered {formatApprovalDate(item.createdAt)} · {item.bookingCount} bookings</span><small>Verification {item.approvalStatus.replaceAll("_", " ")} · Account {item.accountState} · No customer risk flags are currently recorded</small></div><div className="workflow-buttons"><Link className="button button-secondary button-small" href="/admin/customers">View customer</Link>{pending && <><button className="button button-primary button-small" onClick={() => onDecide("APPROVED")}>Approve</button><button className="button button-secondary button-small" onClick={() => onDecide("NEEDS_CHANGES")}>Request information</button><button className="button button-danger button-small" onClick={() => onDecide("REJECTED")}>Reject</button></>}</div></article>;
}

function formatApprovalDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin" }).format(new Date(value));
}
