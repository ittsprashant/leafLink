# Changelog

## 1.2.0

### Security
- The popup no longer inserts page titles as HTML.
- Only `http`/`https` tabs can be shared.

### Added
- New compressed link format (`v2.`), usually several times shorter than before. Old links still open.
- Choose tabs from this window, all windows, or a tab group.
- Search tabs, rename titles, add a note, and see "x of y selected".
- "Select all" shows a partial (indeterminate) state.
- Only highlighted tabs are pre-selected when several are highlighted.
- Warning for URLs that look like they contain secrets, and an option to remove URL parameters.
- Recent leaves (copy, open, delete, clear).
- Right-click → "Share with LinkLeaf".
- `Alt+Shift+L` shortcut to open the popup.
- The viewer can ask the extension to open a leaf as a tab group in a new window.
- Redesigned popup: two-line tab rows with domains, dimmed unselected tabs, a collapsible note, a toggle switch for URL parameters, a create button that stays visible as you scroll, and a success card after creating a link.
- Dark mode.

### Fixed
- Broken favicon fallback (inline `onerror` is blocked in MV3), replaced with a letter icon.
- Create button was enabled, and "Select all" checked, when there were no shareable tabs.
- Duplicate tabs are shared once.
- Empty tab titles fall back to the domain.
- Copying now uses the Clipboard API and reports failures.

### Removed
- Unused `web_accessible_resources` entry.

### New permissions
`tabGroups`, `storage`, `contextMenus`. None of these show an install warning.

## 1.1
- Create button disabled when no tabs are selected.

## 1.0
- First release.
