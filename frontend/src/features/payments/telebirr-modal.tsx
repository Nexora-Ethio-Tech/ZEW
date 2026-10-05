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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-all">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-cyan-500/30 bg-slate-900/95 p-6 shadow-2xl shadow-cyan-950/50 backdrop-blur-xl text-white">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 font-extrabold text-white shadow-lg shadow-cyan-500/30">
              tb
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">telebirr</h3>
              <p className="text-xs text-cyan-400 font-medium">Digital Merchant Payout · Zew Share</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Fare Summary */}
        <div className="my-4 rounded-2xl bg-slate-800/60 p-4 border border-slate-700/50">
          <div className="flex justify-between items-center text-sm text-slate-300">
            <span>Trip Route:</span>
            <span className="font-semibold text-white">{routeLabel}</span>
          </div>
          <div className="mt-2 flex justify-between items-center">
            <span className="text-sm text-slate-300">Total Share Fare:</span>
            <span className="text-2xl font-black text-cyan-400">{amount} ETB</span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        {/* Step 1: Input Phone */}
        {step === 'input' && (
          <form onSubmit={handleInitiate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Telebirr Mobile Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0911234567"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3.5 font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Initiating Telebirr Push...' : 'Send Telebirr USSD Request'}
            </button>
          </form>
        )}

        {/* Step 2: USSD Push Notification & Simulated PIN */}
        {step === 'ussd_pushed' && (
          <form onSubmit={handleConfirmPin} className="space-y-4 animate-in fade-in duration-300">
            <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/30 p-3 text-xs text-cyan-200">
              ⚡ {noticeMessage}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Enter Simulated Telebirr 4-Digit PIN
              </label>
              <input
                type="password"
                maxLength={4}
                value={userPin}
                onChange={(e) => setUserPin(e.target.value)}
                placeholder="••••"
                required
                className="w-full text-center text-2xl tracking-widest rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3.5 font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-teal-500 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Verifying PIN...' : 'Confirm & Complete Payment'}
            </button>
          </form>
        )}

        {/* Step 3: Verified Success */}
        {step === 'success' && (
          <div className="py-6 text-center animate-in zoom-in-95 duration-300">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-3xl">
              ✓
            </div>
            <h4 className="mt-3 font-bold text-xl text-white">Payment Verified</h4>
            <p className="mt-1 text-xs text-slate-300">
              Telebirr Merchant Transaction Complete · {amount} ETB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
