# LinkLeaf: Review and Improvement Plan

This review covers both repositories:

- **linkLeaf**: the Chrome extension (`manifest.json`, `popup.html/js/css`)
- **linkLeafViewer**: the static viewer site at `https://linkleaf.netlify.app/` (`index.html`, `viewer.js`, `about.html`, `privacy.html`, SEO files)

> **Status (2026-10-11):** Everything below is implemented in extension v1.2.0 and the viewer, **except**:
> merging the two repos into one (8), short links (3.2), adding a LICENSE, ESLint/Prettier, i18n, Edge/Firefox
> publishing, drag-to-reorder links, replacing the personal contact email, and checking the Web Store listing. The
> white-on-`#10b981` button contrast (about 2.5:1) is unchanged because it's the brand colour.
> Line numbers below refer to the code **before** these changes.

Every item gives a priority, the file and line, the problem, and a suggested fix. Priorities:

- **P0**: security issue or broken behaviour. Fix before anything else.
- **P1**: affects many users or makes the product look less polished.
- **P2**: worth doing.
- **P3**: nice to have.

---

## 1. Security (P0)

### 1.1 The viewer has an XSS hole that anyone can trigger with a crafted link
**File:** `linkLeafViewer/viewer.js:33-41`

The viewer builds each list item with `innerHTML`, inserting `tab.title`, `tab.url` and `tab.favIconUrl` straight from the URL hash. The hash is fully under the control of whoever creates the link. They don't even need the extension, because the format is just base64 JSON. Three examples:

- A title of `<img src=x onerror="...">` runs arbitrary JavaScript on `linkleaf.netlify.app`.
- A `url` of `javascript:...` becomes a clickable link that runs script when clicked.
- A `favIconUrl` containing `'` or `"` breaks out of the `src`/`onerror` attribute.

**Why it matters:** anyone can send a link on the trusted LinkLeaf domain that runs their script or shows a convincing phishing page ("Your session expired, sign in here"). This is the most important fix in the review.

**Fix:**
- Build the DOM with `createElement`, `textContent` and `setAttribute`. Never put user data into `innerHTML`.
- Only allow `http:` and `https:` URLs (check with `new URL(u).protocol`). Show any other entry as plain, non-clickable text, or drop it.
- Only allow `https:` favicon URLs, and set the fallback with `img.addEventListener('error', ...)` instead of an inline `onerror`.
- Cap the length of titles and URLs, and the number of tabs, so a huge payload can't freeze the page.
- Add a Content-Security-Policy on Netlify, through a `_headers` file or `netlify.toml`. For example: `default-src 'self'; img-src https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'`. This blocks inline scripts as a second line of defence.

### 1.2 The popup inserts page titles as HTML
**File:** `linkLeaf/popup.js:49-53`

`tab.title` and `tab.favIconUrl` go into `innerHTML`. Any website can set its `<title>` to include markup. Manifest V3's default CSP blocks script execution, so this isn't code execution. A malicious page can still inject HTML into the popup: fake elements, broken layout, or images loaded from remote servers.

**Fix:** use the same `createElement` and `textContent` approach as in 1.1.

### 1.3 Shared links can expose sensitive URLs
Users often have tabs with secrets in the URL: password-reset links, document share tokens, OAuth `?code=` parameters, internal admin pages. Everything in the link can be read by anyone who has it, or by anything it gets pasted into, such as chat logs or link-preview bots.

**Fix ideas:**
- Show a short note in the popup: "Anyone with this link can see these URLs."
- Add an optional "Strip query parameters" toggle.
- Warn when a URL contains parameters like `token`, `code`, `key`, `sig` or `session`.

---

## 2. Bugs and broken behaviour

