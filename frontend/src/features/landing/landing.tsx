'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { AuthModal } from '../auth/auth-modal';
import { Avatar } from '../pool/avatar';
import { getTranslation, type Language, type Theme } from '@/lib/i18n';
import { applyTheme, getStoredTheme } from '@/lib/theme';
import type { Account } from '@/lib/auth';
import './landing.css';

export function LandingPage({
  onAuthenticate,
  accountError = '',
}: {
  onAuthenticate: (user: Account) => void;
  accountError?: string;
}) {
  const [auth, setAuth] = useState<'login' | 'signup' | null>(null);
  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('light');
  const [riders, setRiders] = useState(4);
  useEffect(() => {
    const value = getStoredTheme();
    setTheme(value);
    applyTheme(value);
  }, []);
  const t = (key: string) => getTranslation(lang, key);
  const toggleTheme = () => {
    const value = theme === 'light' ? 'dark' : 'light';
    setTheme(value);
    applyTheme(value);
  };
  return (
    <div className={`landing-shell ${theme}-theme`}>
      <a href="#main-content" className="landing-skip">
        Skip to content
      </a>
      <header className="landing-nav">
        <Link href="/" className="landing-logo" aria-label="Zew home">
          zew
          <span className="diagonal-arrow">
            <Icon name="arrow" size={22} />
          </span>
        </Link>
        <nav className="landing-nav-links" aria-label="Main navigation">
          <a href="#how-it-works">{t('howItWorks')}</a>
          <a href="#showcase">{t('fareSplitting')}</a>
          <Link href="/demo">
            The demo{' '}
            <span className="diagonal-arrow">
              <Icon name="arrow" size={22} />
            </span>
          </Link>
        </nav>
        <div className="landing-auth-actions">
          <select
            value={lang}
            onChange={(event) => setLang(event.target.value as Language)}
            aria-label="Select language"
            className="landing-language"
          >
            <option value="en">EN</option>
            <option value="am">አማ</option>
            <option value="om">OM</option>
          </select>
          <button
            className="landing-theme"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            <Icon name="sun" size={18} />
          </button>
          <button className="landing-login" onClick={() => setAuth('login')}>
            {t('logIn')} <Icon name="arrow" size={16} />
          </button>
        </div>
      </header>
      {accountError && (
        <p className="landing-account-error" role="alert">
          {accountError}
        </p>
      )}
      <main id="main-content">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">
              <span className="landing-dot" /> ADDIS ABABA, A LITTLE CLOSER
            </p>
            <h1>
              {t('heroTitleLine1')}
              <br />
              <em>{t('heroTitleLine2')}</em>
              <span className="hero-heading-arrow" aria-hidden="true">
                <Icon name="arrow" size={50} />
              </span>
            </h1>
            <p className="landing-hero-desc">{t('heroDesc')}</p>
            <div className="landing-hero-cta">
              <Link className="landing-btn-primary" href="/demo">
                {t('exploreDemo')}
                <Icon name="arrow" size={20} />
              </Link>
              <button className="landing-btn-text" onClick={() => setAuth('signup')}>
                {t('createAccount')}{' '}
                <span className="diagonal-arrow">
                  <Icon name="arrow" size={22} />
                </span>
              </button>
            </div>
            <div className="hero-people">
              <div className="hero-avatar-stack">
                <Avatar color="peach" name="Sara" />
                <Avatar color="lavender" name="Bereket" />
                <Avatar color="blue" name="Eden" />
              </div>
              <p>
                One direction. A shared possibility.
                <br />
                <span>Meet the people in our private demo.</span>
              </p>
            </div>
            <p className="landing-demo-note">
              <Icon name="shield" size={15} /> {t('demoNotice')}
            </p>
          </div>
          <div className="landing-hero-visual">
            <div className="hero-image-frame">
              <Image
                src="/images/hero_addis_commute.png"
                alt="Illustration of an avenue and skyline in Addis Ababa"
                fill
                priority
                sizes="(max-width: 760px) 100vw, 50vw"
                className="hero-city-img"
              />
              <div className="hero-photo-caption">
                <span>9.03° N · 38.75° E</span>
                <span>OUR CITY. OUR INSPIRATION.</span>
              </div>
            </div>
            <span className="hero-city-tag">
              <Icon name="pin" size={14} /> Inspired by Addis
            </span>
            <div className="hero-journey-card">
              <div className="hero-card-heading">
                <span>YOUR NEXT SHARED CHAPTER</span>
                <span className="hero-demo-badge">DEMO</span>
              </div>
              <div className="hero-route">
                <div className="hero-route-line">
                  <i />
                  <span />
                  <i />
                </div>
                <div>
                  <small>PICKUP</small>
                  <strong>Bole · Edna Mall</strong>
                  <small>DESTINATION</small>
                  <strong>Meskel Square</strong>
                </div>
                <span className="hero-route-icon">
                  <Icon name="car" size={28} />
                </span>
              </div>
              <div className="hero-card-bottom">
                <div>
                  <span className="hero-fare">
                    90 <small>ETB / person</small>
                  </span>
                  <p>4 people · illustrative shared fare</p>
                </div>
                <Link href="/demo" aria-label="Explore this demo journey">
                  <Icon name="arrow" size={22} />
                </Link>
              </div>
            </div>
          </div>
        </section>
        <div className="landing-city-strip">
          <span>Built around a simple idea.</span>
          <p>
            Less solo.
            <i /> More together.
            <i /> A fairer share.
          </p>
          <Icon name="leaf" size={22} />
        </div>
        <section id="how-it-works" className="landing-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">THE JOURNEY, REIMAGINED</p>
              <h2>
                A little planning.
                <br />A lot more possibility.
              </h2>
            </div>
            <p>
              Explore a different way to move through your city. Every ride here is a simulation, so
              you can try the whole journey at your own pace.
            </p>
          </div>
          <div className="steps-grid">
            {(['pin', 'people', 'car'] as const).map((icon, index) => (
              <article className="step-card" key={icon}>
                <div className="step-top">
                  <span className="step-icon">
                    <Icon name={icon} size={26} />
                  </span>
                  <span className="step-num">0{index + 1}</span>
                </div>
                <h3>{t(`step${index + 1}Title`)}</h3>
                <p>{t(`step${index + 1}Desc`)}</p>
                <span className="step-line" />
              </article>
            ))}
          </div>
        </section>
        <section id="showcase" className="fare-showcase">
          <div className="fare-showcase-copy">
            <p className="section-kicker">SAME JOURNEY. SMALLER SHARE.</p>
            <h2>
              Good company.
              <br />
              <em>Better arithmetic.</em>
            </h2>
            <p>
              A shared fare goes a little further. Try the numbers for our example Bole → Meskel
              Square journey.
            </p>
            <div className="fare-showcase-route">
              <Icon name="pin" size={18} /> Bole <span>··············</span>
              <Icon name="arrow" size={18} /> Meskel Square
            </div>
            <small>Illustrative 360 ETB total. No distance-based quote or real payment.</small>
          </div>
          <div className="fare-calculator">
            <div className="fare-calculator-heading">
              <span>HOW MANY IN YOUR CIRCLE?</span>
              <Icon name="people" size={20} />
            </div>
            <div className="fare-people-selector" role="group" aria-label="Example passenger count">
              {[1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  aria-pressed={riders === count}
                  onClick={() => setRiders(count)}
                >
                  <Icon name="people" size={18} />
                  <span>{count}</span>
                </button>
              ))}
            </div>
            <div className="fare-calculator-total" aria-live="polite">
              <strong>
                {360 / riders}
                <span>ETB</span>
              </strong>
              <p>Your example share, per person</p>
            </div>
            <div className="fare-calculator-savings">
              <span>Compared with the example solo fare</span>
              <strong>{Math.round((1 - 1 / riders) * 100)}% less</strong>
            </div>
            <Link href="/demo">
              Build your demo circle <Icon name="arrow" size={19} />
            </Link>
          </div>
        </section>
        <section className="landing-cta-section">
          <span className="cta-sun" aria-hidden="true">
            <Icon name="arrow" size={50} />
          </span>
          <p className="section-kicker">FOR THE WAY WE WANT TO MOVE</p>
          <h2>
            Your city.
            <br />
            Your way.<em> Together.</em>
          </h2>
          <Link className="landing-btn-primary" href="/demo">
            Take a look around <Icon name="arrow" size={20} />
          </Link>
          <p>Explore the demo. No account or payment needed.</p>
        </section>
      </main>
      <footer className="landing-footer">
        <div>
          <Link href="/" className="landing-logo">
            zew
            <span className="diagonal-arrow">
              <Icon name="arrow" size={22} />
            </span>
          </Link>
          <p>A shared-ride idea, made for Addis.</p>
        </div>
        <div className="landing-footer-links">
          <Link href="/demo">
            Ride circle demo <Icon name="arrow" size={14} />
          </Link>
          <Link href="/planned">
            Planned commute demo <Icon name="arrow" size={14} />
          </Link>
          <button onClick={() => setAuth('login')}>
            Account sign-in <Icon name="arrow" size={14} />
          </button>
        </div>
        <p className="footer-disclaimer">
          Private interactive demo. People, availability, driver actions, fares and payments are
          simulated. No live transport service.
        </p>
        <span className="footer-made">MADE WITH POSSIBILITY IN ADDIS ABABA</span>
      </footer>
      {auth && (
        <AuthModal
          isOpen
          initialTab={auth}
          onClose={() => setAuth(null)}
          onSuccess={(user) => {
            onAuthenticate(user);
            setAuth(null);
          }}
        />
      )}
    </div>
  );
}
