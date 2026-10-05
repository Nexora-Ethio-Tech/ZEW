'use client';

import { useState } from 'react';
import { initiateTelebirrPayment } from '../../lib/api';

interface TelebirrModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId?: string;
  groupId?: string;
  amount: number;
  routeLabel: string;
  onSuccess: () => void;
}

export function TelebirrModal({
  isOpen,
  onClose,
  bookingId,
  groupId,
  amount,
  routeLabel,
  onSuccess,
}: TelebirrModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('0911234567');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'ussd_pushed' | 'success'>('input');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [userPin, setUserPin] = useState('');

  if (!isOpen) return null;

  async function handleInitiate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await initiateTelebirrPayment({
        phoneNumber,
        amount,
        bookingId,
        groupId,
      });

      setNoticeMessage(res.ussdPushNotice);
      setStep('ussd_pushed');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Telebirr payment initiation failed');
    } finally {
      setLoading(false);
    }
  }

  function handleConfirmPin(e: React.FormEvent) {
    e.preventDefault();
    if (userPin.length < 4) {
      setErrorMsg('Enter your 4-digit Telebirr PIN');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('success');
      setTimeout(() => {
        onSuccess();
        onClose();
        setStep('input');
        setUserPin('');
      }, 1500);
    }, 1200);
  }

  return (
    <div className="telebirr-modal-overlay">
      <div className="telebirr-modal-card">
        {/* Brand Header */}
        <div className="telebirr-header">
          <div className="telebirr-brand">
            <div className="telebirr-logo-badge">tb</div>
            <div>
              <h3>telebirr</h3>
              <p>Digital Merchant Payout · Zew Share</p>
            </div>
          </div>
          <button onClick={onClose} className="telebirr-close-btn" aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Fare Summary */}
        <div className="telebirr-summary">
          <div className="telebirr-summary-row">
            <span>Trip Route:</span>
            <strong>{routeLabel}</strong>
          </div>
          <div className="telebirr-summary-row telebirr-amount-row">
            <span>Total Share Fare:</span>
            <strong className="telebirr-amount">{amount} ETB</strong>
          </div>
        </div>

        {errorMsg && <div className="telebirr-error">{errorMsg}</div>}

        {/* Step 1: Input Phone */}
        {step === 'input' && (
          <form onSubmit={handleInitiate} className="telebirr-form">
            <div className="telebirr-input-group">
              <label>Telebirr Mobile Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0911234567"
                required
                className="telebirr-input"
              />
            </div>

            <button type="submit" disabled={loading} className="telebirr-submit-btn">
              {loading ? 'Initiating Telebirr Push...' : 'Send Telebirr USSD Request'}
            </button>
          </form>
        )}

        {/* Step 2: USSD Push Notification & Simulated PIN */}
        {step === 'ussd_pushed' && (
          <form onSubmit={handleConfirmPin} className="telebirr-form telebirr-animate-in">
            <div className="telebirr-notice">⚡ {noticeMessage}</div>

            <div className="telebirr-input-group">
              <label>Enter Simulated Telebirr 4-Digit PIN</label>
              <input
                type="password"
                maxLength={4}
                value={userPin}
                onChange={(e) => setUserPin(e.target.value)}
                placeholder="••••"
                required
                className="telebirr-input telebirr-pin-input"
              />
            </div>

            <button type="submit" disabled={loading} className="telebirr-submit-btn telebirr-confirm-btn">
              {loading ? 'Verifying PIN...' : 'Confirm & Complete Payment'}
            </button>
          </form>
        )}

        {/* Step 3: Verified Success */}
        {step === 'success' && (
          <div className="telebirr-success telebirr-animate-in">
            <div className="telebirr-success-icon">✓</div>
            <h4>Payment Verified</h4>
            <p>Telebirr Merchant Transaction Complete · {amount} ETB</p>
          </div>
        )}
      </div>
    </div>
  );
}
