"use client";

import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/site-header";
import { Reveal } from "@/components/reveal";
import { PostcodeAvailabilityChecker } from "@/components/postcode-availability-checker";
import { useLocale } from "@/lib/i18n";

const Check = () => <span className="check-icon" aria-hidden="true">✓</span>;

export default function Home() {
  const { t } = useLocale();
  const home = t.home;
  const services = t.services;

  return <div className="home-page">
    <SiteHeader />
    <main>
      <section className="hero shell hero-reveal" id="top">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-line" />{home.eyebrow}</span>
          <h1>{home.title1} <em>{home.title2}</em></h1>
          <p className="hero-description">{home.description}</p>
          <PostcodeAvailabilityChecker />
          <div className="trust-row" aria-label="NOVA benefits"><span><Check />{home.trust1}</span><span><Check />{home.trust2}</span><span><Check />{home.trust3}</span></div>
        </div>
        <div className="hero-visual" aria-label={home.sampleTitle}>
          <Image className="hero-cleaner-image" src="/images/nova-cleaning-hero.png" alt="Professional NOVA cleaner wearing an apron and gloves while cleaning a kitchen counter" fill priority sizes="(max-width: 850px) 100vw, 42vw" /><div className="hero-photo-overlay" aria-hidden="true" /><span className="visual-sparkle" aria-hidden="true">✦</span>
          <div className="floating-card floating-card-top"><span className="mini-icon" aria-hidden="true">✦</span><div><strong>{home.sample}</strong><small>{home.sampleText}</small></div></div>
          <div className="floating-card floating-card-bottom"><span className="calendar-icon" aria-hidden="true">▦</span><div><strong>{home.sampleDay} · {home.sampleTask}</strong><small>{home.sampleTime}</small></div><span className="check-icon" aria-hidden="true">✓</span></div>
        </div>
      </section>
      <Reveal as="section" className="benefit-band"><div className="shell benefit-inner"><span className="benefit-mark" aria-hidden="true">✦</span><p>{home.sampleTitle}</p><span>{home.sampleText}</span></div></Reveal>
      <Reveal as="section" className="section services-section shell" id="services" aria-labelledby="services-title">
        <div className="section-intro"><div><span className="eyebrow"><span className="eyebrow-line" />{services.eyebrow}</span><h2 id="services-title">{services.title}</h2></div><p className="muted">{services.intro}</p></div>
        <div className="grid3 service-grid reveal-stagger">
          <article className="service-card"><span className="service-icon" aria-hidden="true">◷</span><h3>{services.oneTime}</h3><p>{services.oneTimeText}</p><Link href="/booking">{services.learnMore} <span aria-hidden="true">→</span></Link></article>
          <article className="service-card"><span className="service-icon" aria-hidden="true">↻</span><h3>{services.recurring}</h3><p>{services.recurringText}</p><Link href="/booking">{services.learnMore} <span aria-hidden="true">→</span></Link></article>
          <article className="service-card"><span className="service-icon" aria-hidden="true">✦</span><h3>{services.extras}</h3><p>{services.extrasText}</p><Link href="/booking">{services.learnMore} <span aria-hidden="true">→</span></Link></article>
        </div>
      </Reveal>
      <Reveal as="section" className="section shell" id="how" aria-labelledby="how-title">
        <div className="section-intro"><div><span className="eyebrow"><span className="eyebrow-line" />{home.sectionEyebrow}</span><h2 id="how-title">{home.sectionTitle}</h2></div><p className="muted">{home.sectionDescription}</p></div>
        <div className="grid3 steps-grid reveal-stagger">{[{ no: "01", mark: "⌖", title: home.step1Title, text: home.step1Text }, { no: "02", mark: "◌", title: home.step2Title, text: home.step2Text }, { no: "03", mark: "↗", title: home.step3Title, text: home.step3Text }].map(step => <article className="step-card" key={step.no}><span className="step-no">{step.no}</span><span className="step-art" aria-hidden="true">{step.mark}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
      </Reveal>
      <Reveal as="section" className="cta-wrap shell" id="enquiry" aria-labelledby="cta-title"><div className="cta-panel"><div><span className="eyebrow light">NOVA</span><h2 id="cta-title">{home.ctaTitle}</h2><p>{home.ctaText}</p></div><Link className="button button-light" href="/booking">{t.common.book} <span aria-hidden="true">→</span></Link></div></Reveal>
      <section className="sr-only" id="why-nova" aria-label="Why NOVA"><h2>{home.trust1}</h2><p>{home.trust2}. {home.trust3}.</p></section>
      <section className="sr-only" id="faq" aria-label="Frequently asked questions"><h2>FAQ</h2><p>{home.footer}</p></section>
    </main>
    <footer className="footer home-footer">
      <div className="shell home-footer-inner">
        <div className="home-footer-top">
          <div className="home-footer-brand"><Link href="/" aria-label="NOVA home"><span aria-hidden="true">✦</span>NOVA</Link><p>{home.footer}</p></div>
          <nav className="home-footer-links" aria-label="Footer navigation"><Link href="#services">{t.nav.services}</Link><Link href="#how">{t.nav.how}</Link><Link href="/cleaner/register">{t.nav.forCleaners}</Link><Link href="/booking">{t.common.book}</Link></nav>
        </div>
        <div className="home-footer-bottom"><span>© {new Date().getFullYear()} NOVA</span><span>{t.common.germany}</span><Link href="#top">Back to top <span aria-hidden="true">↑</span></Link></div>
      </div>
    </footer>
  </div>;
}
