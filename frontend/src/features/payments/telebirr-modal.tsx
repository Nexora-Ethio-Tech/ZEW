'use client';
import { Modal } from '@/components/modal';
import { Icon } from '@/components/icon';

interface TelebirrModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId?: string;
  groupId?: string;
  amount: number;
  routeLabel: string;
  onSuccess: () => void;
}
export function TelebirrModal({ isOpen, onClose, amount, routeLabel }: TelebirrModalProps) {
  if (!isOpen) return null;
  return (
    <Modal title="Payment unavailable" close={onClose}>
      <div className="payment-demo-notice">
        <Icon name="wallet" size={32} />
        <h3>{amount} ETB · illustrative fare</h3>
        <p>{routeLabel}</p>
        <p>
          No money is charged. Telebirr and bank payments are not connected, and Zew will never ask
          you to enter a payment PIN here.
        </p>
        <p>Complete the journey in driver space to record it in your private workspace.</p>
        <button className="primary full" onClick={onClose}>
          Back to the journey <Icon name="arrow" size={18} />
        </button>
      </div>
    </Modal>
  );
}
