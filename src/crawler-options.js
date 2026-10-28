export function createCrawlerOptions(maxConcurrency) {
    return {
        maxConcurrency,
        sameDomainDelaySecs: 1,
        maxRequestsPerMinute: 60,
        maxRequestRetries: 0,
        maxSessionRotations: 0,
        useSessionPool: false,
        navigationTimeoutSecs: 30,
        requestHandlerTimeoutSecs: 60,
        launchContext: { launchOptions: { headless: true } },
    };
}
