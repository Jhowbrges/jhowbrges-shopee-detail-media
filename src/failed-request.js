import { extractProductData } from './media.js';

export function createFailedRequestHandler(pushData) {
    return async ({ request, log }, error) => {
        const message = error instanceof Error ? error.message : String(error ?? 'Request failed without an error message');
        const pageType = request.userData?.kind === 'search' ? 'search page' : 'product page';
        log.warning(`Could not load Shopee ${pageType}: ${message}`);

        if (request.userData?.kind === 'search') {
            await pushData({
                searchUrl: request.url,
                pageUrl: request.url,
                pageTitle: null,
                searchQuery: request.userData.searchQuery ?? null,
                categoryUrl: request.userData.categoryUrl ?? null,
                scrapingStatus: 'error',
                error: message,
            });
            return;
        }

        await pushData({
            ...extractProductData({}, request.url),
            soldCount: request.userData?.soldCount ?? null,
            salesRank: request.userData?.salesRank ?? null,
            scrapingStatus: 'error',
            error: message,
        });
    };
}
