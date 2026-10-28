import assert from 'node:assert/strict';
import test from 'node:test';

import * as searchModule from '../src/search.js';

const parseSoldCount = (value) => searchModule.parseSoldCount?.(value) ?? null;
const rankSearchResults = (results, baseUrl, maxItems) => searchModule.rankSearchResults?.(results, baseUrl, maxItems) ?? null;

test('parses numeric and localized Shopee sales labels', () => {
    assert.equal(parseSoldCount(42), 42);
    assert.equal(parseSoldCount('1.234 vendidos'), 1234);
    assert.equal(parseSoldCount('1,2 mil vendidos'), 1200);
    assert.equal(parseSoldCount('2.5k sold'), 2500);
    assert.equal(parseSoldCount('sem vendas exibidas'), null);
    assert.equal(parseSoldCount('Smart TV 55'), null);
    assert.equal(parseSoldCount('1.2k'), 1200);
});

test('ranks unique Shopee products by sold count, stably places unknown counts last, and applies maxItems', () => {
    const ranked = rankSearchResults([
        { url: '/fone-a-i.1.101', text: 'Fone A 20 vendidos' },
        { url: 'https://shopee.com.br/fone-b-i.1.102', text: 'Fone B 1,2 mil vendidos' },
        { url: '/fone-c-i.1.103', text: 'Fone C sem dados de venda' },
        { url: '/fone-a-i.1.101?tracking=duplicate', text: 'Fone A 20 vendidos' },
        { url: 'https://example.com/fone-i.1.999', text: '999 vendidos' },
    ], 'https://shopee.com.br/search?keyword=fone', 3);

    assert.deepEqual(ranked, [
        { id: '102', url: 'https://shopee.com.br/fone-b-i.1.102', soldCount: 1200, salesRank: 1 },
        { id: '101', url: 'https://shopee.com.br/fone-a-i.1.101', soldCount: 20, salesRank: 2 },
        { id: '103', url: 'https://shopee.com.br/fone-c-i.1.103', soldCount: null, salesRank: null },
    ]);
});

test('keeps source order for equal known sales counts', () => {
    const ranked = rankSearchResults([
        { url: '/item-a-i.7.1', text: '10 vendidos' },
        { url: '/item-b-i.7.2', text: '10 vendidos' },
    ], 'https://shopee.com.br/search?keyword=item', 10);

    assert.deepEqual(ranked.map(({ id, salesRank }) => ({ id, salesRank })), [
        { id: '1', salesRank: 1 },
        { id: '2', salesRank: 2 },
    ]);
});
