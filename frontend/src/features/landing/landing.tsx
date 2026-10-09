'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { AuthModal } from '../auth/auth-modal';
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
  const [farePreview, setFarePreview] = useState<{
    pickup: string;
    destination: string;
    total: number;
    maxPeople: number;
  } | null>(null);
  useEffect(() => {
    const value = getStoredTheme();
    setTheme(value);
    applyTheme(value);
  }, []);
  useEffect(() => {
    let active = true;
    void fetch('/api/v1/fare-preview')
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error('Fare unavailable')),
      )
      .then((data) => {
        if (active) {
          setFarePreview(data);
          setRiders(Math.min(4, data.maxPeople));
        }
      })
      .catch(() => {
        if (active) setFarePreview(null);
      });
    return () => {
      active = false;
    };
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
          <button type="button" className="landing-nav-action" onClick={() => setAuth('signup')}>
            Find a ride{' '}
            <span className="diagonal-arrow">
              <Icon name="arrow" size={22} />
            </span>
          </button>
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
              <button
                type="button"
                className="landing-btn-primary"
                onClick={() => setAuth('signup')}
              >
                {t('exploreDemo')}
                <Icon name="arrow" size={20} />
              </button>
              <button className="landing-btn-text" onClick={() => setAuth('signup')}>
                {t('createAccount')}{' '}
                <span className="diagonal-arrow">
                  <Icon name="arrow" size={22} />
                </span>
              </button>
            </div>
            <div className="hero-people">
              <p>One direction. A shared possibility.</p>
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
                <span className="hero-demo-badge">PREVIEW</span>
              </div>
              <div className="hero-route">
                <div className="hero-route-line">
                  <i />
                  <span />
                  <i />
                </div>
                <div>
                  <small>PICKUP</small>
                  <strong>{farePreview?.pickup ?? 'Fare loading'}</strong>
                  <small>DESTINATION</small>
                  <strong>{farePreview?.destination ?? 'Fare loading'}</strong>
                </div>
                <span className="hero-route-icon">
                  <Icon name="car" size={28} />
                </span>
              </div>
              <div className="hero-card-bottom">
                <div>
                  <span className="hero-fare">
                    {farePreview
                      ? Math.round((farePreview.total / farePreview.maxPeople) * 100) / 100
                      : '—'}{' '}
                    <small>ETB / person</small>
                  </span>
                  <p>{farePreview?.maxPeople ?? '—'} people · projected shared fare</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAuth('signup')}
                  aria-label="Find a ride for this journey"
                >
                  <Icon name="arrow" size={22} />
                </button>
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
              Choose your route, departure time and seats. Review a matching ride and its total
              before confirming.
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
              A shared fare goes a little further. Explore the fare breakdown for a Bole journey.
            </p>
            <div className="fare-showcase-route">
              <Icon name="pin" size={18} /> {farePreview?.pickup ?? 'Pickup'}{' '}
              <span>··············</span>
              <Icon name="arrow" size={18} /> {farePreview?.destination ?? 'Destination'}
            </div>
            <small>
              Projected total: {farePreview ? `${farePreview.total} ETB` : 'unavailable'}. Road
              pricing and payment are not connected.
            </small>
          </div>
          <div className="fare-calculator">
            <div className="fare-calculator-heading">
              <span>HOW MANY ARE SHARING?</span>
              <Icon name="people" size={20} />
            </div>
            <div className="fare-people-selector" role="group" aria-label="Passenger count">
              {Array.from({ length: farePreview?.maxPeople ?? 0 }, (_, index) => index + 1).map(
                (count) => (
                  <button
                    key={count}
                    aria-pressed={riders === count}
                    onClick={() => setRiders(count)}
                  >
                    <Icon name="people" size={18} />
                    <span>{count}</span>
                  </button>
                ),
              )}
            </div>
            <div className="fare-calculator-total" aria-live="polite">
              <strong>
                {farePreview ? Math.round((farePreview.total / riders) * 100) / 100 : '—'}
                <span>ETB</span>
              </strong>
              <p>Your projected share, per person</p>
            </div>
            <div className="fare-calculator-savings">
              <span>Compared with the solo fare</span>
              <strong>{Math.round((1 - 1 / riders) * 100)}% less</strong>
            </div>
            <button type="button" onClick={() => setAuth('signup')}>
              Find a ride <Icon name="arrow" size={19} />
            </button>
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
          <button
            type="button"
            className="landing-btn-primary"
            onClick={() => setAuth('signup')}
          >
            Find a ride <Icon name="arrow" size={20} />
          </button>
          <p>Sign up to explore ride sharing.</p>
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
          <button type="button" onClick={() => setAuth('signup')}>
            Planned commutes <Icon name="arrow" size={14} />
          </button>
          <button onClick={() => setAuth('login')}>
            Account sign-in <Icon name="arrow" size={14} />
          </button>
        </div>
        <p className="footer-disclaimer">
          Preview environment. No live passenger matching, dispatch, or payments.
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
