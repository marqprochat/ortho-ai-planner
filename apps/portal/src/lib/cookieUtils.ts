export const setCookie = (name: string, value: string, days = 7) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
    // Also store in localStorage for better persistence
    if (name === 'token') {
        try {
            localStorage.setItem(`${name}_expiry`, expires);
            localStorage.setItem(name, value);
        } catch (e) {
            console.warn('localStorage not available:', e);
        }
    }
};

export const getCookie = (name: string) => {
    // First try cookie
    const cookieValue = document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, '');
    
    if (cookieValue) return cookieValue;
    
    // Fallback to localStorage for token
    if (name === 'token') {
        try {
            return localStorage.getItem(name) || '';
        } catch (e) {
            console.warn('localStorage not available:', e);
            return '';
        }
    }
    
    return '';
};

export const removeCookie = (name: string) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    if (name === 'token') {
        try {
            localStorage.removeItem(name);
            localStorage.removeItem(`${name}_expiry`);
        } catch (e) {
            console.warn('localStorage not available:', e);
        }
    }
};
