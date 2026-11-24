"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/lib/i18n";
import { useToast } from "@/components/toast-provider";

type CleanerProfile = { id: string; name: string; rate: number; areas: string[]; rating: string | null };

export default function Cleaners() {
  const { t, formatEuro } = useLocale();
  const { showToast, updateToast, dismissToast } = useToast();
  const [profiles, setProfiles] = useState<CleanerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const toastId = showToast("Loading available cleaners...", "loading");
    fetch("/api/cleaners", { signal: controller.signal, cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Could not load cleaners")))
      .then(({ profiles: result }: { profiles: CleanerProfile[] }) => { setProfiles(result); updateToast(toastId, "Available cleaners loaded", "success"); })
      .catch(error => { if (error.name !== "AbortError") { setProfiles([]); updateToast(toastId, "Could not load cleaners", "error", 0); } })
      .finally(() => setLoading(false));
    return () => { controller.abort(); dismissToast(toastId); };
  }, [showToast, updateToast, dismissToast]);

  return <><SiteHeader /><main className="shell section listing-page"><span className="eyebrow"><span className="eyebrow-line" />{t.cleaners.eyebrow}</span><h1>{t.cleaners.title}</h1><p className="muted listing-intro">{t.cleaners.intro}</p><div className="listing-grid">{profiles.map((profile, index) => <article className="listing-card" key={profile.id}><div className={`listing-art listing-art-${index % 2}`}><span>*</span></div><div className="listing-body"><span className="status">{t.common.verified}</span><h2>{profile.name}</h2><p className="muted">{profile.areas.join(", ") || "-"} &middot; rating {profile.rating ?? "-"}</p><div className="listing-bottom"><strong>{t.common.from} {formatEuro(profile.rate)} / {t.common.hourShort}</strong><Link className="button button-primary" href="/booking">{t.cleaners.chooseDate} &rarr;</Link></div></div></article>)}</div>{loading && <p className="muted">Loading...</p>}{!loading && !profiles.length && <p className="muted">No cleaners are available yet.</p>}</main></>;
}
