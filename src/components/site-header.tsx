"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";
import { LanguageSwitch } from "./language-switch";
import { useLocale } from "@/lib/i18n";

export function SiteHeader() {
  const { locale } = useLocale();
  const pathname = usePathname();
  const [loginOpen, setLoginOpen] = useState(false);
  const [activeHash, setActiveHash] = useState("");

  useEffect(() => {
    const syncHash = () => setActiveHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  const labels = locale === "de"
    ? { services: "Leistungen", how: "So funktioniertâ€™s", trust: "Warum NOVA", faq: "Fragen", login: "Anmelden", choose: "Anmelden als", customer: "Kunde", cleaner: "Reinigungskraft", admin: "Administration", cta: "VerfÃ¼gbarkeit anfragen" }
    : { services: "Services", how: "How it works", trust: "Why NOVA", faq: "FAQs", login: "Sign in", choose: "Choose sign in", customer: "Customer", cleaner: "Cleaner", admin: "Administrator", cta: "Check availability" };
  const navItems = [["#services", labels.services], ["#how", labels.how], ["#why-nova", labels.trust], ["#faq", labels.faq]] as const;

  return <header className="site-header"><div className="shell top"><Brand /><nav className="nav" aria-label="Main navigation">{navItems.map(([hash, label]) => { const href = pathname === "/" ? hash : `/${hash}`; const active = pathname === "/" && activeHash === hash; return <Link className={`nav-text${active ? " active" : ""}`} href={href} key={hash} onClick={() => setActiveHash(hash)} aria-current={active ? "location" : undefined}>{label}</Link>; })}</nav><div className="header-actions"><LanguageSwitch /><div className="login-menu"><button className="sign-in-link login-menu-trigger" type="button" onClick={() => setLoginOpen(open => !open)} aria-expanded={loginOpen} aria-haspopup="menu">{labels.login}</button>{loginOpen && <div className="login-menu-list" role="menu"><div className="login-menu-title">{labels.choose}</div><Link href="/customer/sign-in" role="menuitem" onClick={() => setLoginOpen(false)}><i>C</i><div><strong>{labels.customer}</strong><span>{locale === "de" ? "Konto verwalten" : "Manage your account"}</span></div></Link><Link href="/cleaner/sign-in" role="menuitem" onClick={() => setLoginOpen(false)}><i>CL</i><div><strong>{labels.cleaner}</strong><span>{locale === "de" ? "Profil verwalten" : "Manage your profile"}</span></div></Link><Link href="/admin/sign-in" role="menuitem" onClick={() => setLoginOpen(false)}><i>A</i><div><strong>{labels.admin}</strong><span>{locale === "de" ? "Betrieb verwalten" : "Manage operations"}</span></div></Link></div>}</div><Link className="button button-primary header-cta" href="#enquiry">{labels.cta}<span aria-hidden="true">→</span></Link></div></div></header>;
}
