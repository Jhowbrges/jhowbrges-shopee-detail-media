import { Actor } from 'apify';
import { PlaywrightCrawler } from '@crawlee/playwright';

import { createActorHandlers } from './handlers.js';
import { normalizeInput } from './input.js';
import { createFailedRequestHandler } from './failed-request.js';
import { createCrawlerOptions } from './crawler-options.js';

await Actor.main(async () => {
    const input = normalizeInput(await Actor.getInput());
    let crawler;
    const handlers = createActorHandlers({
        input,
        addRequests: (requests) => crawler.addRequests(requests),
        pushData: (item) => Actor.pushData(item),
    });

    crawler = new PlaywrightCrawler({
        ...createCrawlerOptions(1),
        requestHandler: handlers.requestHandler,
        failedRequestHandler: createFailedRequestHandler((item) => handlers.recordFailedRequest(item)),
    });

    await crawler.run([{
        url: input.searchUrl,
        userData: {
            kind: 'search',
            searchQuery: input.searchQuery,
            categoryUrl: input.categoryUrl,
        },
    }]);
    await handlers.flushResults();
});
