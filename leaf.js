/* leaf.js
 * Helpers shared by the popup and the background service worker.
 * Depends on config.js and codec.js.
 */
(function (root) {
    'use strict';

    const SENSITIVE_PARAMS = new Set([
        'token', 'access_token', 'id_token', 'refresh_token', 'auth', 'authorization',
        'code', 'key', 'api_key', 'apikey', 'secret', 'client_secret', 'password', 'pwd',
        'sig', 'signature', 'x-amz-signature', 'x-goog-signature', 'session', 'sessionid', 'sid', 'otp'
    ]);

    function isShareableUrl(url) {
        return root.LinkLeafCodec.isHttpUrl(url);
    }

    function paramNames(url) {
        const u = new URL(url);
        const names = [...u.searchParams.keys()];
        if (u.hash.includes('=')) {
            names.push(...new URLSearchParams(u.hash.slice(1)).keys());
        }
        return names.map(name => name.toLowerCase());
    }

    function hasSensitiveParams(url) {
        try {
            return paramNames(url).some(name => SENSITIVE_PARAMS.has(name));
        } catch (e) {
            return false;
        }
    }

    function hasParams(url) {
        try {
            return paramNames(url).length > 0;
        } catch (e) {
            return false;
        }
    }

    // Removes the query string, and the fragment too when it looks like parameters
    // (e.g. "#access_token=...") rather than an in-page anchor or SPA route.
    function stripParams(url) {
        try {
            const u = new URL(url);
            u.search = '';
            if (u.hash.includes('=')) u.hash = '';
            return u.toString();
        } catch (e) {
            return url;
        }
    }

    function fallbackTitle(tab) {
        if (tab.title) return tab.title;
        try {
            return new URL(tab.url).hostname;
        } catch (e) {
            return tab.url;
        }
    }

    async function buildLeafUrl(leaf) {
        const hash = await root.LinkLeafCodec.encodeLeaf(leaf);
        return `${root.LINKLEAF_CONFIG.viewerUrl}#${hash}`;
    }

    // --- History (chrome.storage.local) ---

    const HISTORY_KEY = 'history';

    async function getHistory() {
        try {
            const { [HISTORY_KEY]: history } = await chrome.storage.local.get(HISTORY_KEY);
            return Array.isArray(history) ? history : [];
        } catch (e) {
            console.error('Could not read history:', e);
            return [];
        }
    }

    async function saveHistory(history) {
        await chrome.storage.local.set({ [HISTORY_KEY]: history });
    }

    async function addToHistory({ title, count, url }) {
        const history = (await getHistory()).filter(entry => entry.url !== url);
        history.unshift({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            title,
            count,
            url,
            createdAt: Date.now()
        });
        await saveHistory(history.slice(0, root.LINKLEAF_CONFIG.historyLimit));
    }

    async function removeFromHistory(id) {
        await saveHistory((await getHistory()).filter(entry => entry.id !== id));
    }

    async function clearHistory() {
        await saveHistory([]);
    }

    root.LinkLeaf = {
        isShareableUrl,
        hasSensitiveParams,
        hasParams,
        stripParams,
        fallbackTitle,
        buildLeafUrl,
        getHistory,
        addToHistory,
        removeFromHistory,
        clearHistory
    };
})(self);
