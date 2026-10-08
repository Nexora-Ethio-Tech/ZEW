import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/outfit';
import '@fontsource-variable/noto-sans-ethiopic';
import '@fontsource-variable/plus-jakarta-sans';
import 'leaflet/dist/leaflet.css';
import '../features/pool/pool.css';
import './styles.css';
import { Pwa } from '@/components/pwa';

export const metadata: Metadata = {
  title: 'Zew — Go your way, together',
  description:
    'Choose any pickup and destination. Find people going your way and share the fare. Interactive ride demo.',
  applicationName: 'Zew',
  openGraph: {
    title: 'Zew — Go your way, together',
    description: 'A shared-ride idea for Addis. Explore the private interactive demo.',
    type: 'website',
  },
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#214839' };

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
