# LinkLeaf: Tab Sharer

A Chrome extension that bundles your open tabs into a single shareable link.
[Chrome Web Store](https://chromewebstore.google.com/detail/linkleaf-tab-sharer/olnhckkiecodhbigadomfninaeimaika) · [Website](https://linkleaf.netlify.app/)

The page people see when they open a link lives in a separate repo, **linkLeafViewer**, deployed to `https://linkleaf.netlify.app/`.

## Features

- Pick tabs from the current window, all windows, or a tab group. Search, select all, rename titles.
- Add a title and an optional note.
- Warns about URLs that look like they contain secrets (`token`, `code`, `key`…) and can strip URL parameters.
- **Recent** list of the links you created (stored locally with `chrome.storage.local`).
- Right-click → **Share with LinkLeaf** for the current tab, or all highlighted tabs.
- Keyboard shortcut: `Alt+Shift+L` (change it at `chrome://extensions/shortcuts`).
- Lets the viewer site open a whole leaf as a named tab group in a new window.

## How a link works

Nothing is uploaded. The leaf is packed into the URL fragment (after `#`), which browsers never send to the server.

```
https://linkleaf.netlify.app/#v2.<base64url(deflate-raw(JSON))>
JSON = { "v": 2, "t": "title", "n": "note (optional)", "l": [["link title", "https://…"], …] }
```

Older links (v1.0–1.1) use `btoa(encodeURIComponent(JSON.stringify({title, tabs:[{title,url,favIconUrl}]})))`.
The viewer still decodes them, **so don't remove v1 support**.

`codec.js` does the encoding and decoding, and **must be identical in both repos**. The test suite checks this when
`linkLeafViewer` is checked out next to this repo.

## Project layout

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest |
| `config.js` | Viewer URL and history size |
| `codec.js` | Link format (shared with the viewer) |
| `leaf.js` | URL helpers and history storage, used by the popup and the service worker |
| `background.js` | Context menu, and "open all" requests from the viewer |
| `popup.html/css/js` | The popup UI |
| `tests/` | `node:test` tests for the codec |

## Development

1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and pick this folder.
2. Run the tests (Node 20+): `npm test`
3. To test "Open all" from the viewer with an unpacked build, the viewer has to know your local extension ID. On
   `https://linkleaf.netlify.app`, run this in the console:
   `localStorage.linkleafExtensionId = '<your unpacked extension id>'`

## Releasing

1. Bump `version` in `manifest.json` (and `package.json`) and add a `CHANGELOG.md` entry.
2. `npm run package` creates `dist/linkleaf-<version>.zip` with only the files the extension needs.
3. Upload the zip in the Chrome Web Store dashboard. If permissions changed, update the permission justifications and
   the privacy policy (`linkLeafViewer/privacy.html`).
4. Deploy any viewer changes **before** publishing the extension, so new links always have a viewer that can read them.
