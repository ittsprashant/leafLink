/* popup.js */
document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);

    const titleInput = $('linkleafTitle');
    const addNoteBtn = $('addNoteBtn');
    const noteInput = $('linkleafNote');
    const scopeSelect = $('scopeSelect');
    const searchWrap = $('searchWrap');
    const tabSearch = $('tabSearch');
    const listCard = $('listCard');
    const selectAllCheckbox = $('selectAllCheckbox');
    const selectedCount = $('selectedCount');
    const tabListContainer = $('tabList');
    const emptyState = $('emptyState');
    const stripOption = $('stripOption');
    const stripParamsCheckbox = $('stripParamsCheckbox');
    const sensitiveWarning = $('sensitiveWarning');
    const createLinkBtn = $('createLinkBtn');
    const createBtnText = $('createBtnText');
    const createIcon = $('createIcon');
    const copiedIcon = $('copiedIcon');
    const resultDiv = $('result');
    const resultMessage = $('resultMessage');
    const linkOutput = $('linkOutput');
    const copyBtn = $('copyBtn');
    const copyIcon = $('copyIcon');
    const checkIcon = $('checkIcon');
    const previewLink = $('previewLink');
    const linkLength = $('linkLength');
    const viewToggleBtn = $('viewToggleBtn');
    const viewToggleText = $('viewToggleText');
    const historyIcon = $('historyIcon');
    const backIcon = $('backIcon');
    const createView = $('createView');
    const historyView = $('historyView');
    const historyList = $('historyList');
    const historyEmpty = $('historyEmpty');
    const clearHistoryBtn = $('clearHistoryBtn');

    const SEARCH_THRESHOLD = 8;
    const LONG_LINK_CHARS = 2000;

    let items = [];          // { key, title, url, favIconUrl, checked }
    let defaultTitle = '';   // e.g. the tab group's name
    let searchQuery = '';

    // ---------- Helpers ----------

    const ICONS = {
        pencil: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'],
        copy: ['M8 8h12v12H8z', 'M4 16V4h12'],
        check: ['M20 6 9 17l-5-5'],
        external: ['M14 4h6v6', 'M10 14 20 4', 'M19 14v6H4V5h6'],
        trash: ['M3 6h18', 'M8 6V4h8v2', 'M6 6l1 14h10l1-14']
    };

    function icon(name, size = 15) {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        ICONS[name].forEach(d => {
            const path = document.createElementNS(ns, 'path');
            path.setAttribute('d', d);
            svg.appendChild(path);
        });
        return svg;
    }

    function hostnameOf(url) {
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        } catch (e) {
            return '';
        }
    }

    function createFavicon(url, favIconUrl) {
        const tile = document.createElement('span');
        tile.className = 'favicon-tile';

        const letter = document.createElement('span');
        letter.className = 'favicon-letter';
        letter.setAttribute('aria-hidden', 'true');
        letter.textContent = (hostnameOf(url)[0] || '?').toUpperCase();

        if (favIconUrl) {
            const img = document.createElement('img');
            img.className = 'favicon';
            img.alt = '';
            img.src = favIconUrl;
            img.addEventListener('error', () => img.replaceWith(letter), { once: true });
            tile.appendChild(img);
        } else {
            tile.appendChild(letter);
        }
        return tile;
    }

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            console.error('Clipboard write failed:', e);
            return false;
        }
    }

    function flashIcons(hideEl, showEl) {
        hideEl.classList.add('hidden');
        showEl.classList.remove('hidden');
        setTimeout(() => {
            hideEl.classList.remove('hidden');
            showEl.classList.add('hidden');
        }, 2000);
    }

    function visibleItems() {
        if (!searchQuery) return items;
        return items.filter(item =>
            item.title.toLowerCase().includes(searchQuery) || item.url.toLowerCase().includes(searchQuery));
    }

    // ---------- Loading tabs ----------

    async function populateGroups() {
        try {
            const groups = await chrome.tabGroups.query({});
            groups.forEach(group => {
                const option = document.createElement('option');
                option.value = `group:${group.id}`;
                option.textContent = `Group: ${group.title || 'Untitled'}`;
                option.dataset.title = group.title || '';
                scopeSelect.appendChild(option);
            });
        } catch (e) {
            console.error('Could not load tab groups:', e);
        }
    }

    async function queryTabs(scope) {
        if (scope === 'all') return chrome.tabs.query({});
        if (scope.startsWith('group:')) return chrome.tabs.query({ groupId: Number(scope.slice(6)) });
        return chrome.tabs.query({ currentWindow: true });
    }

    async function loadTabs() {
        const scope = scopeSelect.value;
        const tabs = await queryTabs(scope);

        const seen = new Set();
        const shareable = tabs.filter(tab => {
            if (!LinkLeaf.isShareableUrl(tab.url) || seen.has(tab.url)) return false;
            seen.add(tab.url);
            return true;
        });

        // If the user multi-selected tabs (Ctrl/Shift+click), start with only those checked.
        const highlightedCount = shareable.filter(tab => tab.highlighted).length;
        const onlyHighlighted = scope === 'window' && highlightedCount > 1;

        items = shareable.map(tab => ({
            key: String(tab.id),
            title: LinkLeaf.fallbackTitle(tab),
            url: tab.url,
            favIconUrl: tab.favIconUrl || '',
            checked: onlyHighlighted ? tab.highlighted : true
        }));

        const selectedOption = scopeSelect.selectedOptions[0];
        defaultTitle = (selectedOption && selectedOption.dataset.title) || '';
        titleInput.placeholder = defaultTitle || 'Name this leaf, e.g. UI inspirations';

        searchWrap.classList.toggle('hidden', items.length <= SEARCH_THRESHOLD);
        renderTabs();
    }

    // ---------- Rendering ----------

    function renderTabs() {
        tabListContainer.replaceChildren();

        visibleItems().forEach(item => {
            const row = document.createElement('div');
            row.className = item.checked ? 'tab-item' : 'tab-item unchecked';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `tab-${item.key}`;
            checkbox.className = 'tab-checkbox';
            checkbox.checked = item.checked;
            checkbox.addEventListener('change', () => {
                item.checked = checkbox.checked;
                row.classList.toggle('unchecked', !item.checked);
                updateState();
            });

            const text = document.createElement('div');
            text.className = 'tab-text';
            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = item.title;
            label.title = `${item.title}\n${item.url}`;
            const domain = document.createElement('span');
            domain.className = 'tab-domain';
            domain.textContent = hostnameOf(item.url);
            text.append(label, domain);

            const renameBtn = document.createElement('button');
            renameBtn.type = 'button';
            renameBtn.className = 'rename-btn';
            renameBtn.title = 'Rename';
            renameBtn.setAttribute('aria-label', `Rename ${item.title}`);
            renameBtn.appendChild(icon('pencil', 14));
            renameBtn.addEventListener('click', () => startRename(item, label));

            const favicon = createFavicon(item.url, item.favIconUrl);

            // Clicking anywhere on the row (except the rename button) toggles the checkbox.
            row.addEventListener('click', event => {
                if (event.target === row || favicon.contains(event.target) ||
                    (text.contains(event.target) && event.target !== label && event.target.tagName !== 'INPUT')) {
                    checkbox.click();
                }
            });

            row.append(checkbox, favicon, text, renameBtn);
            tabListContainer.appendChild(row);
        });

        emptyState.classList.toggle('hidden', items.length > 0);
        listCard.classList.toggle('hidden', items.length === 0);
        updateState();
    }

    function startRename(item, label) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'rename-input';
        input.value = item.title;
        input.maxLength = LinkLeafCodec.LIMITS.title;
        input.setAttribute('aria-label', 'New title');

        let done = false;
        const finish = save => {
            if (done) return;
            done = true;
            if (save && input.value.trim()) item.title = input.value.trim();
            renderTabs();
        };
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') finish(true);
            if (event.key === 'Escape') {
                event.preventDefault();
                finish(false);
            }
        });
        input.addEventListener('blur', () => finish(true));

        label.replaceWith(input);
        input.focus();
        input.select();
    }

    function updateState() {
        const selected = items.filter(item => item.checked);
        const visible = visibleItems();
        const visibleChecked = visible.filter(item => item.checked).length;

        selectAllCheckbox.disabled = visible.length === 0;
        selectAllCheckbox.checked = visible.length > 0 && visibleChecked === visible.length;
        selectAllCheckbox.indeterminate = visibleChecked > 0 && visibleChecked < visible.length;

        selectedCount.textContent = items.length ? `${selected.length} of ${items.length} selected` : '';

        createLinkBtn.disabled = selected.length === 0;
        createBtnText.textContent = selected.length
            ? `Create & Copy Link (${selected.length})`
            : 'Select tabs to share';

        const anyParams = selected.some(item => LinkLeaf.hasParams(item.url));
        stripOption.classList.toggle('hidden', !anyParams);

        const sensitive = stripParamsCheckbox.checked
            ? []
            : selected.filter(item => LinkLeaf.hasSensitiveParams(item.url));
        if (sensitive.length) {
            sensitiveWarning.textContent = sensitive.length === 1
                ? '1 selected link has a URL parameter that looks like a secret (token, code, key…). Consider removing URL parameters.'
                : `${sensitive.length} selected links have URL parameters that look like secrets (token, code, key…). Consider removing URL parameters.`;
        }
        sensitiveWarning.classList.toggle('hidden', sensitive.length === 0);
    }

    // ---------- Create link ----------

    async function createLink() {
        const selected = items.filter(item => item.checked);
        if (selected.length === 0) return;

        const title = titleInput.value.trim() || defaultTitle || 'My LinkLeaf';
        const strip = stripParamsCheckbox.checked;

        createLinkBtn.disabled = true;
        let finalUrl;
        try {
            finalUrl = await LinkLeaf.buildLeafUrl({
                title,
                note: noteInput.value,
                links: selected.map(item => ({
                    title: item.title,
                    url: strip ? LinkLeaf.stripParams(item.url) : item.url
                }))
            });
        } catch (e) {
            console.error('Could not create link:', e);
            resultMessage.textContent = 'Something went wrong while creating the link.';
            resultDiv.classList.remove('hidden');
            updateState();
            return;
        }
        updateState();

        linkOutput.value = finalUrl;
        previewLink.href = finalUrl;
        linkLength.textContent = finalUrl.length > LONG_LINK_CHARS
            ? `${finalUrl.length.toLocaleString()} chars: some apps may cut long links`
            : `${finalUrl.length.toLocaleString()} characters`;
        linkLength.classList.toggle('warning-text', finalUrl.length > LONG_LINK_CHARS);
        resultDiv.classList.remove('hidden');
        resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        LinkLeaf.addToHistory({ title, count: selected.length, url: finalUrl })
            .catch(e => console.error('Could not save history:', e));

        if (await copyText(finalUrl)) {
            resultMessage.textContent = 'Link copied to your clipboard';
            createBtnText.textContent = 'Copied!';
            createLinkBtn.classList.add('copied');
            flashIcons(createIcon, copiedIcon);
            setTimeout(() => {
                createLinkBtn.classList.remove('copied');
                updateState();
            }, 2000);
        } else {
            resultMessage.textContent = "Couldn't copy automatically. Press Ctrl+C (Cmd+C on Mac).";
            linkOutput.focus();
            linkOutput.select();
        }
    }

    // ---------- History ----------

    function historyButton(iconName, label, extraClass = '') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `icon-button ${extraClass}`.trim();
        button.title = label;
        button.setAttribute('aria-label', label);
        button.appendChild(icon(iconName));
        return button;
    }

    async function renderHistory() {
        const history = await LinkLeaf.getHistory();
        historyList.replaceChildren();
        historyEmpty.classList.toggle('hidden', history.length > 0);
        clearHistoryBtn.classList.toggle('hidden', history.length === 0);

        history.forEach(entry => {
            const li = document.createElement('li');
            li.className = 'history-item';

            const badge = document.createElement('span');
            badge.className = 'history-badge';

            const info = document.createElement('div');
            info.className = 'history-info';
            const title = document.createElement('span');
            title.className = 'history-title';
            title.textContent = entry.title;
            const meta = document.createElement('span');
            meta.className = 'muted';
            const date = new Date(entry.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
            meta.textContent = `${entry.count} ${entry.count === 1 ? 'link' : 'links'} · ${date}`;
            badge.textContent = (Array.from(entry.title.trim())[0] || '#').toUpperCase();
            info.append(title, meta);

            const actions = document.createElement('div');
            actions.className = 'history-actions';

            const copy = historyButton('copy', `Copy link to ${entry.title}`);
            copy.addEventListener('click', async () => {
                if (!(await copyText(entry.url))) return;
                copy.replaceChildren(icon('check'));
                setTimeout(() => copy.replaceChildren(icon('copy')), 1500);
            });

            const open = historyButton('external', `Open ${entry.title}`);
            open.addEventListener('click', () => chrome.tabs.create({ url: entry.url }));

            const remove = historyButton('trash', `Delete ${entry.title}`, 'danger');
            remove.addEventListener('click', async () => {
                await LinkLeaf.removeFromHistory(entry.id);
                renderHistory();
            });

            actions.append(copy, open, remove);
            li.append(badge, info, actions);
            historyList.appendChild(li);
        });
    }

    function showHistory(show) {
        createView.classList.toggle('hidden', show);
        historyView.classList.toggle('hidden', !show);
        viewToggleBtn.setAttribute('aria-pressed', String(show));
        viewToggleText.textContent = show ? 'Back' : 'Recent';
        historyIcon.classList.toggle('hidden', show);
        backIcon.classList.toggle('hidden', !show);
        if (show) renderHistory();
    }

    // ---------- Events ----------

    addNoteBtn.addEventListener('click', () => {
        addNoteBtn.classList.add('hidden');
        noteInput.classList.remove('hidden');
        noteInput.focus();
    });

    selectAllCheckbox.addEventListener('change', () => {
        const checked = selectAllCheckbox.checked;
        visibleItems().forEach(item => { item.checked = checked; });
        renderTabs();
    });

    tabSearch.addEventListener('input', () => {
        searchQuery = tabSearch.value.trim().toLowerCase();
        renderTabs();
    });

    scopeSelect.addEventListener('change', () => {
        tabSearch.value = '';
        searchQuery = '';
        loadTabs();
    });

    stripParamsCheckbox.addEventListener('change', updateState);
    createLinkBtn.addEventListener('click', createLink);
    titleInput.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !createLinkBtn.disabled) createLink();
    });

    copyBtn.addEventListener('click', async () => {
        if (await copyText(linkOutput.value)) {
            flashIcons(copyIcon, checkIcon);
        } else {
            linkOutput.focus();
            linkOutput.select();
        }
    });

    viewToggleBtn.addEventListener('click', () => showHistory(historyView.classList.contains('hidden')));
    clearHistoryBtn.addEventListener('click', async () => {
        await LinkLeaf.clearHistory();
        renderHistory();
    });

    populateGroups().then(loadTabs);
});
