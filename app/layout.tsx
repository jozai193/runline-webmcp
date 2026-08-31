import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { env } from 'cloudflare:workers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export function generateMetadata(): Metadata {
  // This is deployment configuration, never a visitor-supplied Host header.
  const origin =
    (env as unknown as { RUNLINE_PUBLIC_ORIGIN?: string })
      .RUNLINE_PUBLIC_ORIGIN ?? 'http://localhost:3000';
  const base = new URL(origin);
  const title = 'Runline — Your event, in sync';
  const description =
    'A human-agent event control room. Repair disrupted schedules, protect important decisions, and review every change before it goes live.';
  const image = new URL('/og.png', base).href;
  return {
    metadataBase: base,
    title,
    description,
    icons: { icon: '/favicon.svg' },
    openGraph: {
      type: 'website',
      title,
      description,
      url: base.href,
      siteName: 'Runline',
      images: [
        {
          url: image,
          width: 1536,
          height: 1024,
          alt: 'Runline. Your event, in sync. Human + agent. One shared plan.',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
