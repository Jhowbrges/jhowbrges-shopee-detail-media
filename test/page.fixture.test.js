import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as cheerio from 'cheerio';

import { rankSearchResults } from '../src/search.js';
import * as pageModule from '../src/page.js';

const SEARCH_URL = 'https://shopee.com.br/search?keyword=iphone+18';

function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function elementView(element) {
    return element.length ? { innerText: normalizeText(element.text()) } : null;
}

async function captureFixture(html) {
    const $ = cheerio.load(html);
    const anchors = $('a[href]').toArray().map((element) => {
        const anchor = $(element);
        return {
            href: new URL(anchor.attr('href'), SEARCH_URL).href,
            innerText: normalizeText(anchor.text()),
            closest: (selector) => elementView(anchor.closest(selector)),
            parentElement: elementView(anchor.parent()),
        };
    });

    const oldDocument = globalThis.document;
    const oldLocation = globalThis.location;
    globalThis.document = {
        title: $('title').text(),
        body: { innerText: normalizeText($('body').text()) },
        querySelectorAll: (selector) => selector === 'a[href]' ? anchors : [],
    };
    globalThis.location = { href: SEARCH_URL };

    try {
        return await pageModule.captureSearchPage({ evaluate: (callback) => callback() });
    } finally {
        if (oldDocument === undefined) delete globalThis.document;
        else globalThis.document = oldDocument;
        if (oldLocation === undefined) delete globalThis.location;
        else globalThis.location = oldLocation;
    }
}

test('captures and ranks product cards from the synthetic Shopee search HTML fixture', async () => {
    const html = await readFile(new URL('./fixtures/shopee-search-results.html', import.meta.url), 'utf8');
    const snapshot = await captureFixture(html);

    assert.equal(snapshot.url, SEARCH_URL);
    assert.equal(snapshot.title, 'Resultados de busca');
    assert.equal(snapshot.anchorCount, 3);
    assert.equal(snapshot.productCardCount, 2);
    assert.deepEqual(snapshot.cards, [
        {
            url: 'https://shopee.com.br/capa-protetora-iphone-18-i.123456789.111111',
            text: 'Capa protetora iPhone 18 1.234 vendidos',
        },
        {
            url: 'https://shopee.com.br/pelicula-iphone-i.123456789.222222',
            text: 'Película para iPhone 2,5 mil vendidos',
        },
    ]);

    assert.deepEqual(rankSearchResults(snapshot.cards, snapshot.url, 5).map(({ id, soldCount, salesRank }) => ({
        id,
        soldCount,
        salesRank,
    })), [
        { id: '222222', soldCount: 2500, salesRank: 1 },
        { id: '111111', soldCount: 1234, salesRank: 2 },
    ]);
});
