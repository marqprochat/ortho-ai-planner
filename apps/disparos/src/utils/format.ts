export function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
}

/**
 * Formata uma data pura ("YYYY-MM-DD") sem passar por Date, evitando o
 * deslocamento de um dia causado pelo parse em UTC.
 */
export function formatDateOnly(ymd: string) {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('T')[0].split('-');
    if (!y || !m || !d) return ymd;
    return `${d}/${m}/${y}`;
}
