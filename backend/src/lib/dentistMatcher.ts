import { normalizeCro } from './dentist';

export interface DentistTarget {
    id: string;
    name: string;
    cro: string;
}

export interface MatchResult {
    matched: boolean;
    score: number;
    reason: string;
}

const TITLE_TOKENS = new Set(['dr', 'dra', 'doutor', 'doutora', 'prof', 'profa', 'cd', 'dentista', 'ortodontista']);
const CONNECTOR_TOKENS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

const stripDiacritics = (value: string): string =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Normalizes a person name by stripping accents, punctuation, and leading titles.
 */
export const normalizePersonName = (value: string | null | undefined): string => {
    if (!value || typeof value !== 'string') return '';
    const tokens = stripDiacritics(value)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);

    while (tokens.length > 0 && TITLE_TOKENS.has(tokens[0])) {
        tokens.shift();
    }

    return tokens.join(' ').trim();
};

const getSignificantTokens = (normalizedName: string): string[] =>
    normalizedName
        .split(' ')
        .filter((token) => token.length > 0 && !CONNECTOR_TOKENS.has(token));

/**
 * Normalizes CRO strings for loose equality (e.g. "CRO-SP 12.345" -> "SP12345").
 */
export const normalizeCroCode = (cro: string | null | undefined): string => {
    const base = normalizeCro(cro);
    if (!base) return '';
    return base.replace(/^CRO[\s\-/:]*/i, '').replace(/[^A-Z0-9]/g, '');
};

const levenshtein = (a: string, b: string): number => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    const curr = new Array<number>(b.length + 1);

    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
    }

    return prev[b.length];
};

export const stringSimilarity = (a: string, b: string): number => {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const maxLen = Math.max(a.length, b.length);
    return (maxLen - levenshtein(a, b)) / maxLen;
};

/**
 * Evaluates whether a candidate name/CRO is likely the same dentist as `target`.
 */
export const matchDentistCandidate = (
    candidateName: string | null | undefined,
    candidateCro: string | null | undefined,
    target: DentistTarget
): MatchResult => {
    const targetCroCode = normalizeCroCode(target.cro);
    const candCroCode = normalizeCroCode(candidateCro);

    if (targetCroCode && candCroCode && targetCroCode === candCroCode) {
        return { matched: true, score: 1, reason: 'CRO exato' };
    }

    const normTarget = normalizePersonName(target.name);
    const normCand = normalizePersonName(candidateName);

    if (!normTarget || !normCand) {
        return { matched: false, score: 0, reason: '' };
    }

    if (normTarget === normCand) {
        return { matched: true, score: 1, reason: 'Nome exato' };
    }

    const targetTokens = getSignificantTokens(normTarget);
    const candTokens = getSignificantTokens(normCand);

    if (!targetTokens.length || !candTokens.length) {
        return { matched: false, score: 0, reason: '' };
    }

    const [shorter, longer] =
        candTokens.length <= targetTokens.length
            ? [candTokens, targetTokens]
            : [targetTokens, candTokens];

    // Subset containment when shorter name has at least 2 significant tokens (e.g. "Joao Silva" in "Joao Carlos da Silva")
    if (shorter.length >= 2) {
        const allContained = shorter.every((tok) =>
            longer.some((ltok) => ltok === tok || (tok.length >= 4 && ltok.length >= 4 && stringSimilarity(tok, ltok) >= 0.85))
        );
        if (allContained) {
            return { matched: true, score: 0.92, reason: 'Nome parcial compatível' };
        }
    }

    // Single-token candidate matching first name (e.g. "Dra. Maria" -> "Maria Souza")
    if (candTokens.length === 1 && candTokens[0].length >= 4 && candTokens[0] === targetTokens[0]) {
        return { matched: true, score: 0.7, reason: 'Primeiro nome compatível (revisar)' };
    }

    // Full-string similarity (typos like "Joao Siva" vs "Joao Silva")
    const fullSim = stringSimilarity(normCand, normTarget);
    if (fullSim >= 0.78 && Math.min(normCand.length, normTarget.length) >= 5) {
        return {
            matched: true,
            score: Math.round(fullSim * 100) / 100,
            reason: 'Grafia semelhante',
        };
    }

    // First + last token similarity when both have >= 2 tokens
    if (candTokens.length >= 2 && targetTokens.length >= 2) {
        const firstSim = stringSimilarity(candTokens[0], targetTokens[0]);
        const lastSim = stringSimilarity(candTokens[candTokens.length - 1], targetTokens[targetTokens.length - 1]);
        if (firstSim >= 0.82 && lastSim >= 0.78) {
            const combined = Math.round(((firstSim + lastSim) / 2) * 100) / 100;
            return { matched: true, score: combined, reason: 'Nome e sobrenome semelhantes' };
        }
    }

    return { matched: false, score: 0, reason: '' };
};

