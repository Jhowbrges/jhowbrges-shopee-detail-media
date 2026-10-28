import { extractProductData } from './media.js';
import {
    captureProductPage,
    captureSearchPage,
    clearChallengeMedia,
    getScrapingStatus,
    isTrafficVerificationPage,
} from './page.js';
import { rankSearchResults } from './search.js';

function searchDiagnostic(input, searchUrl, scrapingStatus, error, pageInfo = {}) {
    return {
        searchUrl,
        pageUrl: pageInfo.url ?? searchUrl,
        pageTitle: pageInfo.title ?? null,
        searchQuery: input.searchQuery,
        categoryUrl: input.categoryUrl,
        scrapingStatus,
        error,
    };
}

export function createActorHandlers({
    input,
    addRequests,
    pushData,
    captureSearch = captureSearchPage,
    captureProduct = captureProductPage,
}) {
    let rankedProducts = [];
    const detailResults = new Map();

    return {
        async requestHandler({ page, request, log }) {
            if (request.userData?.kind === 'product') {
                const snapshot = await captureProduct(page);
                const result = clearChallengeMedia(extractProductData(snapshot, request.url), snapshot);
                result.scrapingStatus = getScrapingStatus(snapshot, result);

                if (result.scrapingStatus === 'blocked') {
                    result.error = 'Shopee returned a traffic-verification page; the Actor stopped without bypassing it.';
                    log.warning(`Shopee blocked product access for ${request.url}`);
                } else if (!result.images.length) {
                    result.error = 'No public product image URL was exposed on the page.';
                    log.warning(`No public product images were found for ${request.url}`);
                }

                detailResults.set(request.url, result);
                return;
            }

            const snapshot = await captureSearch(page);
            if (isTrafficVerificationPage(snapshot)) {
                const error = 'Shopee returned a traffic-verification page; the Actor stopped without bypassing it.';
                log.warning(error);
                await pushData(searchDiagnostic(input, request.url, 'blocked', error, snapshot));
                return;
            }

            const products = rankSearchResults(snapshot.cards, snapshot.url || request.url, input.maxItems);
            if (products.length === 0) {
                const error = 'No public Shopee product cards were found on the search page.';
                log.warning(error);
                await pushData(searchDiagnostic(input, request.url, 'empty', error, snapshot));
                return;
            }

            const requests = products.map((product) => ({
                url: product.url,
                userData: {
                    kind: 'product',
                    soldCount: product.soldCount,
                    salesRank: product.salesRank,
                },
            }));
            await addRequests(requests);
            rankedProducts = products;
        },

        async recordFailedRequest(item) {
            if (item.url) {
                detailResults.set(item.url, item);
                return;
            }
            await pushData(item);
        },

        async flushResults() {
            for (const product of rankedProducts) {
                const result = detailResults.get(product.url) ?? {
                    id: product.id,
                    url: product.url,
                    title: null,
                    price: null,
                    sellerName: null,
                    sellerUrl: null,
                    images: [],
                    videos: [],
                    scrapingStatus: 'error',
                    error: 'No detail result was recorded for this product URL.',
                };
                await pushData({
                    ...result,
                    id: product.id,
                    soldCount: product.soldCount,
                    salesRank: product.salesRank,
                });
            }
        },
    };
}
