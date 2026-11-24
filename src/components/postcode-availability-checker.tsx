"use client";

import { FormEvent, useState } from "react";
import { useLocale } from "@/lib/i18n";

const messages = {
  available: "Great news! Cleaning services are available in your area.",
  unavailable: "Sorry! We don't currently provide cleaning services in your area.",
  invalid: "Please enter a valid postal code.",
  failed: "Unable to check availability right now. Please try again.",
};

export function PostcodeAvailabilityChecker() {
  const { t } = useLocale();
  const [postcode, setPostcode] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function checkAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = postcode.trim();
    if (!/^\d{5}$/.test(value)) {
      setState("error");
      setMessage(messages.invalid);
      return;
    }
    setState("loading");
    setMessage("");
    try {
      const response = await fetch(`/api/availability?check=coverage&postcode=${encodeURIComponent(value)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("availability_check_failed");
      const result = await response.json() as { available?: boolean };
      setState(result.available ? "success" : "error");
      setMessage(result.available ? messages.available : messages.unavailable);
    } catch {
      setState("error");
      setMessage(messages.failed);
    }
  }

  return <form className="searchbox" onSubmit={checkAvailability}>
    <div className="searchbox-top"><span className="search-icon" aria-hidden="true">⌖</span><strong>{t.home.searchTitle}</strong></div>
    <div className="inputrow"><label className="sr-only" htmlFor="home-postcode">{t.home.postcode}</label><input id="home-postcode" value={postcode} onChange={event => { setPostcode(event.target.value.replace(/\D/g, "").slice(0, 5)); if (state !== "idle") { setState("idle"); setMessage(""); } }} inputMode="numeric" maxLength={5} placeholder={t.home.postcodePlaceholder} aria-invalid={state === "error" && message === messages.invalid} /><button className="button button-primary" type="submit" disabled={state === "loading"}>{state === "loading" ? "Checking..." : t.home.check}<span aria-hidden="true">→</span></button></div>
    <small>{t.home.coverage}</small>
    {state === "loading" && <p className="availability-message availability-loading" role="status">Checking availability...</p>}
    {message && <p className={`availability-message availability-${state}`} role="status" aria-live="polite">{message}</p>}
  </form>;
}
