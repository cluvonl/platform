import type {Metadata, Viewport} from 'next';
import {PwaProvider} from '@/components/pwa/pwa-controls';

export const metadata: Metadata = {
  title: 'Cluvo — jouw club, samen',
  description: 'Je persoonlijke Cluvo-werkruimte op je telefoon.',
  manifest: '/app/manifest.webmanifest',
  icons: {icon: '/favicon.svg', apple: [{url: '/app/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png'}]},
  appleWebApp: {capable: true, title: 'Cluvo', statusBarStyle: 'default'},
  formatDetection: {telephone: false},
};
export const viewport: Viewport = {width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#111314'};

export default function MobileAppLayout({children}: {children: React.ReactNode}) {
  return <PwaProvider>{children}</PwaProvider>;
}
