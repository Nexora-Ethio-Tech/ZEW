import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zew Shared Commute',
    short_name: 'Zew',
    description: 'Find people going your way and share the fare.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fffaf2',
    theme_color: '#285943',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