| # | Pri | Where | Problem | Fix |
|---|-----|-------|---------|-----|
| 2.1 | P0 | `linkLeaf/popup.js:51` | The inline `onerror="..."` fallback **never runs in the popup** because MV3's CSP blocks inline event handlers. Tabs without a loadable favicon show a broken image. | Attach the handler with `addEventListener('error', ...)`. |
| 2.2 | P0 | `linkLeafViewer/viewer.js:31` | `fallbackIcon` is literally `'[https://placehold.co/...](https://placehold.co/...)'`, Markdown link syntax pasted into JS. It isn't a valid URL, so the fallback icon is always broken. | Use a plain URL. Better: use a local or inline SVG fallback (see 4.3). |
| 2.3 | P1 | `linkLeaf/popup.html:39,40,49,50` | Same copy-paste problem: `xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)"`. Browsers ignore it for inline SVG, so nothing breaks, but it's wrong. | Use `xmlns="http://www.w3.org/2000/svg"`. |
| 2.4 | P1 | `linkLeaf/popup.js:57-60` | `updateButtonState()` isn't called after the tabs load. If every tab is filtered out (for example, only `chrome://` pages are open), the list is empty, **"Select All" shows as checked** (`[].every()` is `true`), and **the Create button is still enabled**. | Call `updateButtonState()` after `loadTabs()`, handle the empty list, and show an empty-state message ("No shareable tabs in this window"). |
| 2.5 | P1 | `linkLeaf/popup.js:37` | Only `chrome://` is filtered out. `chrome-extension://`, `edge://`, `about:`, `view-source:`, `file://`, `devtools://` and `data:` URLs all get through, but they can't be opened by someone else. | Use an allowlist: keep only `http:` and `https:` tabs. |
| 2.6 | P1 | `linkLeaf/popup.js:45,88` | Chrome sometimes reports `favIconUrl` as a **`data:` URI** that is several KB long. That one tab can make the link huge. | Drop `favIconUrl` from the payload completely and work it out from the domain in the viewer (see 3.1). |
| 2.7 | P1 | `linkLeaf/popup.js:113-114,133-134` | `document.execCommand('copy')` is deprecated, and the code shows "Copied!" without checking whether it worked. | Use `await navigator.clipboard.writeText(url)` in a `try/catch`. On failure, show "Couldn't copy, press Ctrl/Cmd+C" with the field selected. |
| 2.8 | P2 | `linkLeaf/manifest.json:22-27` | `web_accessible_resources` lists `viewer.html` and `viewer.js`, but **neither file exists in the extension**. It's left over from before the viewer moved to Netlify, and `<all_urls>` makes it look broader during store review. | Remove the whole block. |
| 2.9 | P2 | `linkLeaf/popup.js:43,86` | Tabs that are still loading or discarded can have an empty `title`, which ends up as `""` or `"undefined"`. | Fall back to `tab.title \|\| new URL(tab.url).hostname`. |
| 2.10 | P2 | `linkLeafViewer/viewer.js:27` | The count always says "tabs", even for 1 ("1 tabs bundled…"). | Pluralise it. |
| 2.11 | P2 | `linkLeafViewer/viewer.js` | There's no `hashchange` listener. If you paste a different LinkLeaf link into the same viewer tab, the page doesn't update. | Move rendering into a function and call it on load and on `hashchange`. |
| 2.12 | P2 | `linkLeafViewer/viewer.js:17` | `atob` throws on base64url characters and on `%`-escaped hashes. Some chat apps percent-encode or otherwise change long URLs. | Decode with `decodeURIComponent` first and accept both base64 and base64url (see 3.1). |
| 2.13 | P2 | `linkLeafViewer/about.html:118` | The steps say to click **"Generate Link"**, but the button is labelled **"Create & Copy Link"**. | Make the docs match the UI. |
| 2.14 | P3 | `linkLeaf/popup.css:71-79` | `.select-all-container` uses `width: 50%` with `justify-content: flex-end`, so "Select All" sits in an odd place next to the tagline. | Let `.controls` handle the alignment, and remove the 50% width. |
| 2.15 | P3 | `linkLeaf/popup.css:108` | `.tab-item` has `cursor: pointer`, but clicking the favicon or the padding doesn't toggle the checkbox. | Make the whole row a `<label>`, or add a row click handler. |

