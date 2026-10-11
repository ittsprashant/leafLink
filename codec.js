/* codec.js
 * Encodes and decodes a "leaf" (a titled list of links) to and from the URL hash.
 *
 * KEEP THIS FILE IDENTICAL in the linkLeaf (extension) and linkLeafViewer repos.
 *
 * Formats:
 *   v2 (current): "v2." + base64url(deflate-raw(JSON {v:2, t:title, n:note, l:[[title, url], ...]}))
 *   v1 (legacy):  btoa(encodeURIComponent(JSON {title, tabs:[{title, url, favIconUrl}]}))
 */
(function (root) {
    'use strict';

    const LIMITS = {
        links: 500,
        title: 300,
        note: 1000,
        url: 4096,
        hash: 200000,
        inflated: 2 * 1024 * 1024
    };

    const V2_PREFIX = 'v2.';

    function bytesToBinary(bytes) {
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return binary;
    }

    function toBase64Url(bytes) {
        return btoa(bytesToBinary(bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function fromBase64Url(str) {
        let s = str.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
        while (s.length % 4) s += '=';
        const binary = atob(s);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    async function deflate(bytes) {
        const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    // Reads incrementally so a tiny malicious payload can't inflate into gigabytes.
    async function inflate(bytes) {
        const reader = new Blob([bytes]).stream()
            .pipeThrough(new DecompressionStream('deflate-raw'))
            .getReader();
        const chunks = [];
        let total = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.length;
            if (total > LIMITS.inflated) {
                await reader.cancel();
                throw new Error('Leaf data is too large.');
            }
            chunks.push(value);
        }
        const out = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
            out.set(c, offset);
            offset += c.length;
        }
        return out;
    }

    function cleanString(value, max) {
        return typeof value === 'string' ? value.trim().slice(0, max) : '';
    }

    function isHttpUrl(url) {
        try {
            const { protocol } = new URL(url);
            return protocol === 'http:' || protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    function normalize(data, version) {
        if (!data || typeof data !== 'object') throw new Error('Leaf data is not an object.');

        let rawLinks;
        if (version === 2) {
            rawLinks = Array.isArray(data.l)
                ? data.l.map(entry => (Array.isArray(entry) ? { title: entry[0], url: entry[1] } : {}))
                : [];
        } else {
            rawLinks = Array.isArray(data.tabs) ? data.tabs : [];
        }

        const links = rawLinks.slice(0, LIMITS.links).map(link => {
            const url = cleanString(link && link.url, LIMITS.url);
            const favIconUrl = cleanString(link && link.favIconUrl, LIMITS.url);
            return {
                title: cleanString(link && link.title, LIMITS.title),
                url,
                favIconUrl: favIconUrl.startsWith('https://') ? favIconUrl : ''
            };
        }).filter(link => link.url);

        return {
            version,
            title: cleanString(version === 2 ? data.t : data.title, LIMITS.title),
            note: cleanString(data.n, LIMITS.note),
            links,
            truncated: rawLinks.length > LIMITS.links
        };
    }

    /**
     * @param {{title?: string, note?: string, links: {title: string, url: string}[]}} leaf
     * @returns {Promise<string>} the hash, without a leading "#"
     */
    async function encodeLeaf(leaf) {
        const payload = { v: 2, t: cleanString(leaf.title, LIMITS.title) };
        const note = cleanString(leaf.note, LIMITS.note);
        if (note) payload.n = note;
        payload.l = (leaf.links || []).slice(0, LIMITS.links).map(link => [
            cleanString(link.title, LIMITS.title),
            cleanString(link.url, LIMITS.url)
        ]);
        const bytes = new TextEncoder().encode(JSON.stringify(payload));
        return V2_PREFIX + toBase64Url(await deflate(bytes));
    }

    /**
     * Accepts v2 and legacy v1 hashes, with or without the leading "#",
     * and tolerates percent-encoding added by chat apps.
     */
    async function decodeLeaf(hash) {
        let raw = String(hash || '').replace(/^#/, '').trim();
        if (!raw) throw new Error('No leaf data.');
        if (raw.length > LIMITS.hash) throw new Error('Leaf data is too large.');
        if (raw.includes('%')) {
            try { raw = decodeURIComponent(raw); } catch (e) { /* use as-is */ }
        }

        if (raw.startsWith(V2_PREFIX)) {
            const bytes = await inflate(fromBase64Url(raw.slice(V2_PREFIX.length)));
            return normalize(JSON.parse(new TextDecoder().decode(bytes)), 2);
        }

        // Legacy v1: base64 of a percent-encoded JSON string (pure ASCII).
        const ascii = bytesToBinary(fromBase64Url(raw));
        return normalize(JSON.parse(decodeURIComponent(ascii)), 1);
    }

    const api = { encodeLeaf, decodeLeaf, isHttpUrl, LIMITS };

    root.LinkLeafCodec = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
