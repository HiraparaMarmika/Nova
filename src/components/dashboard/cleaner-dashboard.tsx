"use client";

import { useRouter } from "next/navigation";
import { PortalFrame } from "@/components/portal";
import { useLocale } from "@/lib/i18n";
import { useToast } from "@/components/toast-provider";
import { DashboardCharts } from "@/components/dashboard-charts";

type NextRequest = { id: string; startsAt: string; postcode: string; durationMinutes: number };
type ChartItem = { label: string; value: number };
type Props = { name: string; onboarding: string; accountState: string; upcomingCount: number; requestCount: number; earningsCents: number; next: NextRequest | null; activity: ChartItem[]; breakdown: ChartItem[] };

export function CleanerDashboard({ name, onboarding, accountState, upcomingCount, requestCount, earningsCents, next, activity, breakdown }: Props) {
  const { t, formatDate, formatEuro } = useLocale();
  const router = useRouter();
  const { showToast, updateToast } = useToast();
  const visitDate = next ? new Date(next.startsAt) : null;
  async function updateRequest(status: "ACCEPTED" | "DECLINED") {
    if (!next) return;
    const toastId = showToast(status === "ACCEPTED" ? "Accepting request..." : "Declining request...", "loading");
    const response = await fetch(`/api/occurrences/${next.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) { updateToast(toastId, "Could not update request", "error"); return; }
    updateToast(toastId, "Request updated", "success"); router.refresh();
  }
  return <PortalFrame portal="cleaner">
    <div className="portal-page-head"><div><span className="eyebrow">Cleaner workspace</span><h1>Welcome, {name}</h1></div><span className="status">{onboarding.replaceAll("_", " ")}</span></div>
    {(onboarding !== "APPROVED" || accountState !== "ACTIVE") && <p className="notice">Your account is {accountState.toLowerCase()} and onboarding is {onboarding.toLowerCase().replaceAll("_", " ")}. You cannot receive new requests until an administrator approves the application.</p>}
    <div className="dashboard-grid">
      <article className="card stat"><span>{t.cleanerPortal.requests}</span><strong>{requestCount}</strong><span className="status">{t.cleanerPortal.today}</span></article>
      <article className="card stat"><span>{t.cleanerPortal.next}</span><strong>{visitDate ? formatDate(visitDate, { hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}</strong><small>{visitDate ? formatDate(visitDate, { day: "numeric", month: "short" }) : t.cleanerPortal.noRequests}</small></article>
      <article className="card stat"><span>{t.cleanerPortal.earnings}</span><strong>{formatEuro(earningsCents)}</strong><small>{t.cleanerPortal.testMode}</small></article>
      <article className="card stat"><span>Upcoming jobs</span><strong>{upcomingCount}</strong><small>Accepted and scheduled</small></article>
    </div>
    <DashboardCharts title="Jobs over six months" series={activity} breakdown={breakdown} breakdownTitle="Job status" />
    <section className="card table-card">
      <div className="table-head"><h2>{t.cleanerPortal.request}</h2><span className="status">{t.common.demo}</span></div>
      {next && visitDate ? <div className="table-scroll"><table className="table"><thead><tr><th>{t.cleanerPortal.when}</th><th>{t.cleanerPortal.area}</th><th>{t.cleanerPortal.earnings}</th><th>{t.cleanerPortal.action}</th></tr></thead><tbody><tr>
        <td>{formatDate(visitDate, { day: "numeric", month: "short" })} · {formatDate(visitDate, { hour: "2-digit", minute: "2-digit", hour12: false })}</td>
        <td>{next.postcode} · {next.durationMinutes / 60} {t.common.hourShort}</td>
        <td>{t.cleanerPortal.pendingPrice}</td>
        <td><div className="table-actions"><button className="button button-primary button-small" disabled={onboarding !== "APPROVED" || accountState !== "ACTIVE"} onClick={() => updateRequest("ACCEPTED")}>{t.cleanerPortal.accept}</button><button className="button button-secondary button-small" disabled={onboarding !== "APPROVED" || accountState !== "ACTIVE"} onClick={() => updateRequest("DECLINED")}>{t.cleanerPortal.decline}</button></div></td>
      </tr></tbody></table></div> : <p className="muted">{t.cleanerPortal.noRequests}</p>}
    </section>
  </PortalFrame>;
}
