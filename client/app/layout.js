import { Barlow_Condensed, Rubik } from 'next/font/google';
import './globals.css';
import { GameProvider } from '@/components/GameProvider';
import SiteHeader from '@/components/SiteHeader';

const display = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const body = Rubik({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata = {
  title: 'random1v1 | Find a Fortnite 1v1 right now',
  description:
    'Get paired with a random Fortnite player in your region for Box Fights, Zone Wars, or Realistics. Swap island codes in chat and play.',
};

export const viewport = {
  themeColor: '#120C2B',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen bg-storm-950 font-sans text-ice antialiased">
        <GameProvider>
          <SiteHeader />
          {children}
        </GameProvider>
      </body>
    </html>
  );
}
