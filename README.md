# PDF Unlocker

A client-side-only web app that removes the open password from a PDF you already have access to. The file never leaves your browser.

**Live:** [kongkrit.github.io/PDF-Unlocker](https://kongkrit.github.io/PDF-Unlocker) *(update once deployed)*

## How it works

1. Drop a PDF (or click to pick one)
2. Enter the password
3. The unlocked file downloads automatically as `<name>-unlocked.pdf`

Decryption runs entirely in a Web Worker via [qpdf](https://qpdf.sourceforge.io/) compiled to WebAssembly (`@neslinesli93/qpdf-wasm`). No server. No upload. No tracking.

## Features

- **Drag-and-drop or click to select** — both work
- **Auto-trigger** — decryption starts as soon as a file and password are both present
- **Permissions-only PDFs** — leave the password blank; `--decrypt` removes owner restrictions without an open password
- **Clear errors** — wrong password, corrupt file, and qpdf errors are all surfaced distinctly
- **Installable PWA** — works fully offline after first visit; WASM vendored locally, no CDN at runtime
- **GitHub Pages compatible** — relative paths throughout; works under a repo subpath

## Technical notes

| Concern | Approach |
|---|---|
| PDF engine | `qpdf --decrypt` (object-level; bytes preserved, no re-render) |
| Threading | `qpdf-wasm` v0.3.0 is single-threaded — no `SharedArrayBuffer`/COOP/COEP needed |
| Worker | `new Worker('./worker.js', { type: 'module' })` keeps the main thread unblocked |
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

No build step. Serve the repo root over HTTP (required for ES modules and the service worker):

```bash
npx serve .
# or
python3 -m http.server
```

Open `http://localhost:3000` (or whatever port). HTTPS is not required on localhost for SW registration.

## Deploy

Push to `main` — the [Pages workflow](.github/workflows/pages.yml) deploys automatically. Enable GitHub Pages in repo settings (source: GitHub Actions) on first use.

## License

MIT
