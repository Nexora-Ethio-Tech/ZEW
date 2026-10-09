import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/outfit';
import '@fontsource-variable/noto-sans-ethiopic';
import '@fontsource-variable/plus-jakarta-sans';
import 'leaflet/dist/leaflet.css';
import '@/components/route-map.css';
import './styles.css';
import { Pwa } from '@/components/pwa';
import { AppearanceControls } from '@/components/appearance-controls';

export const metadata: Metadata = {
  title: 'Zew — Go your way, together',
  description:
    'Choose a pickup and destination, choose your departure and seats, and compare planned rides in Addis Ababa.',
  applicationName: 'Zew',
  openGraph: {
    title: 'Zew — Go your way, together',
    description:
      'Explore shared journeys in Addis Ababa. Live ride requests and payments are not connected.',
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
        <AppearanceControls />
        <Pwa />
      </body>
    </html>
  );
}
