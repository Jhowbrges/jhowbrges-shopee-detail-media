import assert from 'node:assert/strict';
import test from 'node:test';

import * as failedRequest from '../src/failed-request.js';

test('stores a failed product result with the Crawlee error argument', async () => {
    const pushed = [];
    const warnings = [];
    const handler = failedRequest.createFailedRequestHandler(async (item) => pushed.push(item));

    await handler({
        request: { url: 'https://shopee.com.br/produto-i.2.9' },
        log: { warning: (message) => warnings.push(message) },
    }, new Error('navigation timeout'));

    assert.equal(pushed.length, 1);
    assert.equal(pushed[0].scrapingStatus, 'error');
    assert.equal(pushed[0].error, 'navigation timeout');
    assert.equal(pushed[0].url, 'https://shopee.com.br/produto-i.2.9');
    assert.match(warnings[0], /navigation timeout/);
});

test('reports failed search navigation without emitting a product URL', async () => {
    const pushed = [];
    const warnings = [];
    const handler = failedRequest.createFailedRequestHandler(async (item) => pushed.push(item));

    await handler({
        request: {
            url: 'https://shopee.com.br/search?keyword=fone',
            userData: { kind: 'search', searchQuery: 'fone', categoryUrl: null },
        },
        log: { warning: (message) => warnings.push(message) },
    }, new Error('navigation timeout'));

    assert.deepEqual(pushed, [{
        searchUrl: 'https://shopee.com.br/search?keyword=fone',
        pageUrl: 'https://shopee.com.br/search?keyword=fone',
        pageTitle: null,
        searchQuery: 'fone',
        categoryUrl: null,
        scrapingStatus: 'error',
        error: 'navigation timeout',
    }]);
    assert.match(warnings[0], /Shopee search page/);
});

test('preserves sales count and rank when a product detail request fails', async () => {
    let result;
    const handler = failedRequest.createFailedRequestHandler(async (item) => { result = item; });

    await handler({
        request: {
            url: 'https://shopee.com.br/produto-i.2.9',
            userData: { soldCount: 1200, salesRank: 1 },
        },
        log: { warning() {} },
    }, new Error('navigation timeout'));

    assert.equal(result.soldCount, 1200);
    assert.equal(result.salesRank, 1);
});
