# PDF Unlocker

Remove the open password from a PDF you already have access to. **Nothing leaves your device.**

## Features

- **Totally offline** — works with no internet after first visit; WASM engine vendored locally, no CDN
- **No re-rendering** — uses `qpdf --decrypt` (object-level strip); bytes are preserved exactly
- **No server, no upload, no tracking** — decryption runs in a Web Worker in your browser
- **Drag-and-drop or click to select** — both work
- **Auto-trigger** — decryption starts 400ms after you stop typing the password
- **Permissions-only PDFs** — leave the password blank to remove owner restrictions only
- **Dark / light theme** — toggle top-right; preference saved

## Install as app (PWA)

Installs to your device and works fully offline — no browser needed after install.

| Platform | How |
|---|---|
| **Windows** | Open in Edge or Chrome → address bar install icon (⊕) or ⋯ menu → "Install PDF Unlocker" |
| **macOS** | Open in Chrome/Edge → address bar install icon, or ⋯ menu → "Install PDF Unlocker" |
| **macOS Safari** | Share button → "Add to Dock" |
| **iPhone / iPad** | Open in Safari → Share → "Add to Home Screen" |
| **Android** | Open in Chrome → ⋮ menu → "Add to Home screen" |

## Use online

**[kongkrit.github.io/PDF-Unlocker](https://kongkrit.github.io/PDF-Unlocker)**

No install needed. Works in any modern browser.

## How it works

1. Drop a PDF (or click to pick one)
2. Enter the password
3. The unlocked file downloads automatically as `<name>-unlocked.pdf`

## Technical notes

| Concern | Approach |
|---|---|
| PDF engine | `qpdf --decrypt` (object-level; bytes preserved, no re-render) |
| Threading | `qpdf-wasm` v0.3.0 is single-threaded — no `SharedArrayBuffer`/COOP/COEP needed |
| Worker | Classic `Worker` (qpdf.js is UMD, not ESM) — keeps the main thread unblocked |
| Offline | Service worker precaches all assets including `.wasm` on install; cache-first at fetch |
| Instance lifetime | `callMain` calls `exit()` internally — a fresh module is instantiated per file |

## File layout

```
index.html          page shell
styles.css
app.js              main-thread UI + SW registration
worker.js           loads qpdf-wasm, runs --decrypt
sw.js               PWA precache / offline
manifest.webmanifest
vendor/qpdf/
  qpdf.js           Emscripten glue (vendored from @neslinesli93/qpdf-wasm)
  qpdf.wasm
icons/
  icon-192.png
  icon-512.png
  icon-maskable-512.png
.github/workflows/pages.yml   GitHub Pages deploy on push to main
```

## Local development

No build step. Serve the repo root over HTTP:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080` in **incognito** (avoids stale service worker cache during dev).

## Deploy

Push to `main` — the [Pages workflow](.github/workflows/pages.yml) deploys automatically. Enable GitHub Pages in repo settings (source: GitHub Actions) on first use.

## License

MIT
