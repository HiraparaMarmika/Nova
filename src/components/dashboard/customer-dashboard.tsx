"use client";

import Link from "next/link";
import { PortalFrame } from "@/components/portal";
import { useLocale } from "@/lib/i18n";
import { DashboardCharts } from "@/components/dashboard-charts";

type NextVisit = { startsAt: string; cleanerName: string; durationMinutes: number };
type ChartItem = { label: string; value: number };
type Props = { name: string; recurringCount: number; latestInvoiceCents: number | null; next: NextVisit | null; activity: ChartItem[]; breakdown: ChartItem[] };

export function CustomerDashboard({ name, recurringCount, latestInvoiceCents, next, activity, breakdown }: Props) {
  const { t, formatDate, formatEuro } = useLocale();
  const visitDate = next ? new Date(next.startsAt) : null;
  return <PortalFrame portal="customer">
    <div className="portal-page-head">
      <div><span className="eyebrow">Customer workspace</span><h1>Welcome, {name}</h1></div>
      <Link className="button button-primary" href="/booking">{t.customer.newBooking} ↗</Link>
    </div>
    <div className="dashboard-grid">
      <article className="card stat"><span>{t.customer.next}</span><strong>{visitDate ? formatDate(visitDate, { day: "numeric", month: "short" }) : "—"}</strong><span className="status">{visitDate ? t.customer.pending : t.customer.noNext}</span></article>
      <article className="card stat"><span>{t.customer.recurring}</span><strong>{recurringCount}</strong><small>{recurringCount ? t.customer.fortnightly : t.customer.noRecurring}</small></article>
      <article className="card stat"><span>{t.customer.invoice}</span><strong>{latestInvoiceCents === null ? "—" : formatEuro(latestInvoiceCents)}</strong><small>{t.customer.lastVisit}</small></article>
    </div>
    <DashboardCharts title="Visits over six months" series={activity} breakdown={breakdown} breakdownTitle="Visit status" />
    <section className="card table-card">
      <div className="table-head"><h2>{t.customer.request}</h2><span className="status">{t.common.demo}</span></div>
      {next && visitDate ? <div className="table-scroll"><table className="table"><thead><tr><th>{t.common.date}</th><th>{t.common.cleaner}</th><th>{t.common.service}</th><th>{t.common.status}</th></tr></thead><tbody><tr>
        <td>{formatDate(visitDate, { weekday: "short", day: "numeric", month: "short" })} · {formatDate(visitDate, { hour: "2-digit", minute: "2-digit", hour12: false })}</td>
        <td>{next.cleanerName}</td><td>{next.durationMinutes / 60} {t.common.hours}</td><td><span className="status">{t.customer.response}</span></td>
      </tr></tbody></table></div> : <p className="muted">{t.customer.noNext}</p>}
    </section>
  </PortalFrame>;
}
