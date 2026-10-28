import assert from 'node:assert/strict';
import test from 'node:test';

import * as media from '../src/media.js';

const extract = (snapshot, url) => media.extractProductData?.(snapshot, url) ?? null;

test('extracts product details and deduplicated image/video URLs from public page data', () => {
    const url = 'https://shopee.com.br/batom-i.123.456';
    const snapshot = {
        title: 'Batom da página',
        meta: { 'og:title': 'Batom Ruby', 'og:image': 'https://cdn.example/cover.jpg' },
        jsonLd: [{
            '@type': 'Product',
            sku: '456',
            name: 'Batom Ruby',
            image: ['https://cdn.example/cover.jpg', 'https://cdn.example/side.jpg', { url: 'https://cdn.example/front.jpg' }],
            offers: { price: '39.90', seller: { name: 'Loja Ruby', url: 'https://shopee.com.br/ruby' } },
            video: { '@type': 'VideoObject', contentUrl: 'https://cdn.example/demo.mp4' },
        }],
        embeddedJson: {
            product: {
                images: [{ original: 'https://cdn.example/side.jpg' }, 'https://cdn.example/back.jpg'],
                videos: [{ url: 'https://cdn.example/demo.mp4' }, { url: 'https://cdn.example/variant.mp4' }],
            },
        },
        domImages: ['https://cdn.example/cover.jpg', 'https://cdn.example/detail.jpg'],
        domVideos: [{ src: 'https://cdn.example/clip.mp4', poster: 'https://cdn.example/poster.jpg' }],
    };

    assert.deepEqual(extract(snapshot, url), {
        id: '456',
        url,
        title: 'Batom Ruby',
        price: 39.9,
        sellerName: 'Loja Ruby',
        sellerUrl: 'https://shopee.com.br/ruby',
        images: [
            'https://cdn.example/cover.jpg',
            'https://cdn.example/side.jpg',
            'https://cdn.example/front.jpg',
            'https://cdn.example/back.jpg',
            'https://cdn.example/detail.jpg',
            'https://cdn.example/poster.jpg',
        ],
        videos: ['https://cdn.example/demo.mp4', 'https://cdn.example/variant.mp4', 'https://cdn.example/clip.mp4'],
    });
});

test('ignores malformed embedded JSON and non-HTTP media without failing', () => {
    const result = extract({
        title: 'Produto',
        meta: {},
        jsonLd: ['{not json'],
        embeddedJson: ['{broken', { images: ['data:image/png;base64,abc', '//cdn.example/a.jpg'] }],
        domImages: ['javascript:alert(1)'],
        domVideos: [],
    }, 'https://shopee.com.br/produto-i.2.9');

    assert.deepEqual(result, {
        id: '9',
        url: 'https://shopee.com.br/produto-i.2.9',
        title: 'Produto',
        price: null,
        sellerName: null,
        sellerUrl: null,
        images: ['https://cdn.example/a.jpg'],
        videos: [],
    });
});

test('returns empty media arrays when the page exposes no product media', () => {
    const result = extract({ title: 'Sem fotos', meta: {}, jsonLd: [], embeddedJson: [], domImages: [], domVideos: [] },
        'https://shopee.com.br/sem-fotos-i.2.9');

    assert.deepEqual(result?.images ?? null, []);
    assert.deepEqual(result?.videos ?? null, []);
});

test('extracts Shopee video_info_list resources and their thumbnail images', () => {
    const result = extract({
        title: 'Produto com vídeo',
        meta: {},
        jsonLd: [],
        embeddedJson: [{
            item: {
                video_info_list: [{
                    thumb_url: 'https://cdn.example/video-thumb.jpg',
                    default_format: { resource: 'https://cdn.example/product-video.mp4' },
                }],
            },
        }],
        domImages: [],
        domVideos: [],
    }, 'https://shopee.com.br/produto-i.2.9');

    assert.deepEqual(result?.images, ['https://cdn.example/video-thumb.jpg']);
    assert.deepEqual(result?.videos, ['https://cdn.example/product-video.mp4']);
});
