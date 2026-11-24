"use client";

import Link from "next/link";
import { PortalFrame } from "@/components/portal";
import { useLocale } from "@/lib/i18n";
import { DashboardCharts } from "@/components/dashboard-charts";

type ChartItem = { label: string; value: number };
type Props = { queue: { id: string; name: string }[]; activeBookings: number; accountCount: number; capturedCents?: number; openDisputes?: number; activity: ChartItem[]; breakdown: ChartItem[] };
export function AdminDashboard({ queue, activeBookings, accountCount, capturedCents = 0, openDisputes = 0, activity, breakdown }: Props) {
  const { t, formatEuro } = useLocale();
  return <PortalFrame portal="admin"><div className="portal-page-head"><div><span className="eyebrow">Operations control centre</span><h1>{t.admin.title}</h1></div><Link className="button button-secondary" href="/admin/users">Manage users</Link></div><div className="dashboard-grid"><article className="card stat"><span>Cleaner applications</span><strong>{queue.length}</strong><span className="status">Needs review</span></article><article className="card stat"><span>Active bookings</span><strong>{activeBookings}</strong><small>Live workflow</small></article><article className="card stat"><span>Platform accounts</span><strong>{accountCount}</strong><small>All portal roles</small></article><article className="card stat"><span>Captured volume</span><strong>{formatEuro(capturedCents)}</strong><small>Database payments</small></article><article className="card stat"><span>Open disputes</span><strong>{openDisputes}</strong><small>Needs resolution</small></article></div><DashboardCharts title="Bookings over six months" series={activity} breakdown={breakdown} breakdownTitle="Booking status" /><section className="card table-card"><div className="table-head"><h2>Cleaner verification queue</h2><Link href="/admin/review-queue">Open full queue</Link></div>{queue.length ? <div className="table-scroll"><table className="table"><thead><tr><th>Profile</th><th>Status</th><th>Decision</th></tr></thead><tbody>{queue.map(cleaner => <tr key={cleaner.id}><td>{cleaner.name}</td><td><span className="status">Submitted</span></td><td><Link className="button button-secondary button-small" href="/admin/review-queue">Review application</Link></td></tr>)}</tbody></table></div> : <p className="muted">No cleaner applications are waiting.</p>}</section><p className="notice">Every admin decision requires a reason and is written to the audit log.</p></PortalFrame>;
}
