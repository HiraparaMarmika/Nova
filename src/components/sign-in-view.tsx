"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "./brand";
import { LanguageSwitch } from "./language-switch";
import { useLocale } from "@/lib/i18n";
import { useToast } from "./toast-provider";
import { PasswordInput } from "./password-input";

type Portal = "customer" | "cleaner" | "admin";

export function SignInView({ portal }: { portal: Portal }) {
  const { t } = useLocale();
  const { showToast, updateToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const portalContent = portal === "admin" ? {
    label: "Admin portal",
    eyebrow: "NOVA administration",
    headline: <>Manage smarter.<br />Work better.</>,
    description: "Bring your people, spaces, and day-to-day operations together in one clear, secure workspace.",
    features: ["Secure administration", "Smart workspace management", "Simplified operations"]
  } : portal === "cleaner" ? {
    label: "Cleaner portal",
    eyebrow: "NOVA for professionals",
    headline: <>Do your best work.<br />With less admin.</>,
    description: "Keep your profile, requests, and availability organised in one focused workspace.",
    features: ["Manage your availability", "Keep work organised", "Grow with confidence"]
  } : {
    label: "Customer portal",
    eyebrow: "NOVA customer space",
    headline: <>A simpler way to<br />keep life moving.</>,
    description: "Manage your bookings and connect with trusted cleaning professionals in one place.",
    features: ["Easy booking management", "Trusted professionals", "Everything in one place"]
  };

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const toastId = showToast("Signing in...", "loading");
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal, email: values.get("email"), password: values.get("password") })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string; portal?: Portal } | null;
        if (response.status === 409 && body?.error === "wrong_portal" && body.portal) {
          const message = `This account belongs to the ${body.portal} portal. Redirecting...`;
          setError(message);
          updateToast(toastId, message, "error", 1400);
          window.setTimeout(() => window.location.assign(`/${body.portal}/sign-in`), 900);
          return;
        }
        const message = body?.error === "cleaner_pending" ? "Your application is currently under review. You will be notified once it is approved." : body?.error === "cleaner_rejected" ? "Your application has not been approved. Please contact the administration team for more information." : body?.error === "account_suspended" ? "Your account has been suspended. Please contact support for assistance." : response.status === 503 ? t.auth.demoUnavailable : response.status === 401 ? "The email or password is incorrect." : body?.error === "account_unavailable" ? "This account is not available for sign-in." : t.auth.networkError;
        setError(message);
        updateToast(toastId, message, "error");
        setBusy(false);
        return;
      }
      updateToast(toastId, "Sign-in successful", "success", 1200);
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      window.location.assign(returnTo === "/booking" && portal === "customer" ? returnTo : `/${portal}`);
    } catch {
      setError(t.auth.networkError);
      updateToast(toastId, t.auth.networkError, "error");
      setBusy(false);
    }
  }

  return <div className="auth-page admin-auth-page">
      <main className="admin-auth-layout">
        <section className="admin-brand-panel" aria-label={`NOVA ${portalContent.label.toLowerCase()}`}>
          <div className="admin-panel-orb admin-panel-orb-one" aria-hidden="true" />
          <div className="admin-panel-orb admin-panel-orb-two" aria-hidden="true" />
          <div className="admin-brand-content">
            <Brand inverted />
            <div className="admin-brand-copy">
              <span className="admin-brand-eyebrow">{portalContent.eyebrow}</span>
              <h1>{portalContent.headline}</h1>
              <p>{portalContent.description}</p>
            </div>
            <div className="admin-dashboard-art" aria-hidden="true">
              <div className="admin-art-topbar"><i /><span /><span /><span /></div>
              <div className="admin-art-body">
                <aside><i /><i /><i /><i /></aside>
                <div className="admin-art-main">
                  <div className="admin-art-title"><span /><small /></div>
                  <div className="admin-art-metrics"><div><small /><strong /></div><div><small /><strong /></div><div><small /><strong /></div></div>
                  <div className="admin-art-chart"><i /><i /><i /><i /><i /><i /><i /></div>
                </div>
              </div>
              <div className="admin-art-status"><span>✓</span><div><strong>Workspace in sync</strong><small>Everything is up to date</small></div></div>
            </div>
            <ul className="admin-feature-list">
              {portalContent.features.map(feature => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}
            </ul>
          </div>
        </section>
        <section className="admin-auth-area">
          <div className="admin-auth-top"><LanguageSwitch /></div>
          <div className="admin-sign-in-card">
            <span className="admin-form-label">{portalContent.label}</span>
            <h2>Welcome back</h2>
            <p className="admin-form-subtitle">Sign in to continue to your workspace.</p>
            <form onSubmit={signIn}>
              <div className="field"><label htmlFor="email">{t.common.email}</label><input id="email" name="email" type="email" autoComplete="username" placeholder={t.auth.emailPlaceholder} required /></div>
              <PasswordInput id="password" name="password" label={t.common.password} autoComplete="current-password" placeholder="Enter your password" required />
              <p className="admin-demo-note"><span aria-hidden="true">i</span>{t.auth.demoHint}</p>
              {error && <p className="error" role="alert">{error}</p>}
              <button className="button button-primary full-button" type="submit" disabled={busy}>{busy ? t.auth.signingIn : t.auth.openDemo}<span aria-hidden="true">→</span></button>
              {portal === "cleaner" && <p className="auth-register-link">New to NOVA? <Link href="/cleaner/register">Apply as a cleaner</Link></p>}
              {portal === "customer" && <p className="auth-register-link">New to NOVA? <Link href="/customer/register">Create a customer account</Link></p>}
            </form>
          </div>
          <p className="admin-auth-footer">© {new Date().getFullYear()} NOVA · Secure administration platform</p>
        </section>
      </main>
    </div>;
}
