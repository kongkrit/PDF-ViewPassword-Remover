# PDF Password Stripper — Build Spec

Client-side-only static web app that removes the **open/view password** from a PDF
the user already knows the password to, preserving content byte-for-byte via qpdf's
object-level decrypt (no re-rendering). One codebase, two deploy targets:

- **GitHub Pages** (static hosting)
- **Installable PWA** (offline-capable; works with no network after first load)

No backend. The file never leaves the browser.

> Drop this in the repo root. Rename to `CLAUDE.md` or point Claude Code at it as the
> project brief.

## Hard constraints

- Vanilla JS only. No framework, no bundler, no build step. ES modules + relative paths.
- Engine: `@neslinesli93/qpdf-wasm` (QPDF compiled to WASM via Emscripten; exposes the
  **CLI**, not a library API).
- Fully offline once installed → all assets, **including the `.wasm`**, are vendored
  locally and precached by the service worker. No CDN at runtime.
- Content-preserving decrypt only: `qpdf --decrypt`. Nothing that re-distills.

## Engine integration (qpdf-wasm)

- Ships as ESM: an Emscripten glue JS + `qpdf.wasm`. Vendor **both** into `/vendor/qpdf/`.
- Init: `createModule({ locateFile, noInitialRun: true, printErr })`.
- I/O is the in-memory Emscripten FS — there is no real filesystem:
  - `Module.FS.writeFile('/in.pdf', uint8)`
  - run, then `Module.FS.readFile('/out.pdf')` → `Uint8Array`
- Decrypt: `Module.callMain(['--password', pw, '--decrypt', '/in.pdf', '/out.pdf'])`.
- **Single-shot caveat:** Emscripten `callMain` calls `exit()` and tears down the
  runtime — an instance is effectively one-use. **Instantiate a fresh module per file.**
- **Error signaling:** non-zero exit throws an `ExitStatus`. Wrap `callMain` in
  try/catch and capture qpdf's real message via `printErr`. Wrong password → qpdf exits
  **code 2**; map that to a friendly "incorrect password". Surface other non-zero exits
  with the captured stderr.

## GitHub Pages cross-origin-isolation gotcha — VERIFIED RESOLVED

`@neslinesli93/qpdf-wasm` v0.3.0 is a **single-threaded build**. Confirmed: no
`.worker.js` sidecar and zero references to `pthread`, `SharedArrayBuffer`, `Atomics`,
or any Worker machinery in `qpdf.js`. No COOP/COEP headers are needed; the app works
on GitHub Pages as-is with one service worker (the PWA one). No `coi-serviceworker`
shim required.

## UI / UX

- Single page. A large **drop zone** (dashed border):
  - Drag-and-drop a `.pdf` → accept it. Handle dragover/dragleave visual state.
  - **Clicking the drop zone opens the OS file picker** via a hidden
    `<input type="file" accept="application/pdf">` triggered with `.click()`.
- A **password text input** (open password required to decrypt).
- **Auto-trigger** the unlock once a file + non-empty password are present; provide a
  manual retry button too.
- **Status area:** progress ("decrypting…"), success, and errors (wrong password, not a
  PDF, qpdf error).
- **On success:** auto-download the result as a `Blob` (`application/pdf`), named
  `<originalbasename>-unlocked.pdf`.
- Run qpdf-wasm in a **Web Worker** so the main thread never blocks. Main posts
  `{ bytes, password, name }`; worker replies `{ ok:true, bytes }` or
  `{ ok:false, code, message }`. Worker must be `type: 'module'` for the static import.

Styling: minimal and clean — system font stack, centered card, no UI library. Leave the
exact look to implementation.

## PWA requirements

- `manifest.webmanifest`: `name`, `short_name`, `start_url: "."`, `scope: "."`,
  `display: "standalone"`, `theme_color`, `background_color`, 192 + 512 icons (include a
  maskable icon).
- `sw.js`: precache the full app shell on install; cache-first at fetch so the app is
  fully offline after first load. Precache list **must include**
  `vendor/qpdf/qpdf.js` + `vendor/qpdf/qpdf.wasm` alongside `index.html`, `styles.css`,
  `app.js`, `worker.js`, `manifest.webmanifest`, and icons. Use a `CACHE_VERSION`
  constant; purge old caches in `activate`.
