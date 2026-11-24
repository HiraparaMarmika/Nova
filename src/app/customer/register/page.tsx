"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { LanguageSwitch } from "@/components/language-switch";
import { PasswordInput } from "@/components/password-input";
import { useToast } from "@/components/toast-provider";

export default function CustomerRegisterPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { showToast, updateToast } = useToast();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const toast = showToast("Creating customer account...", "loading");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/customer/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), phone: form.get("phone"), password: form.get("password") }) });
    if (!response.ok) { const message = response.status === 409 ? "A customer account already exists for this email." : "Check your name, email and password. Passwords must contain at least 12 characters."; setError(message); updateToast(toast, "Account could not be created", "error"); setBusy(false); return; }
    updateToast(toast, "Registration submitted for approval", "success", 1200);
    window.location.assign("/customer/sign-in");
  }
  return <div className="auth-page"><header className="shell auth-head"><Brand /><LanguageSwitch /></header><main className="auth-layout shell"><div className="auth-intro"><span className="eyebrow">Customer account</span><h1>Create your NOVA account.</h1><p>Your registration will be reviewed before customer-portal access is enabled. Your booking draft remains saved while you register.</p></div><section className="card auth-card"><h2>Get started</h2><form onSubmit={submit}><div className="field"><label htmlFor="customer-name">Full name</label><input id="customer-name" name="name" placeholder="For example, Alex Morgan" autoComplete="name" minLength={2} required /></div><div className="field"><label htmlFor="customer-email">Email address</label><input id="customer-email" name="email" type="email" placeholder="alex@example.com" autoComplete="email" required /></div><div className="field"><label htmlFor="customer-phone">Phone (optional)</label><input id="customer-phone" name="phone" type="tel" placeholder="For example, +49 151 23456789" autoComplete="tel" /></div><PasswordInput name="password" label="Password" minLength={12} autoComplete="new-password" placeholder="At least 12 characters" required />{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary full-button" disabled={busy}>{busy ? "Submitting..." : "Submit customer registration"}</button><p className="auth-register-link">Already registered? <Link href="/customer/sign-in">Sign in</Link></p></form></section></main></div>;
}
