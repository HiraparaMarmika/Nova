import { AccountType, BookingStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { DataTable, type DataColumn, type DataRow } from "@/components/data-table";
import { PortalFrame } from "@/components/portal";
import { AdminDisputeActions } from "@/components/workflow-actions";
import { NotificationList } from "@/components/notification-list";
import { AdminDocumentReview } from "@/components/document-manager";
import { AdminConfigurationForm, CleanerApprovalList } from "@/components/admin-operations";
import { WaitlistActions } from "@/components/waitlist-actions";
import { getAdminCopy } from "@/lib/admin-copy";
import { requirePortal } from "@/lib/demo-session";
import { prisma } from "@/lib/db";

type OperationsConfig = { requestExpiryHours: number; complaintWindowHours: number; cancellationNoticeHours: number; lateCancellationFeeBps: number; recurringHorizonCount: number };
const defaultConfig: OperationsConfig = { requestExpiryHours: 24, complaintWindowHours: 48, cancellationNoticeHours: 24, lateCancellationFeeBps: 2500, recurringHorizonCount: 8 };
function configValue(value: unknown): OperationsConfig { return !value || typeof value !== "object" ? defaultConfig : { ...defaultConfig, ...(value as Partial<OperationsConfig>) }; }
function statusLabel(value: string, locale: "en" | "de") {
  const german: Record<string, string> = { ACTIVE: "Aktiv", RESTRICTED: "Eingeschränkt", SUSPENDED: "Gesperrt", INVITED: "Eingeladen", SUBMITTED: "Eingereicht", UNDER_REVIEW: "In Prüfung", NEEDS_CHANGES: "Änderungen erforderlich", APPROVED: "Freigegeben", REJECTED: "Abgelehnt", REQUESTED: "Angefragt", ACCEPTED: "Angenommen", SCHEDULED: "Geplant", IN_PROGRESS: "In Arbeit", COMPLETED: "Abgeschlossen", CANCELLED_BY_CUSTOMER: "Vom Kunden storniert", CANCELLED_BY_CLEANER: "Von der Reinigungskraft storniert", CANCELLED_BY_ADMIN: "Von der Administration storniert", NO_SHOW: "Nicht erschienen", DISPUTED: "Konflikt", RESOLVED: "Gelöst", WAITING: "Wartend", CONTACTED: "Kontaktiert", CLOSED: "Geschlossen" };
  return locale === "de" ? german[value] ?? value.replaceAll("_", " ") : value.replaceAll("_", " ");
}

export default async function AdminSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const session = await requirePortal(AccountType.ADMIN);
  const locale = (await cookies()).get("nova-locale")?.value === "de" ? "de" : "en";
  const copy = getAdminCopy(locale);
  const dateLocale = locale === "de" ? "de-DE" : "en-GB";
  const [bookings, payments, audits, reviewCleaners, allCleaners, customers, complaints, occurrences, waitlist, documents, notifications, latestConfig] = await Promise.all([
    prisma.booking.findMany({ include: { customer: true, cleaner: true }, orderBy: { createdAt: "desc" } }),
    prisma.payment.findMany({ include: { refunds: true, occurrence: { include: { financial: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.cleaner.findMany({ where: { onboarding: { in: ["SUBMITTED", "UNDER_REVIEW", "NEEDS_CHANGES"] } }, include: { account: true, documents: true }, orderBy: { createdAt: "asc" } }),
    prisma.cleaner.findMany({ include: { account: true, areas: true, documents: true }, orderBy: { createdAt: "desc" } }),
    prisma.customer.findMany({ include: { account: true, _count: { select: { bookings: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.complaint.findMany({ include: { occurrence: { include: { booking: { include: { customer: true, cleaner: true } } } } }, orderBy: { openedAt: "desc" } }),
    prisma.occurrence.findMany({ include: { booking: { include: { customer: true, cleaner: true } }, financial: true, payment: true, invoice: true, payout: true }, orderBy: { startsAt: "desc" } }),
    prisma.waitlistEntry.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.document.findMany({ include: { cleaner: true }, orderBy: { createdAt: "desc" } }),
    prisma.notification.findMany({ where: { accountId: session.accountId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.appConfig.findFirst({ where: { key: "operations" }, orderBy: { version: "desc" } }),
  ]);
  const page = copy.pages[section] ?? { title: locale === "de" ? "Administration" : "Administration", description: copy.labels.noRecords };
  const head = (children: React.ReactNode) => <PortalFrame portal="admin"><PageHead title={page.title} description={page.description} eyebrow={copy.eyebrow.database} />{children}</PortalFrame>;

  if (section === "review-queue") return head(<><section className="card workflow-card"><CleanerApprovalList cleaners={reviewCleaners.map(item => ({ id: item.id, name: item.name, email: item.account.email, status: item.onboarding, documentCount: item.documents.length }))} /></section><section className="card workflow-card"><div className="section-heading"><div><span className="eyebrow">{copy.eyebrow.documentReview}</span><h2>{copy.messages.verificationFiles}</h2></div></div><AdminDocumentReview documents={documents.map(item => ({ id: item.id, kind: item.kind, status: item.status, originalName: item.originalName, createdAt: item.createdAt.toISOString(), cleanerName: item.cleaner.name }))} /></section></>);
  if (section === "notifications") return head(<section className="card table-card"><NotificationList items={notifications.map(item => ({ ...item, readAt: item.readAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString() }))} /></section>);
  if (section === "configuration") return head(<AdminConfigurationForm initial={configValue(latestConfig?.value)} version={latestConfig?.version ?? 0} />);
  if (section === "waitlist") return head(<section className="card workflow-card"><WaitlistActions entries={waitlist.map(item => ({ ...item, createdAt: item.createdAt.toISOString() }))} /></section>);

  let columns: DataColumn[]; let rows: DataRow[];
  if (section === "customers") { columns = [{ key: "name", label: copy.labels.customer }, { key: "email", label: copy.labels.email }, { key: "state", label: copy.labels.state }, { key: "bookings", label: copy.labels.bookings }]; rows = customers.map(item => ({ id: item.id, name: item.name, email: item.account.email, state: item.account.state, bookings: item._count.bookings })); }
  else if (section === "cleaners") { columns = [{ key: "name", label: copy.labels.cleaner }, { key: "state", label: copy.labels.account }, { key: "status", label: copy.labels.onboarding }, { key: "areas", label: copy.labels.areas }, { key: "rate", label: copy.labels.rate }, { key: "documents", label: copy.labels.documents }]; rows = allCleaners.map(item => ({ id: item.id, name: item.name, state: item.account.state, status: item.onboarding, areas: item.areas.map(area => area.postcodePrefix).join(", ") || "-", rate: `€${(item.hourlyRateCents / 100).toFixed(2)}`, documents: item.documents.length })); }
  else if (section === "payments") { columns = [{ key: "reference", label: copy.labels.reference }, { key: "provider", label: copy.labels.provider }, { key: "status", label: copy.labels.status }, { key: "authorized", label: copy.labels.authorized }, { key: "captured", label: copy.labels.captured }, { key: "refunded", label: copy.labels.refunded }]; rows = payments.map(item => ({ id: item.id, reference: item.providerReference ?? item.id, provider: item.provider, status: item.status, authorized: `€${(item.authorizedCents / 100).toFixed(2)}`, captured: `€${(item.capturedCents / 100).toFixed(2)}`, refunded: `€${(item.refunds.reduce((total, refund) => total + refund.amountCents, 0) / 100).toFixed(2)}` })); }
  else if (section === "audit-log") { columns = [{ key: "action", label: copy.labels.action }, { key: "target", label: copy.labels.target }, { key: "reason", label: copy.labels.reason }, { key: "date", label: copy.labels.date }]; rows = audits.map(item => ({ id: item.id, action: item.action, target: item.targetType, reason: item.reason, date: item.createdAt.toLocaleString(dateLocale) })); }
  else if (section === "disputes") { columns = [{ key: "customer", label: copy.labels.customer }, { key: "cleaner", label: copy.labels.cleaner }, { key: "reason", label: copy.labels.reason }, { key: "status", label: copy.labels.status }, { key: "opened", label: copy.labels.opened }]; rows = complaints.map(item => ({ id: item.id, customer: item.occurrence.booking.customer.name, cleaner: item.occurrence.booking.cleaner?.name ?? "—", reason: item.reason, status: item.status, opened: item.openedAt.toLocaleString(dateLocale) })); }
  else if (section === "reconciliation") { columns = [{ key: "visit", label: copy.labels.visit }, { key: "gross", label: copy.labels.snapshot }, { key: "captured", label: copy.labels.captured }, { key: "difference", label: copy.labels.difference }, { key: "invoice", label: copy.labels.invoice }, { key: "payout", label: copy.labels.payout }]; rows = occurrences.filter(item => item.financial).map(item => { const gross = item.financial?.grossCents ?? 0; const captured = item.payment?.capturedCents ?? 0; return { id: item.id, visit: item.startsAt.toLocaleDateString(dateLocale), gross: `€${(gross / 100).toFixed(2)}`, captured: `€${(captured / 100).toFixed(2)}`, difference: `€${((captured - gross) / 100).toFixed(2)}`, invoice: item.invoice?.number ?? "—", payout: item.payout?.status ?? "—" }; }); }
  else if (section === "risk") { const riskStatuses: BookingStatus[] = [BookingStatus.CANCELLED_BY_CUSTOMER, BookingStatus.CANCELLED_BY_CLEANER, BookingStatus.CANCELLED_BY_ADMIN, BookingStatus.NO_SHOW, BookingStatus.DISPUTED]; const flagged = occurrences.filter(item => riskStatuses.includes(item.status)); columns = [{ key: "customer", label: copy.labels.customer }, { key: "cleaner", label: copy.labels.cleaner }, { key: "postcode", label: copy.labels.postcode }, { key: "status", label: copy.labels.flag }, { key: "date", label: copy.labels.visit }]; rows = flagged.map(item => ({ id: item.id, customer: item.booking.customer.name, cleaner: item.booking.cleaner?.name ?? "—", postcode: item.booking.postcode, status: item.status, date: item.startsAt.toLocaleString(dateLocale) })); }
  else { columns = [{ key: "customer", label: copy.labels.customer }, { key: "cleaner", label: copy.labels.cleaner }, { key: "postcode", label: copy.labels.postcode }, { key: "status", label: copy.labels.status }, { key: "created", label: copy.labels.created }]; rows = bookings.map(item => ({ id: item.id, customer: item.customer.name, cleaner: item.cleaner?.name ?? "—", postcode: item.postcode, status: item.status, created: item.createdAt.toLocaleDateString(dateLocale) })); }
  const disputeActions = complaints.map(item => ({ id: item.id, reason: item.reason, status: item.status, openedAt: item.openedAt.toISOString(), resolution: item.resolution }));
  return head(<><section className="card table-card"><DataTable columns={columns} rows={rows} filterKey={columns.some(column => ["status", "state"].includes(column.key)) ? columns.find(column => ["status", "state"].includes(column.key))?.key : columns[0].key} emptyMessage={copy.labels.noRecords} /></section>{section === "disputes" && disputeActions.length > 0 && <section className="card workflow-card"><div className="section-heading"><div><span className="eyebrow">{copy.eyebrow.caseManagement}</span><h2>{copy.actions.actions ?? copy.labels.actions}</h2></div></div><AdminDisputeActions complaints={disputeActions} /></section>}</>);
}

function PageHead({ title, description, eyebrow }: { title: string; description: string; eyebrow: string }) { return <div className="portal-page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="muted">{description}</p></div></div>; }
