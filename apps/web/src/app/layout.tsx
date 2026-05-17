import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import '@/styles/globals.css';
import GlobalErrorMonitor from '@/components/monitoring/GlobalErrorMonitor';

export const metadata: Metadata = {
    title: 'iDialog SPI - Sistema de Pesquisa Inteligente',
    description: 'Plataforma iDialog para gestão de pesquisas e análises',
    icons: {
        icon: '/spi_icone.png',
        shortcut: '/spi_icone.png',
        apple: '/spi_icone.png',
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#ffffff' },
        { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
    ],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pt-BR">
            <body>
                <GlobalErrorMonitor />
                {children}
                <Analytics />
            </body>
        </html>
    );
}
