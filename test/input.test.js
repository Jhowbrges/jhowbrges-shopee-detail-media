import assert from 'node:assert/strict';
import test from 'node:test';

import * as inputModule from '../src/input.js';

const normalize = (input) => inputModule.normalizeInput?.(input) ?? null;

test('builds a Shopee Brazil search URL from a trimmed product-name query', () => {
    assert.deepEqual(normalize({ searchQuery: '  fone bluetooth  ' }), {
        searchUrl: 'https://shopee.com.br/search?keyword=fone+bluetooth',
        searchQuery: 'fone bluetooth',
        categoryUrl: null,
        maxItems: 20,
    });
});

test('accepts a Shopee Brazil category URL that contains its category ID', () => {
    const categoryUrl = 'https://shopee.com.br/beleza-cat.11036670';
    assert.deepEqual(normalize({ categoryUrl, maxItems: 5 }), {
        searchUrl: categoryUrl,
        searchQuery: null,
        categoryUrl,
        maxItems: 5,
    });

    const nestedCategoryUrl = 'https://shopee.com.br/category/11036670/';
    assert.deepEqual(normalize({ categoryUrl: nestedCategoryUrl }), {
        searchUrl: nestedCategoryUrl,
        searchQuery: null,
        categoryUrl: nestedCategoryUrl,
        maxItems: 20,
    });
});

test('requires exactly one valid search query or Shopee category URL', () => {
    assert.throws(() => normalize({}), /searchQuery or categoryUrl/i);
    assert.throws(() => normalize({ searchQuery: '   ' }), /searchQuery or categoryUrl/i);
    assert.throws(() => normalize({ searchQuery: 'fone', categoryUrl: 'https://shopee.com.br/cat.123' }), /only one/i);
    assert.throws(() => normalize({ categoryUrl: 'https://example.com/beleza-cat.123' }), /Shopee Brazil category URL/i);
    assert.throws(() => normalize({ categoryUrl: 'https://shopee.com.br/produto-i.1.2' }), /Shopee Brazil category URL/i);
});

test('validates maxItems as an integer from one to fifty', () => {
    assert.equal(normalize({ searchQuery: 'fone', maxItems: 1 }).maxItems, 1);
    assert.equal(normalize({ searchQuery: 'fone', maxItems: 50 }).maxItems, 50);
    for (const maxItems of [0, 51, 1.5, '10']) {
        assert.throws(() => normalize({ searchQuery: 'fone', maxItems }), /maxItems/i);
    }
});
