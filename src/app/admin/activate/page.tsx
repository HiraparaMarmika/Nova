"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { PasswordInput } from "@/components/password-input";
import { useToast } from "@/components/toast-provider";

export default function AdminActivatePage() {
  const { showToast, updateToast } = useToast(); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const values = new FormData(event.currentTarget);
    if (values.get("password") !== values.get("confirm")) { setError("Passwords do not match."); setBusy(false); return; }
    const token = new URLSearchParams(window.location.search).get("token"); const toast = showToast("Activating admin account...", "loading");
    const response = await fetch("/api/admin/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: values.get("password") }) });
    if (response.ok) { updateToast(toast, "Admin account activated", "success"); setDone(true); }
    else { setError("This invitation is invalid or expired. Request a new invitation from an administrator."); updateToast(toast, "Account could not be activated", "error"); }
    setBusy(false);
  }
  return <div className="auth-page"><header className="shell auth-head"><Brand /></header><main className="auth-layout shell"><div className="auth-intro"><span className="eyebrow">Administration</span><h1>Accept your invitation.</h1><p>Create a password for your role-scoped administrator account.</p></div><section className="card auth-card">{done ? <><h2>Account activated</h2><p>Your administrator account is ready to use.</p><Link className="button button-primary full-button" href="/admin/sign-in">Continue to sign in</Link></> : <form onSubmit={submit}><h2>Set administrator password</h2><PasswordInput name="password" label="Password" placeholder="At least 12 characters" autoComplete="new-password" minLength={12} required /><PasswordInput name="confirm" label="Confirm password" placeholder="Enter the same password again" autoComplete="new-password" minLength={12} required />{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary full-button" disabled={busy}>{busy ? "Activating..." : "Activate account"}</button></form>}</section></main></div>;
}