export interface ReportDentistInfo {
    name: string | null;
    cro: string | null;
}

const REPORT_DENTIST_LINE_RE = /^(\s*-\s*Ortodontista\s*:\s*)(.*)$/im;
const REPORT_CRO_LINE_RE = /^(\s*-\s*CRO\s*:\s*)(.*)$/im;

/**
 * Extracts dentist name/CRO from a planning's `originalReport` markdown/text block.
 */
export const extractReportDentistInfo = (report: string | null | undefined): ReportDentistInfo => {
    if (!report) return { name: null, cro: null };
    const nameMatch = report.match(REPORT_DENTIST_LINE_RE);
    const croMatch = report.match(REPORT_CRO_LINE_RE);
    return {
        name: nameMatch ? nameMatch[2].trim() || null : null,
        cro: croMatch ? croMatch[2].trim() || null : null,
    };
};

/**
 * Updates `- Ortodontista:` and `- CRO:` lines in `originalReport` when present.
 */
export const replaceReportDentistInfo = (report: string, target: DentistTarget): string => {
    let next = report;
    if (REPORT_DENTIST_LINE_RE.test(next)) {
        next = next.replace(REPORT_DENTIST_LINE_RE, `$1${target.name}`);
    }
    if (REPORT_CRO_LINE_RE.test(next)) {
        next = next.replace(REPORT_CRO_LINE_RE, `$1${target.cro}`);
    }
    return next;
};

export interface ContractDentistMatch {
    matched: boolean;
    currentName: string;
    currentCro: string | null;
    score: number;
    reason: string;
    snippet: string;
    updatedContent: string;
}

const CONTRACT_LABEL_RE = /^(\s*(?:Dentista|Ortodontista|Profissional(?:\s+Responsável)?)\s*:\s*)(.+)$/gim;
const CONTRACT_CRO_LINE_RE = /^(\s*CRO(?:\s+do\s+(?:Dentista|Ortodontista|Profissional))?\s*:\s*)(.+)$/gim;
const CONTRACT_DR_RE = /\b(Dr\.?|Dra\.?)\s+([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+(?:da|de|do|das|dos|e|[A-ZÀ-Ý][a-zà-ÿ]+)){0,4})/g;

/**
 * Inspects contract text for explicit dentist labels or `Dr(a). <Name>` mentions matching `target`.
 */
export const analyzeContractDentistText = (
    content: string | null | undefined,
    target: DentistTarget
): ContractDentistMatch | null => {
    if (!content || typeof content !== 'string') return null;

    let bestScore = 0;
    let bestReason = '';
    let currentName = '';
    let currentCro: string | null = null;
    let snippet = '';
    let updatedContent = content;
    let changed = false;

    // 1. Check CRO lines adjacent/present in contract text (for display & update)
    const croMatches = [...content.matchAll(CONTRACT_CRO_LINE_RE)];
    if (croMatches.length > 0) {
        currentCro = croMatches[0][2].trim() || null;
    }

    // 2. Explicit labeled lines (`Dentista: ...`, `Ortodontista: ...`)
    updatedContent = updatedContent.replace(CONTRACT_LABEL_RE, (full, prefix: string, rawName: string) => {
        const trimmed = rawName.trim();
        const res = matchDentistCandidate(trimmed, currentCro, target);
        if (!res.matched) return full;

        if (res.score >= bestScore) {
            bestScore = res.score;
            bestReason = res.reason;
            currentName = trimmed;
            snippet = full.trim();
        }
        if (trimmed !== target.name) {
            changed = true;
            return `${prefix}${target.name}`;
        }
        return full;
    });

    // Update explicit CRO line if we matched a dentist in the contract and CRO differs
    if (bestScore > 0) {
        updatedContent = updatedContent.replace(CONTRACT_CRO_LINE_RE, (full, prefix: string, rawCro: string) => {
            if (rawCro.trim() !== target.cro) {
                changed = true;
                return `${prefix}${target.cro}`;
            }
            return full;
        });
    }

    // 3. Fallback: inline `Dr./Dra. <Name>` mentions if no explicit label matched
    if (bestScore === 0) {
        updatedContent = updatedContent.replace(CONTRACT_DR_RE, (full, _title: string, rawName: string) => {
            const res = matchDentistCandidate(full, null, target);
            if (!res.matched) return full;
            if (res.score >= bestScore) {
                bestScore = res.score;
                bestReason = res.reason;
                currentName = full.trim();
                snippet = full.trim();
            }
            if (rawName.trim() !== target.name && full.trim() !== target.name) {
                changed = true;
                return target.name;
            }
            return full;
        });
    }

    if (bestScore === 0 || !changed) return null;

    return {
        matched: true,
        currentName,
        currentCro,
        score: bestScore,
        reason: bestReason,
        snippet,
        updatedContent,
    };
};

