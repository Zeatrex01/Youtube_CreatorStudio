import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Kurgu Analizcisi - Video Kurgu & Akış Analiz Aracı',
  description: 'YouTube videolarının kurgu stillerini karşılaştırarak iyileştirme önerileri sunan AI aracı.',
  openGraph: {
    title: 'Kurgu Analizcisi - Video Kurgu & Akış Analiz Aracı',
    description: 'YouTube videolarının kurgu stillerini karşılaştırarak iyileştirme önerileri sunan AI aracı.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
