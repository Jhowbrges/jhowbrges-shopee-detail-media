const ALLOWED_HOSTS = new Set(['shopee.com.br', 'www.shopee.com.br']);
const PRODUCT_PATH = /(?:^|[-/])i\.(\d+)\.(\d+)(?:\/|$)/i;
const SALES_LABEL = /(?:vendidos?|vendas|sold)\b/i;

function parseLocalizedCount(value, multiplier) {
    let normalized = value.replace(/\s/g, '');
    if (!normalized || !/^[\d.,]+$/.test(normalized)) return null;

    if (normalized.includes('.') && normalized.includes(',')) {
        normalized = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
            ? normalized.replace(/\./g, '').replace(',', '.')
            : normalized.replace(/,/g, '');
    } else if (normalized.includes(',') || normalized.includes('.')) {
        const separator = normalized.includes(',') ? ',' : '.';
        const decimalDigits = normalized.length - normalized.lastIndexOf(separator) - 1;
        if (multiplier && decimalDigits <= 2) {
            normalized = normalized.replace(separator, '.');
        } else if (decimalDigits === 3 || !multiplier) {
            normalized = normalized.replace(/[.,]/g, '');
        } else {
            normalized = normalized.replace(separator, '.');
        }
    }

    const count = Number(normalized) * multiplier;
    return Number.isFinite(count) && count >= 0 ? Math.round(count) : null;
}

export function parseSoldCount(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
    }
    if (typeof value !== 'string') return null;

    const text = value.trim().toLowerCase();
    const labelIndex = text.search(SALES_LABEL);
    if (labelIndex < 0 && !/^\d[\d.,]*(?:\s*(?:milh(?:ão|ões)|mil|k|m))?$/i.test(text)) return null;
    const prefix = labelIndex >= 0 ? text.slice(0, labelIndex) : text;
    const match = prefix.match(/(\d[\d.,]*(?:\s*(?:milh(?:ão|ões)|mil|k|m))?)\s*$/i);
    if (!match) return null;

    const token = match[1].trim();
    const suffix = token.match(/(milh(?:ão|ões)|mil|k|m)$/i)?.[1]?.toLowerCase() ?? '';
    const multiplier = suffix.startsWith('milh') ? 1_000_000 : (suffix ? 1_000 : 1);
    const number = suffix ? token.slice(0, -suffix.length).trim() : token;
    return parseLocalizedCount(number, multiplier);
}

function normalizeProductUrl(value, baseUrl) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const url = new URL(value, baseUrl);
        const match = url.pathname.match(PRODUCT_PATH);
        if (!['http:', 'https:'].includes(url.protocol)
            || url.username.length > 0
            || url.password.length > 0
            || url.port.length > 0
            || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())
            || !match) return null;
        url.search = '';
        url.hash = '';
        return { id: match[2], key: `${match[1]}.${match[2]}`, url: url.href };
    } catch {
        return null;
    }
}

export function rankSearchResults(entries, baseUrl, maxItems) {
    if (!Array.isArray(entries)) return [];
    const byProduct = new Map();

    entries.forEach((entry, sourceIndex) => {
        const product = normalizeProductUrl(entry?.url, baseUrl);
        if (!product) return;
        const soldCount = parseSoldCount(entry.soldCount ?? entry.salesText ?? entry.text);
        const current = byProduct.get(product.key);
        if (!current) {
            byProduct.set(product.key, { ...product, soldCount, sourceIndex });
        } else if (current.soldCount == null && soldCount != null) {
            current.soldCount = soldCount;
        }
    });

    return [...byProduct.values()]
        .sort((left, right) => {
            if (left.soldCount == null && right.soldCount != null) return 1;
            if (left.soldCount != null && right.soldCount == null) return -1;
            if (left.soldCount != null && right.soldCount != null && left.soldCount !== right.soldCount) {
                return right.soldCount - left.soldCount;
            }
            return left.sourceIndex - right.sourceIndex;
        })
        .slice(0, maxItems)
        .map((product, index) => ({
            id: product.id,
            url: product.url,
            soldCount: product.soldCount,
            salesRank: product.soldCount == null ? null : index + 1,
        }));
}
