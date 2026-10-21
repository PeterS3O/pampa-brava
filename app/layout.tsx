import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://pampa-brava.granddrake64.chatgpt.site'),
  title: 'Pampa Brava — Juego de mesa digital',
  description: 'Prototipo digital jugable de Pampa Brava para dos jugadores.',
  openGraph: {
    title: 'Pampa Brava — Juego de mesa digital',
    description: 'La tierra decide. La astucia conquista.',
    type: 'website',
    images: [{ url: '/og.png', width: 1536, height: 915, alt: 'Pampa Brava' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pampa Brava — Juego de mesa digital',
    description: 'La tierra decide. La astucia conquista.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
