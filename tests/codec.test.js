const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { encodeLeaf, decodeLeaf, isHttpUrl, LIMITS } = require('../codec.js');

// The exact encoder used by v1.0-1.1 of the extension.
function encodeV1(data) {
    return btoa(encodeURIComponent(JSON.stringify(data)));
}

test('v2 round-trips title, note and links', async () => {
    const leaf = {
        title: 'Research',
        note: 'Read these before Monday',
        links: [
            { title: 'Example', url: 'https://example.com/a?b=c&d=e#f' },
            { title: 'Other', url: 'http://other.org/' }
        ]
    };
    const hash = await encodeLeaf(leaf);
    assert.match(hash, /^v2\.[A-Za-z0-9_-]+$/, 'hash must be base64url with a version prefix');

    const decoded = await decodeLeaf(hash);
    assert.strictEqual(decoded.version, 2);
    assert.strictEqual(decoded.title, leaf.title);
    assert.strictEqual(decoded.note, leaf.note);
    assert.deepStrictEqual(decoded.links.map(l => [l.title, l.url]), leaf.links.map(l => [l.title, l.url]));
});

test('v2 handles Unicode and emoji', async () => {
    const leaf = { title: 'नमस्ते 🌿 — “quotes”', links: [{ title: '日本語のページ 🎉', url: 'https://例え.jp/パス' }] };
    const decoded = await decodeLeaf(await encodeLeaf(leaf));
    assert.strictEqual(decoded.title, leaf.title);
    assert.strictEqual(decoded.links[0].title, leaf.links[0].title);
    assert.strictEqual(decoded.links[0].url, leaf.links[0].url);
});

test('decodes legacy v1 links, with or without "#"', async () => {
    const data = {
        title: 'Old leaf ✨',
        tabs: [{ title: 'Ünïcödé', url: 'https://example.com/?q=1', favIconUrl: 'https://example.com/favicon.ico' }]
    };
    for (const hash of [encodeV1(data), '#' + encodeV1(data)]) {
        const decoded = await decodeLeaf(hash);
        assert.strictEqual(decoded.version, 1);
        assert.strictEqual(decoded.title, data.title);
        assert.strictEqual(decoded.links[0].url, data.tabs[0].url);
        assert.strictEqual(decoded.links[0].favIconUrl, data.tabs[0].favIconUrl);
    }
});

test('tolerates percent-encoded hashes from chat apps', async () => {
    const hash = await encodeLeaf({ title: 't', links: [{ title: 'a', url: 'https://a.com' }] });
    const decoded = await decodeLeaf(encodeURIComponent(hash).replace(/\./g, '%2E'));
    assert.strictEqual(decoded.links[0].url, 'https://a.com');

    const v1 = encodeV1({ title: 'x', tabs: [{ title: 'a', url: 'https://a.com' }] }).replace(/=/g, '%3D');
    assert.strictEqual((await decodeLeaf(v1)).links[0].url, 'https://a.com');
});

test('v2 is much shorter than v1', async () => {
    const links = Array.from({ length: 20 }, (_, i) => ({
        title: `Page ${i} on some site`,
        url: `https://site${i}.example.com/path/to/page-${i}?ref=${i}`
    }));
    const v1 = encodeV1({ title: 'x', tabs: links.map(l => ({ ...l, favIconUrl: `https://site.example.com/favicon.ico` })) });
    const v2 = await encodeLeaf({ title: 'x', links });
    assert.ok(v2.length < v1.length / 2, `v2 (${v2.length}) should be < half of v1 (${v1.length})`);
});

test('rejects empty and garbage input', async () => {
    await assert.rejects(decodeLeaf(''));
    await assert.rejects(decodeLeaf('#'));
    await assert.rejects(decodeLeaf('v2.!!!!'));
    await assert.rejects(decodeLeaf('not-base64-json'));
    await assert.rejects(decodeLeaf('v2.' + 'A'.repeat(LIMITS.hash)));
});

test('malicious payloads are kept as inert data', async () => {
    const data = {
        title: '<img src=x onerror=alert(1)>',
        tabs: [
            { title: '<script>alert(1)</script>', url: 'javascript:alert(1)', favIconUrl: "x' onerror='alert(1)" },
            { title: 'ok', url: 'https://ok.com', favIconUrl: 'http://insecure.com/f.ico' },
            { title: 'no url' },
            'not an object',
            null
        ]
    };
    const decoded = await decodeLeaf(encodeV1(data));
    // Strings are returned verbatim (the viewer renders them with textContent)...
    assert.strictEqual(decoded.title, data.title);
    // ...entries without a URL are dropped, and only https favicons survive.
    assert.strictEqual(decoded.links.length, 2);
    assert.strictEqual(decoded.links[0].favIconUrl, '');
    assert.strictEqual(decoded.links[1].favIconUrl, '');
    // The viewer must not make javascript: URLs clickable.
    assert.strictEqual(isHttpUrl(decoded.links[0].url), false);
    assert.strictEqual(isHttpUrl(decoded.links[1].url), true);
});

test('caps the number of links and string lengths', async () => {
    const many = Array.from({ length: LIMITS.links + 50 }, (_, i) => ({ title: 't', url: `https://a.com/${i}` }));
    const decodedMany = await decodeLeaf(encodeV1({ title: 'x', tabs: many }));
    assert.strictEqual(decodedMany.links.length, LIMITS.links);
    assert.strictEqual(decodedMany.truncated, true);

    const long = [{ title: 'x'.repeat(1000), url: 'https://a.com' }];
    const decodedLong = await decodeLeaf(encodeV1({ title: 'y'.repeat(1000), tabs: long }));
    assert.strictEqual(decodedLong.title.length, LIMITS.title);
    assert.strictEqual(decodedLong.links[0].title.length, LIMITS.title);
});

test('refuses decompression bombs', async () => {
    const zlib = require('node:zlib');
    const huge = JSON.stringify({ v: 2, t: 'x'.repeat(LIMITS.inflated + 10), l: [] });
    const bomb = 'v2.' + zlib.deflateRawSync(Buffer.from(huge)).toString('base64url');
    assert.ok(bomb.length < LIMITS.hash, 'bomb must be small enough to pass the hash-length check');
    await assert.rejects(decodeLeaf(bomb), /too large/);
});

test('isHttpUrl only accepts http and https', () => {
    assert.ok(isHttpUrl('https://a.com'));
    assert.ok(isHttpUrl('http://a.com'));
    for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'chrome://settings', 'about:blank', 'nope']) {
        assert.strictEqual(isHttpUrl(url), false, url);
    }
});

test('codec.js is identical in the viewer repo (when checked out next to this one)', { skip: !fs.existsSync(path.join(__dirname, '../../linkLeafViewer/codec.js')) }, () => {
    const here = fs.readFileSync(path.join(__dirname, '../codec.js'), 'utf8');
    const there = fs.readFileSync(path.join(__dirname, '../../linkLeafViewer/codec.js'), 'utf8');
    assert.strictEqual(there, here, 'Copy linkLeaf/codec.js to linkLeafViewer/codec.js');
});
