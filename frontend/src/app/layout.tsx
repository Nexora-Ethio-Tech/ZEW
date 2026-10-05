import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