- Register the SW from `app.js` (`'serviceWorker' in navigator` guard).
- **Relative paths everywhere** (no leading `/`) so it works under the Pages subpath
  (`user.github.io/repo/`) and as an installed PWA. `start_url: "."`; add `<base href>`
  only if base resolution misbehaves.
- HTTPS required for SW + install — Pages provides it; `localhost` is exempt for dev.

## File layout

```
/
  index.html
  styles.css
  app.js                 # main-thread UI + SW registration
  worker.js              # loads qpdf-wasm, runs --decrypt
  sw.js                  # PWA precache / offline
  manifest.webmanifest
  vendor/qpdf/
    qpdf.js              # vendored Emscripten glue (from @neslinesli93/qpdf-wasm)
    qpdf.wasm            # vendored module
  icons/
    icon-192.png
    icon-512.png
    icon-maskable-512.png
  README.md
  .github/workflows/pages.yml   # optional: deploy to Pages
```

## Worker decrypt flow (reference)

```js
// worker.js  — instantiate as: new Worker('./worker.js', { type: 'module' })
import createModule from './vendor/qpdf/qpdf.js';

self.onmessage = async (e) => {
  const { bytes, password, name } = e.data;
  let stderr = '';
  try {
    const qpdf = await createModule({
      locateFile: () => new URL('./vendor/qpdf/qpdf.wasm', import.meta.url).href,
      noInitialRun: true,
      printErr: (s) => { stderr += s + '\n'; },
    });
    qpdf.FS.writeFile('/in.pdf', bytes);
    const args = ['--decrypt', '/in.pdf', '/out.pdf'];
    if (password) args.unshift('--password', password);
    qpdf.callMain(args);                       // throws ExitStatus on non-zero exit
    const out = qpdf.FS.readFile('/out.pdf');  // Uint8Array
    self.postMessage({ ok: true, bytes: out, name }, [out.buffer]);
  } catch (err) {
    const code = (err && err.status) ?? -1;
    self.postMessage({ ok: false, code, message: stderr.trim() || String(err) });
  }
};
```

Confirm the package's actual entry filename and adjust the import. The
`import.meta.url`-relative `locateFile` keeps the `.wasm` resolvable under any base path.

## Edge cases

- **Wrong password:** exit code 2 → "Incorrect password."
- **Owner-password-only (permissions) PDF:** `--decrypt` with no password removes it;
  don't force a password entry in this case.
- **Unencrypted PDF dropped:** `--decrypt` copies it through — succeed, optionally note
  "no password was set."
- **Non-PDF / corrupt:** qpdf errors; show the captured message.
- **Large files:** all in memory; fine within tab limits — just don't retain extra
  copies.
- **Digitally signed PDFs:** decrypt invalidates the signature (bytes change). Optional
  warn if a `/Sig` is present. Low priority.

## Acceptance checklist

- [ ] Drag-drop AND click-to-pick both load a PDF.
- [ ] Correct password yields a downloadable `*-unlocked.pdf` that opens with no password
      and identical content.
- [ ] Wrong password shows a clear error, no crash.
- [ ] qpdf runs in a Worker; UI stays responsive.
- [ ] Loads and unlocks **fully offline** after first visit; installable as a PWA.
- [ ] Works from a GitHub Pages project subpath (relative paths verified).
- [ ] Threading model confirmed; if threaded, isolation handled and documented.

## First steps for Claude Code

1. Pull `qpdf.js` + `qpdf.wasm` from `@neslinesli93/qpdf-wasm` v0.3.0 (tarball:
   `https://registry.npmjs.org/@neslinesli93/qpdf-wasm/-/qpdf-wasm-0.3.0.tgz`) and
   copy into `vendor/qpdf/`. Entry filename is `dist/qpdf.js`. Threading already
   verified single-threaded — no further checks needed.
2. Build the static shell + worker; get decrypt working in the browser first (skip PWA).
3. Layer in the manifest + service worker; verify offline.
4. Add the Pages workflow; verify on the live subpath.