---

## 3. Link format, length and reliability

### 3.1 Links get very long (P1)
The current encoding is `btoa(encodeURIComponent(JSON.stringify({title, tabs:[{title,url,favIconUrl}]})))`, which stacks two inflating steps: percent-encoding makes every `:`, `/`, `?`, `&` and space three characters, and base64 then adds another 33%. I measured it with realistic-looking tabs:

| Tabs | Current | Plain base64url (no URI-encoding) | Compact keys, no favicon, deflate + base64url |
|------|---------|-----------------------------------|-----------------------------------------------|
| 1 | 536 chars | 363 | 212 |
| 10 | 4,700 | 3,279 | ~300* |
| 20 | 9,352 | 6,546 | ~380* |
| 50 | 23,312 | 16,346 | ~610* |

\*My test data was repetitive, so it compressed unusually well. Real tabs from different sites will shrink less, probably 3–5× instead of 30×. That is still a big improvement.

Links of 10k–20k+ characters cause real problems. SMS, Twitter/X, some email clients and some chat apps truncate or refuse them, and QR codes stop being possible.

**Suggested format (v2):**
```js
// encode
const payload = { v: 2, t: title, l: tabs.map(t => [t.title, t.url]) };
const bytes = new TextEncoder().encode(JSON.stringify(payload));
const deflated = await new Response(
  new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
).arrayBuffer();
const hash = 'v2.' + base64url(deflated);
```
- `CompressionStream` and `DecompressionStream` are built into Chrome and every modern browser, so no library is needed.
- Use **base64url** (`-_`, no `=`) so nothing gets percent-encoded in transit.
- Add a **version prefix**, so the format can change later without breaking old links.
- The viewer must **keep decoding the v1 format** so links people have already shared still work.
- Drop `favIconUrl`. The viewer can get the favicon from the domain, for example `https://www.google.com/s2/favicons?domain=<host>&sz=32` (this sends the domain to Google; mention it in the privacy policy). It could also show a coloured first-letter avatar, which needs no network request at all.

### 3.2 Optional short links (P3, product decision)
A short-link service (Netlify Functions + KV, Cloudflare Workers, and so on) would give tidy URLs like `linkleaf.app/s/abc123`. But it means storing user data on a server. That **contradicts the current "we store nothing" promise**, and the privacy policy would need rewriting. If you build it, make it opt-in, and keep the hash-based link as the default.

---

## 4. Viewer site

### 4.1 Missing features
- **"Open all" button (P1).** This is the most obvious feature the viewer lacks. Browsers block repeated `window.open` calls after the first one, so either:
  - open them one by one from a single click and tell the user to allow pop-ups, or
  - (better) when the extension is installed, use `externally_connectable` in the manifest plus `chrome.runtime.sendMessage` from the viewer so the **extension** opens every tab, optionally in a new window or tab group.
- **"Copy all URLs" (P2)** as plain text or Markdown, for pasting into docs or tickets.
- **Show the domain (P2)** (`docs.google.com`) next to or instead of the full URL. It's easier to scan and safer, because users can see where a link goes.
- **Search/filter (P3)** for leaves with many links.
- **Native share and QR code (P3)**: `navigator.share()` on mobile, and a QR code for phone-to-desktop handoff (only practical once 3.1 is done).

### 4.2 The homepage doubles as an empty viewer (P1)
`index.html` is the sitemap's top-priority page and the page Google indexes. With no hash it shows "Your LinkLeaf" and "No links found in this Leaf." That's a poor landing page for anyone arriving from search or the Web Store.

**Fix:** when there's no hash, render a proper landing section: what LinkLeaf is, a screenshot or GIF, an "Add to Chrome" button, and the three-step how-to. Show the viewer UI only when there's a payload.

