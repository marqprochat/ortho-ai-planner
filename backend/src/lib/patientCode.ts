// EasyDental usa codigo com 6 digitos e zeros a esquerda ("000653").
// O Planner pode ter gravado "653", "000653" ou com mascara — normalizamos os dois lados.
export const normalizeCode = (value?: string | null): string | null => {
    if (!value) return null;
    const digits = String(value).replace(/\D/g, '');
    if (!digits) return null;
    return digits.replace(/^0+/, '').padStart(6, '0');
};
