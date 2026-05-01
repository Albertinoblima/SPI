// Format Utilities

export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

export function formatPercentage(value: number, decimals = 1): string {
    return `${(value * 100).toFixed(decimals)}%`;
}

export function formatNumber(value: number, locale = 'pt-BR'): string {
    return value.toLocaleString(locale);
}

export function generateLocalId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