### 4.3 Icon files are 1.5 MB each (P1)
`linkLeafViewer/icons/icon16.png`, `icon48.png` and `icon128.png` are **the same 1024×1024, 1.5 MB image** under three names. That's 4.5 MB in the repo, and every page view downloads 1.5 MB just to show a 40px logo and a 16px favicon. Mobile users and Lighthouse scores take the hit.

**Fix:** copy the correctly sized icons from the extension repo (340 B, 779 B and 2.2 KB), or add an SVG favicon.

### 4.4 Link previews and SEO (P2)
- **No Open Graph or Twitter Card tags.** When someone pastes a LinkLeaf link into WhatsApp, Slack, iMessage or LinkedIn, the preview is blank or generic. The hash never reaches the server, so previews can't show the leaf's own title. A good static `og:title`, `og:description` and `og:image` (for example "A bundle of links shared with LinkLeaf") still helps a lot.
- Add `<link rel="canonical">`.
- The sitemap lists `/index.html` instead of `/`, and has no `<lastmod>`.
- Pages linked to each other: the `about.html` and `privacy.html` links on `index.html` use `target="_blank"` without need, which opens a new tab for internal navigation.

### 4.5 Code organisation (P2)
- About 90 lines of CSS are copied between `index.html`, `about.html` and `privacy.html`. Move it into a shared `styles.css`.
- `about.html` and `privacy.html` contain rules for elements they don't have (`.container`, `h1#pageTitle`).
- The footer on About and Privacy says "Generated by LinkLeaf", which only makes sense on a generated leaf.
- Google Fonts is loaded with `@import` inside `<style>`, which blocks rendering. Use `<link rel="preconnect">` plus `<link rel="stylesheet">`, or just use the system font stack the popup already uses.

### 4.6 Accessibility (P2)
- The decorative favicon `<img>` elements have no `alt=""`.
- There's no visible `:focus-visible` style on the link cards or the CTA.
- Error and empty states should use `role="status"` so screen readers announce them.
- Some text contrast is low. `#94a3b8` on white in the footer is about 2.6:1, below WCAG AA (4.5:1).

### 4.7 Dark mode (P3)
Neither the viewer nor the popup supports `prefers-color-scheme: dark`.

---

## 5. Extension popup: UX and features

### 5.1 Quick wins (P1/P2)
- **Indeterminate "Select All" state.** When some but not all tabs are selected, set `selectAllCheckbox.indeterminate = true`.
- **Selected count.** Show "7 of 12 selected" next to Select All, or on the button ("Create link (7)").
- **Pre-select highlighted tabs.** If the user has Shift/Ctrl-selected several tabs (`tab.highlighted`), pre-check only those. That's a natural "share these 3 tabs" flow.
- **Remove duplicate URLs.**
- **Search box** when there are more than about 15 tabs.
- **Pick a scope.** Current window, all windows, or a specific **tab group** (`chrome.tabGroups`; the group name can become the default title).
- **Keyboard shortcut** through `"commands"` in the manifest (for example `Ctrl+Shift+L` to open the popup), and make Enter in the title field create the link.
- **Explain what happens.** For example: "Your link is generated on your device. Nothing is uploaded."

### 5.2 Bigger features (P3)
- **Edit before sharing.** Rename link titles, reorder them, and add an optional note per link or for the whole leaf.
- **Recent leaves history** in `chrome.storage.local`, to re-copy or re-open earlier leaves. (The `storage` permission was removed in `d1cb44a`. It shows no install warning, so adding it back costs little if you want this.)
- **Restore a leaf into tabs.** When a user opens a LinkLeaf link and has the extension, offer "Open all in a new window" or "Open as a tab group" (pairs with 4.1).
- **Context menu.** Right-click → "Share this tab / selected tabs with LinkLeaf".
- **Other browsers.** The code is plain MV3, so publishing to Edge Add-ons is nearly free. Firefox needs small changes.
- **i18n** with `_locales/` and `chrome.i18n`.

