export function isTrafficVerificationPage({ url = '', title = '', bodyText = '' } = {}) {
    const pageText = `${title}\n${bodyText}`;
    return /\/verify\/traffic\/error(?:[/?#]|$)/i.test(String(url))
        || /traffic verification|verifica(?:ç|c)[ãa]o de tr[aá]fego|captcha/i.test(pageText)
        || /login\s+necess[aá]rio|login\s+required|ainda\s+n[aã]o\s+est[aá]\s+logad[oa]/i.test(pageText);
}

export function getScrapingStatus(pageInfo, productData) {
    if (isTrafficVerificationPage(pageInfo)) return 'blocked';
    return productData?.images?.length ? 'ok' : 'partial';
}

export function clearChallengeMedia(productData, pageInfo) {
    if (!isTrafficVerificationPage(pageInfo)) return productData;
    return { ...productData, images: [], videos: [] };
}

export async function captureSearchPage(page) {
    return page.evaluate(() => {
        const allowedHosts = new Set(['shopee.com.br', 'www.shopee.com.br']);
        const productPath = /(?:^|[-/])i\.\d+\.\d+(?:\/|$)/i;
        const cards = [];

        for (const anchor of document.querySelectorAll('a[href]')) {
            let url;
            try {
                url = new URL(anchor.href, location.href);
            } catch {
                continue;
            }

            if (!['http:', 'https:'].includes(url.protocol)
                || url.username.length > 0
                || url.password.length > 0
                || url.port.length > 0
                || !allowedHosts.has(url.hostname.toLowerCase())
                || !productPath.test(url.pathname)) continue;

            const card = anchor.closest('[data-sqe="item"]')
                || anchor.closest('[data-testid*="item"]')
                || anchor.closest('li')
                || anchor.parentElement
                || anchor;
            cards.push({ url: url.href, text: card.innerText || anchor.innerText || '' });
        }

        return {
            url: location.href,
            title: document.title,
            bodyText: document.body?.innerText?.slice(0, 10_000) || '',
            cards,
        };
    });
}

export async function captureProductPage(page) {
    return page.evaluate(() => {
        const meta = {};
        for (const element of document.querySelectorAll('meta[property], meta[name]')) {
            const key = element.getAttribute('property') || element.getAttribute('name');
            const value = element.getAttribute('content');
            if (key && value) meta[key.toLowerCase()] = value;
        }

        const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
            .map((script) => script.textContent || '');
        const embeddedJson = Array.from(document.scripts)
            .filter((script) => script.type.toLowerCase().includes('json') || script.id === '__NEXT_DATA__')
            .map((script) => script.textContent || '')
            .filter((text) => text.length > 0 && text.length <= 1_000_000);

        const domImages = Array.from(document.images).flatMap((image) => {
            const values = [image.currentSrc, image.src, image.getAttribute('data-src'), image.getAttribute('data-original')];
            const srcset = image.getAttribute('srcset') || image.getAttribute('data-srcset') || '';
            values.push(...srcset.split(',').map((candidate) => candidate.trim().split(/\s+/)[0]));
            return values.filter(Boolean);
        });
        const domVideos = Array.from(document.querySelectorAll('video')).map((video) => ({
            src: video.currentSrc || video.getAttribute('src'),
            poster: video.getAttribute('poster'),
            sources: Array.from(video.querySelectorAll('source')).map((source) => ({
                src: source.src || source.getAttribute('src'),
            })),
        }));

        return {
            url: location.href,
            title: document.title,
            bodyText: document.body?.innerText?.slice(0, 10_000) || '',
            meta,
            jsonLd,
            embeddedJson,
            domImages,
            domVideos,
        };
    });
}
