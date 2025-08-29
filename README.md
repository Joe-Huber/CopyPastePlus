# CopyPaste+

Expand the functionality of copy/paste in Chrome. CopyPaste+ captures your copied text and gives you a history with favorites and usage counts, available right from the toolbar popup.


## Features

- Automatic capture of copied/cut text from pages and editable fields
- Popup history with sections:
  - Favorites (star items you care about)
  - Most Used (by copy count)
  - Recent Items (chronological)
- Click any item in the popup to copy it back to the clipboard
- Star toggle (☆/★) to mark favorites
- Clear non-favorites action to prune your history quickly
- Persistent storage using chrome.storage.local


## Installation (from source)

1. Clone this repository
2. Install dependencies
   - `npm install`
3. Build the extension
   - `npm run build`
4. Load into Chrome
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the repository root directory


## Usage

- Copy text as you normally do (keyboard shortcuts or menu) on regular web pages
- Click the CopyPaste+ toolbar icon to open the popup
- Click an item to copy it to your clipboard
- Click the star on an item to favorite/unfavorite it
- Use "Clear non-favorites" to keep only starred items

Notes and limitations:
- Chrome restricts extension behavior on certain pages (e.g., `chrome://` pages, the Chrome Web Store, some PDF viewers, new tab, and other special URLs). Copy capture and/or popup copy may not function there.
- Clipboard behavior varies by page and context. The popup uses multiple strategies to write to the clipboard; if one path fails in a given context, another is attempted.

## Development

Requirements:
- Node.js LTS
- npm

Commands:
- Install deps: `npm install`
- Build: `npm run build`

Project structure (high level):
- `manifest.json` — Chrome MV3 manifest
- `background.ts` — background service worker
- `content.ts` — content script (listens to copy/cut)
- `popup.tsx`, `popup.html`, `popup.css` — popup UI (React)
- `dist/` — compiled JS bundles (generated)
- `webpack.config.js` — build configuration

Tips:
- Background/service worker logs: `chrome://extensions` → your extension → "Service worker" → Inspect
- Content script logs: open DevTools on a target page’s frame (not on restricted pages)
- If you modify sources, run `npm run build` and reload the extension


## Permissions rationale

- `storage` — store copy history and item metadata
- `clipboardWrite`, `clipboardRead` — improve clipboard interactions from allowed contexts
- `activeTab`, `scripting` — inject a small copy routine into the active tab as a fallback when direct popup clipboard writes are not available
- `host_permissions: <all_urls>` — allow content script to observe copy events across pages you visit

Privacy: CopyPaste+ does not send your data anywhere. All history is stored locally via `chrome.storage.local` and never leaves your machine.


## Troubleshooting

- I don’t see any captured copies
  - Ensure you’re testing on a normal HTTP/HTTPS page (not `chrome://*` or the Web Store)
  - Open the page console and look for content script logs
  - Reload the extension in `chrome://extensions` and refresh the page
- Clicking an item doesn’t copy
  - Some page contexts can block clipboard access. The popup tries direct write first, then falls back to injecting a copy routine into the active tab. Make sure a normal tab is active and focused
  - Check background logs in the Service Worker console for errors
- Moji-bake stars (e.g., `â˜†`)
  - Ensure `<meta charset="utf-8">` is present in `popup.html` (it is in this repo)


## Contributing

Contributions are welcome!
- Open an issue for bugs and feature requests
- Fork, create a feature branch, and submit a pull request
- Keep PRs focused and include a brief description and testing notes
- Don’t commit build artifacts (`dist/`) or dependencies (`node_modules/`). The repo includes a `.gitignore` that ignores these

Ideas and TODOs:
- Options page (configurable limits, UI preferences)
- Make UI look better
- Search/filter in the popup
- Keyboard shortcuts
- Enable copying on pages that don't allow it


## License

This project is open source. See the `LICENSE` file for details.
