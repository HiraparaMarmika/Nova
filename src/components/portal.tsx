"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";
import { LanguageSwitch } from "./language-switch";
import { useLocale } from "@/lib/i18n";
import { getAdminCopy } from "@/lib/admin-copy";

type Portal = "customer" | "cleaner" | "admin";
const routes: Record<Portal, string[]> = {
  customer: ["/customer", "/customer/appointments", "/customer/recurring", "/customer/invoices", "/customer/notifications", "/customer/profile"],
  cleaner: ["/cleaner", "/cleaner/requests", "/cleaner/calendar", "/cleaner/earnings", "/cleaner/reviews", "/cleaner/notifications", "/cleaner/profile"],
  admin: ["/admin", "/admin/users", "/admin/review-queue", "/admin/customers", "/admin/cleaners", "/admin/bookings", "/admin/payments", "/admin/disputes", "/admin/reconciliation", "/admin/risk", "/admin/waitlist", "/admin/notifications", "/admin/configuration", "/admin/audit-log"],
};
export function PortalFrame({ portal, children }: { portal: Portal; children: React.ReactNode }) {
  const { t, locale } = useLocale(); const pathname = usePathname(); const labels: string[] = portal === "customer" ? ["Overview", "Appointments", "Recurring", "Invoices", "Notifications", "Profile"] : portal === "cleaner" ? ["Overview", "Requests", "Calendar", "Earnings", "Reviews", "Notifications", "Profile & documents"] : getAdminCopy(locale).nav; const title = t.portal[portal];
  const icons = portal === "admin" ? ["⌂", "◎", "✓", "C", "P", "▤", "€", "!", "≈", "⚑", "+", "•", "⚙", "≡"] : portal === "cleaner" ? ["⌂", "↗", "□", "€", "★", "•", "○"] : ["⌂", "□", "↻", "€", "•", "○"];
  return <div className={`portal portal-${portal}`}><header className="portal-head"><div className="shell portal-top"><Brand /><div className="portal-head-right"><span className="portal-workspace"><i />Live workspace</span><span className="portal-label">{title}<span className="demo-dot"> · {t.portal.session}</span></span><LanguageSwitch /></div></div></header><div className="shell portal-main"><aside className="sidebar" aria-label={t.portal.navigation}><div className="sidebar-label"><span>{portal.slice(0, 1).toUpperCase()}</span><div><strong>{title}</strong><small>Workspace</small></div></div>{labels.map((label, index) => <Link className={pathname === routes[portal][index] ? "current" : ""} key={routes[portal][index]} href={routes[portal][index]}><i aria-hidden="true">{icons[index]}</i><span>{label}</span></Link>)}<form className="sidebar-logout" action="/api/auth/logout" method="post"><button className="sidebar-exit" type="submit"><i aria-hidden="true">↪</i><span>{t.common.signOut}</span></button></form></aside><main id="content" className="portal-content">{children}</main></div></div>;
}
