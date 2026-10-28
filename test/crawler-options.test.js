import assert from 'node:assert/strict';
import test from 'node:test';

import * as optionsModule from '../src/crawler-options.js';

test('crawler options rate-limit Shopee requests and disable session and request retries', () => {
    const options = optionsModule.createCrawlerOptions?.(1) ?? null;

    assert.equal(options?.maxConcurrency, 1);
    assert.equal(options?.sameDomainDelaySecs, 1);
    assert.equal(options?.maxRequestsPerMinute, 60);
    assert.equal(options?.maxRequestRetries, 0);
    assert.equal(options?.maxSessionRotations, 0);
    assert.equal(options?.useSessionPool, false);
});
