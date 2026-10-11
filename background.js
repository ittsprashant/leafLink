/* background.js (service worker) */
importScripts('config.js', 'codec.js', 'leaf.js');

const VIEWER_ORIGIN = new URL(LINKLEAF_CONFIG.viewerUrl).origin;
const MAX_TABS_TO_OPEN = 100;
const MENU_ID = 'linkleaf-share';

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: MENU_ID,
        title: 'Share with LinkLeaf',
        contexts: ['page', 'action']
    });
});

// Shares the clicked tab, or every highlighted tab if the clicked tab is part of a multi-selection.
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== MENU_ID || !tab) return;

    let tabs = [tab];
    if (tab.highlighted) {
        const highlighted = await chrome.tabs.query({ windowId: tab.windowId, highlighted: true });
        if (highlighted.length > 1) tabs = highlighted;
    }
    tabs = tabs.filter(t => LinkLeaf.isShareableUrl(t.url));
    if (tabs.length === 0) return;

    const title = tabs.length === 1 ? LinkLeaf.fallbackTitle(tabs[0]) : 'My LinkLeaf';
    const url = await LinkLeaf.buildLeafUrl({
        title,
        links: tabs.map(t => ({ title: LinkLeaf.fallbackTitle(t), url: t.url }))
    });
    await LinkLeaf.addToHistory({ title, count: tabs.length, url });
    await chrome.tabs.create({ url, index: tab.index + 1, windowId: tab.windowId });
});

// Requests from the LinkLeaf viewer site (allowed by "externally_connectable" in the manifest).
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    let senderOrigin = '';
    try {
        senderOrigin = new URL(sender.url).origin;
    } catch (e) { /* invalid sender url */ }
    if (senderOrigin !== VIEWER_ORIGIN || !message || typeof message !== 'object') {
        sendResponse({ ok: false, error: 'Not allowed' });
        return;
    }

    if (message.type === 'ping') {
        sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
        return;
    }

    if (message.type === 'openLeaf') {
        openLeaf(message)
            .then(() => sendResponse({ ok: true }))
            .catch(error => sendResponse({ ok: false, error: String(error && error.message || error) }));
        return true; // keep the channel open for the async response
    }

    sendResponse({ ok: false, error: 'Unknown message type' });
});

async function openLeaf({ urls, title }) {
    if (!Array.isArray(urls)) throw new Error('urls must be an array');
    const safeUrls = urls
        .filter(url => typeof url === 'string' && LinkLeaf.isShareableUrl(url))
        .slice(0, MAX_TABS_TO_OPEN);
    if (safeUrls.length === 0) throw new Error('No links to open');

    const win = await chrome.windows.create({ url: safeUrls, focused: true });
    const tabIds = win.tabs.map(tab => tab.id);
    const groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId: win.id } });
    await chrome.tabGroups.update(groupId, {
        title: typeof title === 'string' ? title.slice(0, 80) : '',
        color: 'green'
    });
}
