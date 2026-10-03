import type { Metadata } from 'next';
import './styles.css';
import { Pwa } from '@/components/pwa';

export const metadata: Metadata = {
  title: 'Zew — Go your way, together',
  description:
    'Choose any pickup and destination. Find people going your way and share the fare. Interactive ride demo.',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
