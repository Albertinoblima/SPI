import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import '@/styles/globals.css';

export const metadata: Metadata = {
    title: 'iDialog SPI - Sistema de Pesquisa Inteligente',
    description: 'Plataforma iDialog para gestão de pesquisas e análises',
    icons: {
        icon: '/spi_icone.png',
        shortcut: '/spi_icone.png',
        apple: '/spi_icone.png',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pt-BR">
            <body>
                {children}
                <Analytics />
            </body>
        </html>
    );
}
