"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { LanguageSwitch } from "@/components/language-switch";
import { useLocale } from "@/lib/i18n";
import { useToast } from "@/components/toast-provider";

type CleanerProfile = { id: string; name: string; rate: number; areas: string[]; rating: string | null };
type AvailableSlot = { time: string; startsAt: string; cleanerIds: string[] };

export default function Booking() {
  const { t, formatEuro } = useLocale();
  const { showToast, updateToast } = useToast();
  const router = useRouter();
  const initialDate = new Date(); initialDate.setDate(initialDate.getDate() + 1);
  const initialDateValue = `${initialDate.getFullYear()}-${String(initialDate.getMonth() + 1).padStart(2, "0")}-${String(initialDate.getDate()).padStart(2, "0")}`;
  const [step, setStep] = useState(0);
  const [postcode, setPostcode] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [recurrenceWeeks, setRecurrenceWeeks] = useState(1);
  const [consent, setConsent] = useState(false);
  const [demoPaymentConfirmed, setDemoPaymentConfirmed] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [duration, setDuration] = useState(3);
  const [extra, setExtra] = useState("none");
  const [date, setDate] = useState(initialDateValue);
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [profiles, setProfiles] = useState<CleanerProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [bookingError, setBookingError] = useState("");
  useEffect(() => { const fromUrl = new URLSearchParams(window.location.search).get("postcode"); const saved = window.localStorage.getItem("nova-booking-draft"); if (saved) { try { const draft = JSON.parse(saved); setPostcode(draft.postcode ?? ""); setDate(draft.date ?? initialDateValue); setTime(draft.time ?? ""); setDuration(draft.duration ?? 3); setExtra(draft.extra ?? "none"); setRecurring(Boolean(draft.recurring)); setRecurrenceWeeks(draft.recurrenceWeeks ?? 1); setConsent(Boolean(draft.consent)); setSelected(draft.selected ?? null); } catch {} } if (fromUrl) setPostcode(fromUrl.slice(0, 5)); setDraftLoaded(true); fetch("/api/auth/session", { cache: "no-store" }).then(response => response.json()).then(result => setAuthenticated(Boolean(result.authenticated))).catch(() => setAuthenticated(false)); }, [initialDateValue]);
  useEffect(() => { if (!draftLoaded) return; window.localStorage.setItem("nova-booking-draft", JSON.stringify({ postcode, date, time, duration, extra, recurring, recurrenceWeeks, consent, selected })); }, [draftLoaded, postcode, date, time, duration, extra, recurring, recurrenceWeeks, consent, selected]);
  const validPostcode = /^\d{5}$/.test(postcode);
  const supported = validPostcode;
  useEffect(() => {
    const controller = new AbortController();
    if (!validPostcode || !date) { setAvailableSlots([]); setTime(""); return; }
    setSlotsLoading(true);
    fetch(`/api/availability?${new URLSearchParams({ postcode, date, durationMinutes: String(duration * 60) })}`, { signal: controller.signal, cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("availability_failed")))
      .then(({ slots }: { slots: AvailableSlot[] }) => { setAvailableSlots(slots); setTime(current => slots.some(slot => slot.time === current) ? current : slots[0]?.time ?? ""); setSelected(null); })
      .catch(error => { if (error.name !== "AbortError") { setAvailableSlots([]); setTime(""); } })
      .finally(() => { if (!controller.signal.aborted) setSlotsLoading(false); });
    return () => controller.abort();
  }, [postcode, validPostcode, date, duration]);
  useEffect(() => {
    const controller = new AbortController();
    const slot = availableSlots.find(item => item.time === time);
    if (!validPostcode || !slot || step < 2) { setProfiles([]); setProfilesLoading(false); return; }
    const query = `?${new URLSearchParams({ postcode, startsAt: slot.startsAt, durationMinutes: String(duration * 60), recurrenceWeeks: recurring ? String(recurrenceWeeks) : "" })}`;
    setProfilesLoading(true);
    fetch(`/api/cleaners${query}`, { signal: controller.signal, cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Could not load cleaners")))
      .then(({ profiles: result }: { profiles: CleanerProfile[] }) => { setProfiles(result); setSelected(current => current && result.some(profile => profile.id === current) ? current : null); })
      .catch(error => { if (error.name !== "AbortError") setProfiles([]); })
      .finally(() => { if (!controller.signal.aborted) setProfilesLoading(false); });
    return () => controller.abort();
  }, [postcode, validPostcode, time, duration, step, availableSlots, recurring, recurrenceWeeks]);
  const minDate = initialDateValue;
  const canAdvance = step === 0 ? validPostcode && supported && Boolean(time) : step === 1 ? !recurring || consent : step === 2 ? selected !== null : true;
  async function createBooking() {
    if (!selected) return;
    setBookingError("");
    if (!authenticated) { setBookingError("Sign in or create a customer account to confirm this booking. Your selections are saved."); return; }
    setSubmitting(true);
    const toastId = showToast("Creating your booking...", "loading");
    try {
      const startsAt = availableSlots.find(slot => slot.time === time)?.startsAt;
      if (!startsAt) throw new Error("Please select an available time slot.");
      const response = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cleanerId: selected, postcode, startsAt, durationMinutes: duration * 60, extras: extra === "none" ? [] : [extra], recurrenceWeeks: recurring ? recurrenceWeeks : null, consent }) });
      if (response.status === 401) { setAuthenticated(false); throw new Error("Your session expired. Sign in again to complete the booking."); }
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error === "slot_unavailable" ? "That slot was just taken. Choose another available time." : "Booking could not be created. Please review the details and try again."); }
      window.localStorage.removeItem("nova-booking-draft");
      updateToast(toastId, "Booking request created", "success", 1200);
      router.push("/customer"); router.refresh();
    } catch (error) { const message = error instanceof Error ? error.message : "Booking could not be created"; setBookingError(message); updateToast(toastId, message, "error"); setSubmitting(false); }
  }
  async function joinWaitlist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWaitlistBusy(true); const toastId = showToast("Joining the waitlist...", "loading");
    const response = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: waitlistEmail, postcode }) });
    if (response.ok) { updateToast(toastId, "You are on the waitlist", "success"); setWaitlistEmail(""); }
    else updateToast(toastId, "Could not join the waitlist", "error");
    setWaitlistBusy(false);
  }
  return <div className="booking-page"><header className="booking-header shell"><Brand /><div className="booking-header-right"><LanguageSwitch /><Link href="/" className="text-link">{t.common.cancel} &times;</Link></div></header>
    <main className="shell booking-layout"><div className="booking-main"><div className="booking-intro"><span className="eyebrow"><span className="eyebrow-line" />{t.booking.eyebrow}</span><h1>{t.booking.steps[step]}</h1><p className="muted">{t.booking.stepOf.replace("{step}", String(step + 1))}</p></div><div className="steps" aria-label={t.booking.stepOf.replace("{step}", String(step + 1))}>{t.booking.steps.map((label, index) => <div className={`step-item ${index <= step ? "active" : ""}`} key={label}><span>{index + 1}</span><small>{label}</small></div>)}</div>
      <section className="card booking-card">
        {step === 0 && <><div className="form-grid"><div className="field"><label htmlFor="postcode">{t.booking.postcode}</label><input id="postcode" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} value={postcode} onChange={e => setPostcode(e.target.value.replace(/\D/g, ""))} placeholder={t.home.postcodePlaceholder} aria-invalid={postcode.length > 0 && !validPostcode} /></div><div className="field"><label htmlFor="date">{t.booking.date}</label><input id="date" type="date" min={minDate} value={date} onChange={e => setDate(e.target.value)} /></div><div className="field"><label htmlFor="duration">{t.booking.duration}</label><select id="duration" value={duration} onChange={e => setDuration(Number(e.target.value))}>{[2, 3, 4].map(hours => <option value={hours} key={hours}>{hours} {t.common.hours}</option>)}</select></div></div><div className="field field-full"><div className="field-label-row"><label>{t.booking.time}</label><span>Europe/Berlin</span></div>{slotsLoading ? <div className="slot-loading" role="status">Checking current availability...</div> : availableSlots.length > 0 ? <div className="time-slot-grid" role="list" aria-label="Available appointment times">{availableSlots.map(slot => <button key={slot.startsAt} type="button" role="listitem" className={`time-slot ${time === slot.time ? "selected" : ""}`} onClick={() => { setTime(slot.time); setSelected(null); }} aria-pressed={time === slot.time}><strong>{slot.time}</strong><small>{slot.cleanerIds.length} {slot.cleanerIds.length === 1 ? "cleaner" : "cleaners"}</small></button>)}</div> : validPostcode ? <p className="field-error" role="alert">No available times for this date. Try another date or shorter duration.</p> : <p className="field-help">Enter a 5-digit postcode to see live appointment times.</p>}</div>{postcode.length > 0 && !validPostcode && <p className="field-error" role="alert">{t.booking.invalidPostcode}</p>}</>}
        {step === 1 && <><div className="field"><label htmlFor="extras">{t.booking.extra}</label><select id="extras" value={extra} onChange={e => setExtra(e.target.value)}><option value="none">{t.booking.noExtras}</option><option value="oven">{t.booking.oven}</option><option value="windows">{t.booking.windows}</option></select></div><label className="choice-row"><input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} /><span>{t.booking.recurring}</span></label>{recurring && <><div className="field"><label htmlFor="frequency">{t.booking.frequency}</label><select id="frequency" value={recurrenceWeeks} onChange={e => setRecurrenceWeeks(Number(e.target.value))}><option value={1}>{t.booking.weekly}</option>{[2, 3, 4].map(count => <option value={count} key={count}>{t.booking.every.replace("{count}", String(count))}</option>)}</select></div><label className="choice-row consent-row"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>{t.booking.consent}</span></label></>}</>}
        {step === 2 && <><div className="section-heading"><div><h2>{t.booking.choose}</h2><p className="muted">Availability is checked against each cleaner&apos;s calendar and active jobs.</p></div>{profiles.length > 0 && <button type="button" className="button button-secondary button-small" onClick={() => setSelected(profiles[0].id)}>Choose best available</button>}</div><div className="profile-grid">{profiles.map((profile, index) => <article className={`profile-card ${selected === profile.id ? "selected" : ""}`} key={profile.id}><div className={`avatar avatar-${index % 2}`}>{profile.name[0]}</div><div className="profile-meta"><span className="status">{t.common.verified}</span><h3>{profile.name}</h3><p>{profile.areas.join(", ") || "-"} &middot; rating {profile.rating ?? "-"}</p><strong>{t.common.from} {formatEuro(profile.rate)} / {t.common.hourShort}</strong></div><button className={`button ${selected === profile.id ? "button-primary" : "button-secondary"}`} type="button" onClick={() => setSelected(profile.id)} aria-pressed={selected === profile.id}>{selected === profile.id ? t.booking.selected : t.common.select}</button></article>)}</div>{profilesLoading && <p className="muted">Checking live availability...</p>}{!profilesLoading && !profiles.length && <form className="waitlist-box" onSubmit={joinWaitlist}><div><strong>No cleaner is available for this slot.</strong><span>Join the postcode waitlist and the operations team can follow up.</span></div><input type="email" value={waitlistEmail} onChange={event => setWaitlistEmail(event.target.value)} placeholder="you@example.com" required /><button className="button button-secondary button-small" disabled={waitlistBusy}>{waitlistBusy ? "Joining..." : "Join waitlist"}</button></form>}{!selected && profiles.length > 0 && <p className="field-help">{t.booking.chooseCleaner}</p>}</>}
        {step === 3 && <><div className="demo-checkout"><div className="demo-payment-copy"><span className="status">Demo payment</span><h2>Secure authorization preview</h2><p className="muted">This demo creates an authorized payment record and financial snapshot. No card details are collected and no money is charged.</p><div className="demo-payment-summary"><div><span>Service</span><strong>{duration} hours</strong></div><div><span>Estimated total</span><strong>{formatEuro(duration * (profiles.find(profile => profile.id === selected)?.rate ?? 0) + (extra === "none" ? 0 : 1200))}</strong></div><div><span>Provider</span><strong>Local demo adapter</strong></div></div><label className="choice-row consent-row"><input type="checkbox" checked={demoPaymentConfirmed} onChange={event => setDemoPaymentConfirmed(event.target.checked)} /><span>I understand this is a simulated authorization and no real payment will be made.</span></label></div><img src="/images/demo-payment.png" alt="Illustration of secure demo payment authorization" /></div>{authenticated === false && <div className="checkout-auth-gate"><div><strong>Sign in to confirm this booking</strong><p>Your cleaner, service, date and time are saved on this device.</p></div><div className="workflow-buttons"><Link className="button button-secondary button-small" href="/customer/sign-in?returnTo=/booking">Sign in</Link><Link className="button button-primary button-small" href="/customer/register?returnTo=/booking">Create account</Link></div></div>}{bookingError && <p className="form-error" role="alert">{bookingError}</p>}</>}
        <div className="actions"><button className="button button-secondary" type="button" onClick={() => { setBookingError(""); setStep(Math.max(0, step - 1)); }} disabled={step === 0 || submitting}>{t.common.back}</button>{step < 3 ? <button className="button button-primary" type="button" onClick={() => { setBookingError(""); setStep(step + 1); }} disabled={!canAdvance}>{t.common.continue} &rarr;</button> : <button className="button button-primary" type="button" onClick={createBooking} disabled={submitting || !demoPaymentConfirmed || authenticated !== true}>{submitting ? "Creating..." : authenticated === false ? "Sign in to finish" : "Authorize demo payment & book"}</button>}</div>
      </section></div><aside className="booking-aside"><div className="card summary-card"><span className="eyebrow">NOVA</span><h2>{t.booking.pricing}</h2><div className="summary-row"><span>{t.booking.duration}</span><strong>{duration} {t.common.hours}</strong></div><div className="summary-row"><span>{t.booking.extra}</span><strong>{extra === "none" ? t.booking.noExtras : extra === "oven" ? t.booking.oven : t.booking.windows}</strong></div><p className="muted">{t.booking.pricingNote}</p></div></aside></main>
  </div>;
}
