import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
    title: 'iDialog SPI - Sistema de Pesquisa Inteligente',
    description: 'Plataforma iDialog para gestão de pesquisas e análises',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pt-BR">
            <body>{children}</body>
        </html>
    );
}
