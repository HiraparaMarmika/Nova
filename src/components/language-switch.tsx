"use client";
import { useLocale } from "@/lib/i18n";
import { useRouter } from "next/navigation";

export function LanguageSwitch() {
  const { locale, setLocale } = useLocale(); const router = useRouter();
  function changeLocale(nextLocale: "de" | "en") { if (nextLocale === locale) return; document.cookie = `nova-locale=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`; setLocale(nextLocale); router.refresh(); }
  return <div className="language-switch" role="group" aria-label="Sprache / Language">
    <button type="button" lang="de" aria-label="Deutsch" aria-pressed={locale === "de"} onClick={() => changeLocale("de")}>DE</button>
    <span aria-hidden="true">/</span>
    <button type="button" lang="en" aria-label="English" aria-pressed={locale === "en"} onClick={() => changeLocale("en")}>EN</button>
  </div>;
}
