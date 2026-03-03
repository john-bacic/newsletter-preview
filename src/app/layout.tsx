import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Newsletter Preview',
  description: 'CIBC Premium Edge Newsletter Preview Server',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, fontFamily: "'Open Sans', Arial, sans-serif" }}>{children}</body>
    </html>
  );
}
