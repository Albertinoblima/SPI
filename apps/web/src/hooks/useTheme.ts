'use client';

import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'spi-theme';

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>('light');

    // Inicializa a partir do localStorage (evita flash)
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
        if (saved === 'dark' || saved === 'light') {
            setThemeState(saved);
        }
    }, []);

    // Aplica/remove classe 'dark' no elemento raiz do dashboard
    // (não no <html> global para não interferir no painel admin)

    const setTheme = useCallback((next: Theme) => {
        setThemeState(next);
        localStorage.setItem(STORAGE_KEY, next);
    }, []);

    const toggle = useCallback(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    }, [theme, setTheme]);

    return { theme, toggle, setTheme };
}
