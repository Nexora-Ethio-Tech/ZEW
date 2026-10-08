'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { AuthModal } from '../auth/auth-modal';
import './landing.css';

export function LandingPage({
  onAuthenticate,
}: {
  onAuthenticate: (user: { id: string; email: string; name: string; role: string }) => void;
}) {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="landing-shell light-theme">
      {/* Top Navbar */}
      <header className="landing-nav">
        <div className="landing-brand">
          <Link href="/" className="landing-logo">
            zew<span>↗</span>
          </Link>
          <span className="landing-city-badge">
            <i /> ADDIS ABABA
          </span>
        </div>

        <nav className="landing-nav-links">
          <a href="#how-it-works">How It Works</a>
          <a href="#corridors">Corridors</a>
          <a href="#showcase">Ride Circles</a>
        </nav>

        <div className="landing-auth-actions">
          <button className="landing-btn-secondary" onClick={() => setAuthOpen(true)}>
            Log In
          </button>
          <button className="landing-btn-primary" onClick={() => setAuthOpen(true)}>
            Sign Up & Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-grid">
          <div className="landing-hero-left">
            <span className="landing-eyebrow">
              <Icon name="sun" size={16} /> SHARED COMMUTES & JOURNEYS FOR ADDIS ABABA
            </span>
            <h1>
              Every journey. <br />
              <span>Better together.</span>
            </h1>
            <p className="landing-hero-desc">
              A missing middle for commuters and travelers in Addis Ababa. Cheaper than solo cabs, more comfortable than minibuses, matched dynamically in real-time.
            </p>

            <div className="landing-hero-cta">
              <button className="landing-btn-primary large" onClick={() => setAuthOpen(true)}>
                Sign In to Ride
                <Icon name="arrow" size={18} />
              </button>
              <button className="landing-btn-secondary large" onClick={() => setAuthOpen(true)}>
                Create Account
              </button>
            </div>

            <div className="landing-stats-grid">
              <div className="landing-stat">
                <strong>75%</strong>
                <span>Max Fare Savings</span>
              </div>
              <div className="landing-stat-divider" />
              <div className="landing-stat">
                <strong>120s</strong>
                <span>Max Pickup Span</span>
              </div>
              <div className="landing-stat-divider" />
              <div className="landing-stat">
                <strong>100%</strong>
                <span>Corridor Verified</span>
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
              <div className="hero-floating-card">
                <span className="floating-badge">⚡ LIVE IN ADDIS</span>
                <strong>Bole ➔ Meskel Square ➔ Mexico</strong>
                <p>3 verified driver rides available right now</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="landing-section">
        <div className="section-title-center">
          <span className="section-kicker">SIMPLE & TRANSPARENT</span>
          <h2>How Zew Works</h2>
          <p>Group first, driver second. Fair shared rides built for everyday movement in Addis Ababa.</p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <span className="step-num">01</span>
            <h3>Set Your Journey</h3>
            <p>Pick any pickup and destination in Addis Ababa using place search, Leaflet map pins, or GPS location.</p>
          </div>
          <div className="step-card">
            <span className="step-num">02</span>
            <h3>System Auto-Grouping</h3>
            <p>Specify your passenger size preferences and max fare budget. Zew automatically matches compatible circle members.</p>
          </div>
          <div className="step-card">
            <span className="step-num">03</span>
            <h3>Assigned Ride & Driver</h3>
            <p>Get matched with vetted drivers traveling your forward corridor with locked fare splits and instant boarding codes.</p>
          </div>
        </div>
      </section>

      {/* Ride Showcase Banner */}
      <section id="showcase" className="landing-section showcase-section">
        <div className="showcase-grid">
          <div className="showcase-image-wrapper">
            <img
              src="/images/addis_ride_sharing.png"
              alt="Shared Ride Circle in Addis Ababa"
              className="showcase-img"
            />
          </div>
          <div className="showcase-content">
            <span className="section-kicker">DYNAMIC FARE SPLITTING</span>
            <h2>Shared Comfort. Unbeatable Value.</h2>
            <p>
              Sharing your 7.6 km route across Addis with 4 passengers drops the fare per person from 394 ETB to 99 ETB — saving 295 ETB (75%)!
            </p>
            <ul className="showcase-list">
              <li>
                <Icon name="check" size={18} /> <strong>TransparentSantim Splits</strong>: Total route fare split equally among passengers.
              </li>
              <li>
                <Icon name="check" size={18} /> <strong>Zero U-Turns</strong>: Drivers pick up only along their forward travel direction.
              </li>
              <li>
                <Icon name="check" size={18} /> <strong>Support Desk Dispatch</strong>: Phone dispatch order creation for off-grid callers.
              </li>
            </ul>
            <button className="landing-btn-primary large" onClick={() => setAuthOpen(true)}>
              Join Zew Today
              <Icon name="arrow" size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Corridors Section */}
      <section id="corridors" className="landing-section">
        <div className="section-title-center">
          <span className="section-kicker">ACTIVE ADDIS ABABA CORRIDORS</span>
          <h2>Travel Corridors</h2>
          <p>Verified forward routes connecting major business and transport hubs.</p>
        </div>

        <div className="corridors-grid">
          <div className="corridor-card">
            <div className="corridor-icon">🟢</div>
            <h3>Bole ➔ City Centre</h3>
            <p>Bole (Edna Mall) ➔ Atlas ➔ Wollo Sefer ➔ Meskel Square ➔ Mexico</p>
            <span className="corridor-tag">6 Active Drivers</span>
          </div>

          <div className="corridor-card">
            <div className="corridor-icon">🔵</div>
            <h3>CMC ➔ City Centre</h3>
            <p>CMC ➔ Megenagna ➔ Haya Hulet ➔ Kazanchis ➔ Meskel Square ➔ Mexico</p>
            <span className="corridor-tag">5 Active Drivers</span>
          </div>

          <div className="corridor-card">
            <div className="corridor-icon">🟣</div>
            <h3>Bole / Wollo Sefer ➔ CMC</h3>
            <p>Bole (Edna Mall) ➔ Atlas ➔ Wollo Sefer ➔ Haya Hulet ➔ Megenagna ➔ CMC</p>
            <span className="corridor-tag">4 Active Drivers</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <span className="footer-logo">zew<span>↗</span></span>
          <p>Shared Commute Platform for Addis Ababa Ethiopia</p>
          <button className="landing-btn-primary" onClick={() => setAuthOpen(true)}>
            Sign In / Sign Up Now
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
