import assert from 'node:assert/strict';
import test from 'node:test';

import * as handlersModule from '../src/handlers.js';

const createHandlers = (captureSearch, captureProduct = async (page) => page) => {
    const queued = [];
    const output = [];
    const input = {
        searchUrl: 'https://shopee.com.br/search?keyword=fone',
        searchQuery: 'fone',
        categoryUrl: null,
        maxItems: 10,
    };
    const handlers = handlersModule.createActorHandlers?.({
        input,
        addRequests: async (requests) => queued.push(...requests),
        pushData: async (item) => output.push(item),
        captureSearch,
        captureProduct,
    }) ?? null;

    return { handlers, input, queued, output };
};

test('enqueues ranked product details and emits them in descending sales order', async () => {
    const searchSnapshot = {
        url: 'https://shopee.com.br/search?keyword=fone',
        title: 'Fones',
        bodyText: '',
        cards: [
            { url: 'https://shopee.com.br/fone-a-i.1.101', text: 'Fone A 20 vendidos' },
            { url: 'https://shopee.com.br/fone-b-i.1.102', text: 'Fone B 1.200 vendidos' },
        ],
    };
    const { handlers, input, queued, output } = createHandlers(async () => searchSnapshot);

    await handlers.requestHandler({
        page: {},
        request: { url: input.searchUrl, userData: { kind: 'search' } },
        log: { warning() {} },
    });

    assert.deepEqual(queued.map(({ url, userData }) => ({ url, userData })), [
        {
            url: 'https://shopee.com.br/fone-b-i.1.102',
            userData: { kind: 'product', soldCount: 1200, salesRank: 1 },
        },
        {
            url: 'https://shopee.com.br/fone-a-i.1.101',
            userData: { kind: 'product', soldCount: 20, salesRank: 2 },
        },
    ]);

    for (const request of [...queued].reverse()) {
        await handlers.requestHandler({
            page: {
                url: request.url,
                title: request.url,
                meta: {},
                jsonLd: [{ '@type': 'Product', sku: `sku-for-${request.userData.salesRank}` }],
                embeddedJson: [],
                domImages: [`https://cdn.example/${request.userData.salesRank}.jpg`],
                domVideos: [],
                bodyText: '',
            },
            request,
            log: { warning() {} },
        });
    }
    await handlers.flushResults();

    assert.deepEqual(output.map(({ id, url, soldCount, salesRank }) => ({ id, url, soldCount, salesRank })), [
        { id: '102', url: 'https://shopee.com.br/fone-b-i.1.102', soldCount: 1200, salesRank: 1 },
        { id: '101', url: 'https://shopee.com.br/fone-a-i.1.101', soldCount: 20, salesRank: 2 },
    ]);
});

test('emits a blocked search diagnostic without a product URL or detail requests', async () => {
    const { handlers, input, queued, output } = createHandlers(async () => ({
        url: 'https://shopee.com.br/verify/traffic/error?type=4',
        title: '',
        bodyText: '',
        cards: [{ url: 'https://shopee.com.br/item-i.1.2', text: '1.000 vendidos' }],
    }));

    await handlers.requestHandler({
        page: {},
        request: { url: input.searchUrl, userData: { kind: 'search' } },
        log: { warning() {} },
    });

    assert.equal(queued.length, 0);
    assert.equal(output.length, 1);
    assert.equal(output[0].scrapingStatus, 'blocked');
    assert.equal(output[0].searchUrl, input.searchUrl);
    assert.equal(Object.hasOwn(output[0], 'url'), false);
});

test('emits an empty-search diagnostic when the page has no product cards', async () => {
    const { handlers, input, queued, output } = createHandlers(async () => ({
        url: input.searchUrl,
        title: 'Busca',
        bodyText: 'Nenhum resultado',
        cards: [],
    }));

    await handlers.requestHandler({
        page: {},
        request: { url: input.searchUrl, userData: { kind: 'search' } },
        log: { warning() {} },
    });

    assert.equal(queued.length, 0);
    assert.equal(output.length, 1);
    assert.equal(output[0].scrapingStatus, 'empty');
    assert.equal(output[0].searchUrl, input.searchUrl);
    assert.equal(Object.hasOwn(output[0], 'url'), false);
});
