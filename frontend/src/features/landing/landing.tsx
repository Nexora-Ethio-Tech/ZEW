'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { AuthModal } from '../auth/auth-modal';
import { getTranslation, type Language, type Theme } from '@/lib/i18n';
import { applyTheme, getStoredTheme } from '@/lib/theme';
import './landing.css';

export function LandingPage({
  onAuthenticate,
}: {
  onAuthenticate: (user: { id: string; email: string; name: string; role: string }) => void;
}) {
  const [authOpen, setAuthOpen] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const activeTheme = getStoredTheme();
    setTheme(activeTheme);
    applyTheme(activeTheme);
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const t = (key: string) => getTranslation(lang, key);

  return (
    <div className={`landing-shell ${theme === 'light' ? 'light-theme' : 'dark-theme'}`}>
      {/* Top Navbar */}
      <header className="landing-nav">
        <div className="landing-brand">
          <Link href="/" className="landing-logo">
            zew<span>↗</span>
          </Link>
          <span className="landing-city-badge">
            <i /> {t('cityBadge')}
          </span>
        </div>

        <nav className="landing-nav-links">
          <a href="#how-it-works">{t('howItWorks')}</a>
          <a href="#showcase">{t('fareSplitting')}</a>
        </nav>

        <div className="landing-auth-actions">
          {/* Language Selector */}
          <div className="landing-lang-selector">
            <span className="lang-icon">🌐</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Language)}
              className="lang-select"
              aria-label="Select Language"
            >
              <option value="en">English</option>
              <option value="am">አማርኛ</option>
              <option value="om">Afaan Oromoo</option>
            </select>
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={handleToggleTheme}
            title="Toggle Light/Dark Theme"
          >
            {theme === 'light' ? '☀️ Light' : '🌙 Dark'}
          </button>

          <button className="landing-btn-secondary" onClick={() => setAuthOpen(true)}>
            {t('logIn')}
          </button>
          <button className="landing-btn-primary" onClick={() => setAuthOpen(true)}>
            {t('signUpBtn')}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-grid">
          <div className="landing-hero-left">
            <span className="landing-eyebrow">
              <Icon name="sun" size={16} /> {t('heroEyebrow')}
            </span>
            <h1>
              {t('heroTitleLine1')} <br />
              <span>{t('heroTitleLine2')}</span>
            </h1>
            <p className="landing-hero-desc">{t('heroDesc')}</p>

            <div className="landing-hero-cta">
              <button className="landing-btn-primary large" onClick={() => setAuthOpen(true)}>
                {t('signInToRide')}
                <Icon name="arrow" size={18} />
              </button>
              <button className="landing-btn-secondary large" onClick={() => setAuthOpen(true)}>
                {t('createAccount')}
              </button>
            </div>

            <div className="landing-stats-grid">
              <div className="landing-stat">
                <strong>75%</strong>
                <span>{t('maxFareSavings')}</span>
              </div>
              <div className="landing-stat-divider" />
              <div className="landing-stat">
                <strong>120s</strong>
                <span>{t('maxPickupSpan')}</span>
              </div>
              <div className="landing-stat-divider" />
              <div className="landing-stat">
                <strong>100%</strong>
                <span>{t('corridorVerified')}</span>
              </div>
            </div>
          </div>

          <div className="landing-hero-right">
            <div className="hero-image-card">
              <img
                src="/images/hero_addis_commute.png"
                alt="Addis Ababa Clean Commute Avenue"
                className="hero-city-img"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="landing-section">
        <div className="section-title-center">
          <span className="section-kicker">SIMPLE & TRANSPARENT</span>
          <h2>{t('howItWorks')}</h2>
          <p>Group first, driver second. Fair shared rides built for everyday movement in Addis Ababa.</p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <span className="step-num">01</span>
            <h3>{t('step1Title')}</h3>
            <p>{t('step1Desc')}</p>
          </div>
          <div className="step-card">
            <span className="step-num">02</span>
            <h3>{t('step2Title')}</h3>
            <p>{t('step2Desc')}</p>
          </div>
          <div className="step-card">
            <span className="step-num">03</span>
            <h3>{t('step3Title')}</h3>
            <p>{t('step3Desc')}</p>
          </div>
        </div>
      </section>

      {/* Ride Showcase Banner */}
      <section id="showcase" className="landing-section showcase-section">
        <div className="showcase-grid">
          <div className="showcase-image-wrapper">
            <img
              src="/images/addis_ride_sharing.jpg"
              alt="Shared Ride Circle in Addis Ababa"
              className="showcase-img"
            />
          </div>
          <div className="showcase-content">
            <span className="section-kicker">{t('showcaseKicker')}</span>
            <h2>{t('showcaseTitle')}</h2>
            <p>{t('showcaseDesc')}</p>
            <ul className="showcase-list">
              <li>
                <Icon name="check" size={18} /> {t('showcaseItem1')}
              </li>
              <li>
                <Icon name="check" size={18} /> {t('showcaseItem2')}
              </li>
              <li>
                <Icon name="check" size={18} /> {t('showcaseItem3')}
              </li>
            </ul>
            <button className="landing-btn-primary large" onClick={() => setAuthOpen(true)}>
              {t('joinZew')}
              <Icon name="arrow" size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <span className="footer-logo">zew<span>↗</span></span>
          <p>Shared Commute Platform for Addis Ababa Ethiopia</p>
          <button className="landing-btn-primary" onClick={() => setAuthOpen(true)}>
            {t('signInToRide')}
          </button>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={(user) => {
          onAuthenticate(user);
        }}
      />
    </div>
  );
}
