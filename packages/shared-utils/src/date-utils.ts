// Date Utilities

export function formatDate(date: Date | string, locale = 'pt-BR'): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

export function formatDateTime(date: Date | string, locale = 'pt-BR'): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function isExpired(date: Date | string): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.getTime() < Date.now();
}

export function daysBetween(start: Date | string, end: Date | string): number {
    const s = typeof start === 'string' ? new Date(start) : start;
    const e = typeof end === 'string' ? new Date(end) : end;
    const diffMs = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
