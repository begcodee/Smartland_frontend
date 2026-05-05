import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Decentralized Land Registry',
  description: 'Blockchain-powered land dispute resolution platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