---

## 6. Manifest and store listing

| Pri | Item |
|-----|------|
| P2 | Remove the stale `web_accessible_resources` (see 2.8). |
| P2 | Add `"homepage_url": "https://linkleaf.netlify.app/"`. |
| P3 | Add `"short_name"`, `"author"` and `"minimum_chrome_version"` (needed if you use `CompressionStream` or `tabGroups`). |
| P3 | Add `"commands"` for a keyboard shortcut (see 5.1). |
| P2 | Use a three-part version (`1.1.0`) and keep a `CHANGELOG.md`. |

I only reviewed the code and did not check the Chrome Web Store listing itself. It's still worth confirming that the listing's screenshots, description and permission justification match what the extension actually does now.

---

## 7. Privacy policy accuracy (P1)

`privacy.html` says that LinkLeaf does not "collect, store, or transmit any personal information or user data". That's true of *your* servers, but some details are missing or inaccurate:

- The **viewer page loads favicons from every shared site**, so each of those sites sees the viewer's IP address and a request. It also loads `placehold.co` and **Google Fonts** (Google sees the IP).
- **Netlify** logs standard request data for the page itself (IP, user agent). It does not log the hash.
- The policy doesn't mention that **anyone with a link can read every URL in it** (see 1.3).
- It shows a personal Gmail address. Consider a project address such as `linkleaf.support@...`.

**Fix:** add a short "Third-party requests" section, and update it if you adopt the Google s2 favicon service (3.1) or any analytics.

---

## 8. Repository hygiene and tooling

| Pri | Repo | Item |
|-----|------|------|
| P1 | both | **No README.** Add what the project is, how to load it unpacked, how the link format works, and how to deploy the viewer. |
| P2 | linkLeaf | `.DS_Store` and `icons/.DS_Store` are committed. Add a `.gitignore` (`.DS_Store`, `*.zip`, `node_modules/`) and remove them from git. |
| P2 | both | **No LICENSE.** Pick one (MIT is common) if the repos are public. |
| P2 | linkLeaf | Add a packaging script (for example `npm run zip`) that builds the store upload zip from only the needed files. |
| P2 | both | The link format is a contract between two separate repos, and the viewer URL is hard-coded in `popup.js:106`. Consider **one repo** with `extension/` and `viewer/` folders and a shared `codec.js` (encode/decode) used by both, so they can't drift apart. Commit `d1cb44a`/`d076232` ("Decoding url process made more robust") had to land in both repos separately, which shows the cost. |
| P2 | both | Add **tests for the codec**: round-trip, Unicode/emoji titles, very long lists, v1 backward compatibility, and malicious payloads from 1.1. |
| P3 | both | Add ESLint and Prettier, and a GitHub Action that lints and runs the tests. |
| P3 | both | Remove changelog-style comments (`// --- NEW: ...`, `// --- UPDATED: ...`, `// --- FIX: ...`). Git history already records this, and the comments go stale. |

---

## 9. Suggested order of work

1. **Security fixes:** 1.1 (viewer XSS, CSP header) and 1.2 (popup `innerHTML`). Small, contained, important.
2. **Broken behaviour:** 2.1–2.7 (favicon fallbacks, empty state, URL filter, clipboard API) and the 1.5 MB icons (4.3).
3. **Link format v2:** 3.1 (compression, base64url, version prefix, keep v1 decoding). This unlocks QR codes and reliable sharing.
4. **Viewer value:** "Open all" (4.1), a proper landing page (4.2), OG tags (4.4).
5. **Popup polish:** 5.1 quick wins.
6. **Hygiene:** README, `.gitignore`, codec tests, privacy policy update.
7. **Bigger features:** history, restore into tab groups, edit before sharing, Edge/Firefox.
