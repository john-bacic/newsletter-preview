import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Newsletter Preview',
  description: 'Drag & drop CIBC Premium Edge newsletter folders to preview them',
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
