const IMAGE_KEY = /^(?:image|images|img|picture|pictures|photo|photos|gallery|cover|thumbnail|longimage|longimages|ogimage)$/i;
const VIDEO_KEY = /^(?:video|videos|videourl|videourls|videoinfo|videoinfolist|contenturl|streamurl)$/i;
const MEDIA_EXTENSION = /\.(?:mp4|m3u8|webm|mov)(?:$|[?#])/i;

function asArray(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
}

function normalizeUrl(value, baseUrl) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const candidate = value.trim().replaceAll('\\/', '/');
    if (!/^(?:https?:\/\/|\/\/|\.\.?\/|\/)/i.test(candidate)) return null;
    try {
        const url = new URL(candidate, baseUrl);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
}

function addMedia(target, value, baseUrl, forcedType) {
    if (typeof value === 'string') {
        const url = normalizeUrl(value, baseUrl);
        if (!url) return;
        const type = forcedType ?? (MEDIA_EXTENSION.test(url) ? 'video' : 'image');
        target[type === 'video' ? 'videos' : 'images'].add(url);
        return;
    }
    if (Array.isArray(value)) {
        for (const entry of value) addMedia(target, entry, baseUrl, forcedType);
        return;
    }
    if (!value || typeof value !== 'object') return;

    for (const [key, entry] of Object.entries(value)) {
        const normalizedKey = key.replace(/[^a-z]/gi, '');
        if (/^(?:poster|thumbnail|thumb|thumburl)$/i.test(normalizedKey)) {
            addMedia(target, entry, baseUrl, 'image');
        } else if (VIDEO_KEY.test(normalizedKey)) {
            addMedia(target, entry, baseUrl, 'video');
        } else if (IMAGE_KEY.test(normalizedKey)) {
            addMedia(target, entry, baseUrl, 'image');
        } else if (/^(?:src|currentSrc|secureUrl|original|large)$/i.test(key)
            || ((key.toLowerCase() === 'url' || key.toLowerCase() === 'resource') && forcedType)) {
            addMedia(target, entry, baseUrl, forcedType);
        } else if (typeof entry === 'object' && entry !== null) {
            addMedia(target, entry, baseUrl, forcedType);
        }
    }
}

function parseJson(value) {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function findProduct(value) {
    const parsed = parseJson(value);
    if (Array.isArray(parsed)) {
        for (const entry of parsed) {
            const found = findProduct(entry);
            if (found) return found;
        }
    } else if (parsed && typeof parsed === 'object') {
        const types = asArray(parsed['@type']);
        if (types.some((type) => typeof type === 'string' && type.toLowerCase() === 'product')) return parsed;
        for (const entry of Object.values(parsed)) {
            const found = findProduct(entry);
            if (found) return found;
        }
    }
    return null;
}

function getOffer(product) {
    const offers = asArray(product?.offers)[0];
    return offers && typeof offers === 'object' ? offers : {};
}

function parsePrice(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;
    const normalized = value.replace(/[^\d,.-]/g, '').trim();
    if (!normalized) return null;
    const decimalNormalized = normalized.includes(',')
        ? normalized.replace(/\./g, '').replace(',', '.')
        : normalized;
    const number = Number(decimalNormalized);
    return Number.isFinite(number) ? number : null;
}

function findItemId(url) {
    try {
        return new URL(url).pathname.match(/-i\.\d+\.(\d+)(?:\/|$)/)?.[1] ?? null;
    } catch {
        return null;
    }
}

function addDomVideo(target, video, baseUrl) {
    if (video && typeof video === 'object') {
        if (video.poster) addMedia(target, video.poster, baseUrl, 'image');
        for (const key of ['src', 'currentSrc', 'sources']) {
            if (video[key]) addMedia(target, video[key], baseUrl, 'video');
        }
    } else {
        addMedia(target, video, baseUrl, 'video');
    }
}

/** Normalize structured, embedded, and rendered product data into the IDDA Apify connector shape. */
export function extractProductData(snapshot, requestedUrl) {
    const product = findProduct(snapshot?.jsonLd) ?? {};
    const offer = getOffer(product);
    const metadata = snapshot?.meta ?? {};
    const media = { images: new Set(), videos: new Set() };

    addMedia(media, product.image, requestedUrl, 'image');
    addMedia(media, product.video, requestedUrl, 'video');
    addMedia(media, metadata['og:image'], requestedUrl, 'image');
    addMedia(media, metadata['og:video'], requestedUrl, 'video');
    addMedia(media, metadata['og:video:url'], requestedUrl, 'video');
    addMedia(media, metadata['twitter:player:stream'], requestedUrl, 'video');
    for (const entry of asArray(snapshot?.embeddedJson)) addMedia(media, parseJson(entry), requestedUrl);
    for (const entry of asArray(snapshot?.domImages)) addMedia(media, entry, requestedUrl, 'image');
    for (const entry of asArray(snapshot?.domVideos)) addDomVideo(media, entry, requestedUrl);

    const productUrl = normalizeUrl(requestedUrl);
    const title = product.name ?? product.title ?? metadata['og:title'] ?? snapshot?.title ?? null;
    const seller = offer.seller ?? product.seller ?? {};
    const id = product.sku ?? product.productID ?? product.productId ?? product.itemId ?? findItemId(requestedUrl);

    return {
        id: id == null ? null : String(id),
        url: productUrl ?? requestedUrl,
        title: typeof title === 'string' && title.trim() ? title.trim() : null,
        price: parsePrice(offer.price ?? offer.lowPrice ?? product.price),
        sellerName: typeof seller.name === 'string' ? seller.name : null,
        sellerUrl: normalizeUrl(seller.url, requestedUrl),
        images: [...media.images],
        videos: [...media.videos],
    };
}
