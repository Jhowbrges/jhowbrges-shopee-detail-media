const MAX_ITEMS = 50;
const DEFAULT_MAX_ITEMS = 20;
const ALLOWED_HOSTS = new Set(['shopee.com.br', 'www.shopee.com.br']);
const CATEGORY_PATH = /(?:^|[-/])(?:cat|category|categoria)[./-]?\d+(?:[-/]|$)/i;
const CATEGORY_PARAMS = ['catid', 'category', 'categoryid', 'category_id'];

export function normalizeInput(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Provide one searchQuery or categoryUrl for Shopee Brazil.');
    }

    const searchQuery = typeof input.searchQuery === 'string' ? input.searchQuery.trim() : '';
    const categoryValue = typeof input.categoryUrl === 'string' ? input.categoryUrl.trim() : '';
    if (searchQuery && categoryValue) {
        throw new Error('Provide only one of searchQuery or categoryUrl.');
    }
    if (!searchQuery && !categoryValue) {
        throw new Error('Provide one non-empty searchQuery or categoryUrl for Shopee Brazil.');
    }
    if (input.searchQuery != null && typeof input.searchQuery !== 'string') {
        throw new Error('searchQuery must be a non-empty string.');
    }
    if (input.categoryUrl != null && typeof input.categoryUrl !== 'string') {
        throw new Error('categoryUrl must be a Shopee Brazil category URL.');
    }

    const maxItems = input.maxItems ?? DEFAULT_MAX_ITEMS;
    if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > MAX_ITEMS) {
        throw new Error(`maxItems must be an integer from 1 to ${MAX_ITEMS}.`);
    }

    if (searchQuery) {
        const searchUrl = new URL('/search', 'https://shopee.com.br');
        searchUrl.searchParams.set('keyword', searchQuery);
        return { searchUrl: searchUrl.href, searchQuery, categoryUrl: null, maxItems };
    }

    let categoryUrl;
    try {
        categoryUrl = new URL(categoryValue);
    } catch {
        throw new Error('categoryUrl must be a valid Shopee Brazil category URL.');
    }
    const hasCategoryId = CATEGORY_PATH.test(categoryUrl.pathname)
        || CATEGORY_PARAMS.some((key) => /^\d+$/.test(categoryUrl.searchParams.get(key) ?? ''));
    if (!['http:', 'https:'].includes(categoryUrl.protocol)
        || categoryUrl.username.length > 0
        || categoryUrl.password.length > 0
        || categoryUrl.port.length > 0
        || !ALLOWED_HOSTS.has(categoryUrl.hostname.toLowerCase())
        || !hasCategoryId) {
        throw new Error('categoryUrl must be a Shopee Brazil category URL containing a category ID.');
    }
    categoryUrl.hash = '';
    return { searchUrl: categoryUrl.href, searchQuery: null, categoryUrl: categoryUrl.href, maxItems };
}
