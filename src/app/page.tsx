import Image from "next/image";

const Check = () => <span className="check" aria-hidden="true">✓</span>;

export default function Home() {
  return (
    <div className="nova-page">
      <header className="nova-header">
        <div className="nova-shell nova-nav">
          <a className="nova-brand" href="#top" aria-label="NOVA home"><span className="brand-spark">✦</span>NOVA</a>
          <nav aria-label="Main navigation"><a href="#book">Book a cleaner</a><a href="#how-it-works">How it works</a><a href="#join">Become a cleaner</a></nav>
          <div className="nav-actions"><button className="text-button" type="button">Sign in</button><a className="small-button" href="#join">Join NOVA <span>→</span></a></div>
        </div>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="nova-shell hero-grid">
            <div className="hero-copy">
              <span className="kicker"><i />A cleaner home, on your terms</span>
              <h1>Make space for <em>what matters.</em></h1>
              <p>Book a trusted local cleaner in just a few taps, or build a flexible cleaning career with NOVA.</p>
              <div className="hero-points"><span><Check /> Vetted local professionals</span><span><Check /> Simple, secure booking</span></div>
            </div>
            <div className="hero-visual" aria-label="A bright, tidy living room">
              <Image src="/images/nova-cleaning-hero.png" alt="" fill priority sizes="(max-width: 900px) 100vw, 48vw" />
              <div className="visual-overlay" />
              <div className="rating-card"><div className="avatar-stack"><b>J</b><b>M</b><b>S</b></div><span><strong>4.9 out of 5</strong><small>from happy NOVA homes</small></span><i>★</i></div>
              <div className="availability-card"><span className="online-dot" /> Cleaners available this week</div>
            </div>
            <section className="booking-card" id="book" aria-labelledby="booking-title">
              <div className="card-heading"><span className="step-label">01 / BOOK A CLEANER</span><h2 id="booking-title">Let&apos;s find your perfect match.</h2><p>Tell us where you are to see cleaners near you.</p></div>
              <div className="booking-fields"><label className="field address-field"><span>⌖</span><input aria-label="Your postcode or area" placeholder="Enter your postcode or area" /></label><button className="primary-button" type="button">Find cleaners <span>→</span></button></div>
              <div className="booking-foot"><span>◎</span> No commitment — browse availability first</div>
            </section>
          </div>
        </section>

        <section className="choice-section nova-shell" id="how-it-works" aria-labelledby="choice-title">
          <div className="section-title"><div><span className="kicker"><i />One platform, made for people</span><h2 id="choice-title">How can NOVA help today?</h2></div></div>
          <div className="path-grid">
            <article className="path-card customer-path">
              <div className="path-icon">⌂</div><div className="path-content"><span className="path-eyebrow">FOR YOUR HOME</span><h3>Enjoy a home that feels looked after.</h3><p>Find a reliable cleaner, choose a time that suits your routine, and manage every visit in one place.</p><ul><li><Check /> One-off or regular cleans</li><li><Check /> Choose your preferred time</li><li><Check /> Easy online payments</li></ul><a href="#customer-register">Book your cleaner <span>↗</span></a></div><div className="path-art customer-art"><span>✦</span><b>Fresh<br />starts.</b></div>
            </article>
            <article className="path-card cleaner-path">
              <div className="path-icon">✦</div><div className="path-content"><span className="path-eyebrow">FOR CLEANERS</span><h3>Build work around your life.</h3><p>Join a community that respects your craft and gives you more control over when and where you work.</p><ul><li><Check /> Choose jobs that fit your week</li><li><Check /> Set your availability</li><li><Check /> Get paid simply and fairly</li></ul><a href="#cleaner-register">Become a NOVA cleaner <span>↗</span></a></div><div className="path-art cleaner-art"><span>✳</span><b>Good work,<br />your way.</b></div>
            </article>
          </div>
        </section>

        <section className="registration-section" id="join" aria-labelledby="join-title">
          <div className="nova-shell">
            <div className="registration-heading"><div><span className="kicker"><i />Create your NOVA account</span><h2 id="join-title">A simple start, whichever path you choose.</h2></div><p>These forms are a visual preview only. Your details are not sent or saved.</p></div>
            <div className="form-grid">
              <form className="register-card" id="customer-register">
                <div className="register-top"><span className="form-number">02</span><div><span className="path-eyebrow">CUSTOMER ACCOUNT</span><h3>Start booking in minutes.</h3></div><span className="role-mark home-mark">⌂</span></div>
                <div className="field-grid"><label>First name<input placeholder="Your first name" /></label><label>Last name<input placeholder="Your last name" /></label></div><label>Email address<input type="email" placeholder="you@example.com" /></label><label>Postcode<input placeholder="Where should we clean?" /></label><button className="primary-button" type="button">Create customer account <span>→</span></button><small>By continuing, you agree to our Terms and Privacy Policy.</small>
              </form>
              <form className="register-card cleaner-register" id="cleaner-register">
                <div className="register-top"><span className="form-number">03</span><div><span className="path-eyebrow">CLEANER APPLICATION</span><h3>Put your skills to work.</h3></div><span className="role-mark work-mark">✦</span></div>
                <div className="field-grid"><label>First name<input placeholder="Your first name" /></label><label>Last name<input placeholder="Your last name" /></label></div><label>Email address<input type="email" placeholder="you@example.com" /></label><label>Your area<input placeholder="Town or postcode" /></label><button className="dark-button" type="button">Start your application <span>→</span></button><small>We&apos;ll guide you through the rest when you&apos;re ready.</small>
              </form>
            </div>
          </div>
        </section>

        <section className="steps-section nova-shell">
          <div className="steps-intro"><span className="kicker"><i />A better way to arrange cleaning</span><h2>Easy from hello to spotless.</h2></div>
          <div className="steps-list"><article><span>01</span><div><h3>Tell us what you need</h3><p>Share your location, home and preferred cleaning schedule.</p></div></article><article><span>02</span><div><h3>Meet your cleaner</h3><p>Review trusted local profiles and pick the one that feels right.</p></div></article><article><span>03</span><div><h3>Come home happy</h3><p>Manage your bookings and enjoy more room in your week.</p></div></article></div>
        </section>
      </main>
      <footer className="nova-footer"><div className="nova-shell footer-inner"><a className="nova-brand" href="#top"><span className="brand-spark">✦</span>NOVA</a><p>Thoughtful cleaning support for happier homes and better working days.</p><span>© 2026 NOVA</span></div></footer>
    </div>
  );
}
