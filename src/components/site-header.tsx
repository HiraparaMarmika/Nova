"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "./brand";
import { LanguageSwitch } from "./language-switch";
import { useLocale } from "@/lib/i18n";

export function SiteHeader() {
  const { locale } = useLocale(); const [loginOpen, setLoginOpen] = useState(false);
  const labels = locale === "de" ? { services: "Leistungen", how: "So funktioniert’s", trust: "Warum NOVA", faq: "Fragen", login: "Anmelden", choose: "Anmelden als", customer: "Kunde", cleaner: "Reinigungskraft", admin: "Administration", cta: "Verfügbarkeit anfragen" } : { services: "Services", how: "How it works", trust: "Why NOVA", faq: "FAQs", login: "Sign in", choose: "Choose sign in", customer: "Customer", cleaner: "Cleaner", admin: "Administrator", cta: "Check availability" };
  return <header className="site-header"><div className="shell top"><Brand /><nav className="nav" aria-label="Main navigation"><Link className="nav-text" href="#services">{labels.services}</Link><Link className="nav-text" href="#how">{labels.how}</Link><Link className="nav-text" href="#why-nova">{labels.trust}</Link><Link className="nav-text" href="#faq">{labels.faq}</Link></nav><div className="header-actions"><LanguageSwitch /><div className="login-menu"><button className="sign-in-link login-menu-trigger" type="button" onClick={() => setLoginOpen(open => !open)} aria-expanded={loginOpen} aria-haspopup="menu">{labels.login}</button>{loginOpen && <div className="login-menu-list" role="menu"><div className="login-menu-title">{labels.choose}</div><Link href="/customer/sign-in" role="menuitem" onClick={() => setLoginOpen(false)}><i>C</i><div><strong>{labels.customer}</strong><span>{locale === "de" ? "Konto verwalten" : "Manage your account"}</span></div></Link><Link href="/cleaner/sign-in" role="menuitem" onClick={() => setLoginOpen(false)}><i>CL</i><div><strong>{labels.cleaner}</strong><span>{locale === "de" ? "Profil verwalten" : "Manage your profile"}</span></div></Link><Link href="/admin/sign-in" role="menuitem" onClick={() => setLoginOpen(false)}><i>A</i><div><strong>{labels.admin}</strong><span>{locale === "de" ? "Betrieb verwalten" : "Manage operations"}</span></div></Link></div>}</div><Link className="button button-primary header-cta" href="#enquiry">{labels.cta}<span aria-hidden="true">→</span></Link></div></div></header>;
}
