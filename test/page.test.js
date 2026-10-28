import assert from 'node:assert/strict';
import test from 'node:test';

import * as pageModule from '../src/page.js';

const isBlocked = (page) => pageModule.isTrafficVerificationPage?.(page) ?? null;
const status = (page, product) => pageModule.getScrapingStatus?.(page, product) ?? null;
const clearChallengeMedia = (product, page) => pageModule.clearChallengeMedia?.(product, page) ?? null;
const captureSearchPage = (page) => pageModule.captureSearchPage?.(page) ?? null;

test('detects Shopee traffic verification by URL and visible challenge text', () => {
    assert.equal(isBlocked({ url: 'https://shopee.com.br/verify/traffic/error?type=4', title: '', bodyText: '' }), true);
    assert.equal(isBlocked({ url: 'https://shopee.com.br/product-i.1.2', title: 'Aguarde', bodyText: 'Verificação de tráfego' }), true);
    assert.equal(isBlocked({ url: 'https://shopee.com.br/product-i.1.2', title: '', bodyText: 'Please complete the CAPTCHA' }), true);
});

test('does not classify an ordinary product page as a traffic challenge', () => {
    assert.equal(isBlocked({
        url: 'https://shopee.com.br/batom-i.1.2',
        title: 'Batom Ruby',
        bodyText: 'Produto disponível para compra',
    }), false);
});

test('reports traffic verification as blocked, image results as ok, and missing images as partial', () => {
    assert.equal(status(
        { url: 'https://shopee.com.br/verify/traffic/error?type=4' },
        { images: ['https://cdn.example/item.jpg'] },
    ), 'blocked');
    assert.equal(status(
        { url: 'https://shopee.com.br/product-i.1.2' },
        { images: ['https://cdn.example/item.jpg'] },
    ), 'ok');
    assert.equal(status(
        { url: 'https://shopee.com.br/product-i.1.2' },
        { images: [] },
    ), 'partial');
});

test('does not expose traffic-verification images or videos as product media', () => {
    const product = {
        id: '9',
        url: 'https://shopee.com.br/produto-i.2.9',
        images: ['https://cdn.example/captcha.jpg'],
        videos: ['https://cdn.example/challenge.mp4'],
    };

    assert.deepEqual(clearChallengeMedia(product, {
        url: 'https://shopee.com.br/verify/traffic/error?type=4',
    }), {
        ...product,
        images: [],
        videos: [],
    });
});

test('captures search product links with their nearest card text for sales ranking', async () => {
    const productCard = { innerText: 'Fone bluetooth 1.234 vendidos' };
    const productAnchor = {
        href: 'https://shopee.com.br/fone-i.1.12',
        innerText: 'Fone bluetooth',
        closest: () => productCard,
        parentElement: productCard,
    };
    const unrelatedAnchor = {
        href: 'https://shopee.com.br/search?keyword=fone',
        innerText: 'Mais resultados',
        closest: () => null,
        parentElement: { innerText: 'Mais resultados' },
    };
    const documentValue = {
        title: 'Busca por fone',
        body: { innerText: 'Resultados de busca' },
        querySelectorAll: () => [productAnchor, unrelatedAnchor],
    };
    const previousDocument = globalThis.document;
    const previousLocation = globalThis.location;
    globalThis.document = documentValue;
    globalThis.location = { href: 'https://shopee.com.br/search?keyword=fone' };

    try {
        const snapshot = await captureSearchPage({ evaluate: (callback) => callback() });
        assert.deepEqual(snapshot, {
            url: 'https://shopee.com.br/search?keyword=fone',
            title: 'Busca por fone',
            bodyText: 'Resultados de busca',
            cards: [{ url: 'https://shopee.com.br/fone-i.1.12', text: 'Fone bluetooth 1.234 vendidos' }],
        });
    } finally {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        if (previousLocation === undefined) delete globalThis.location;
        else globalThis.location = previousLocation;
    }
});
