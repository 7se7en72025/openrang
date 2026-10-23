# OpenRang Studio

### Your ideas. Your canvas.

[![Check the studio](https://github.com/7se7en72025/openrang/actions/workflows/check.yml/badge.svg)](https://github.com/7se7en72025/openrang/actions/workflows/check.yml)

A free, open-source design studio with transparent exports, multi-page projects, brand kits, on-device background removal, optional cloud/team sync and animated video exports.

![OpenRang editor](docs/screenshots/editor-desktop.png)

**No watermark. No API key.** The local editor needs no account. Designs stay in your browser unless you explicitly save them to cloud. OpenRang is independent of Canva and does not import its proprietary files or assets.

## Create, save, come back tomorrow

- Start with 20 original starting designs, including blank: posts/stories, thumbnails, slides, cards, menus, a resume and letterhead.
- Save multiple designs in a local library; duplicate, search, trash and restore them.
- Use up to 20 pages per design. Add, duplicate, name, reorder and undo deletion.
- Edit text, shapes and photos with transforms, alignment, named layers, hide/show, lock and group/ungroup.
- Upload custom fonts; embed them in editable projects and SVG, or reuse them through your brand kit and local library.
- Add outlines, shadows, letter/line spacing, underline and strikethrough; effects survive project import/export.
- Browse a searchable local photo/font library and add six original editable graphics.
- Copy/paste, duplicate and nudge layers with keyboard shortcuts; zoom and scroll for detailed edits.
- Crop photos to useful ratios, reposition the crop, flip, and adjust brightness, contrast, saturation or grayscale.
- Remove photo backgrounds with real AI in a cancellable worker. Your original stays recoverable with Undo.
- Keep a brand kit with colors, a font and a logo; download and restore its backup.
- Export transparent PNG, JPEG, SVG, multi-page PDF or an editable OpenRang project.
- Animate pages with fade, rise or zoom; preview and download a short video.
- Optionally sign in, save cloud designs, invite editors, sync team changes and revoke access. Conflicts preserve your local edits.
- Edit offline after the first successful online visit. Install the web app where your browser supports it.

## Run it

Use Node.js 24 LTS and npm.

```sh
git clone https://github.com/7se7en72025/openrang.git
cd openrang
npm ci
npm run dev
```

Build and preview the production app:

```sh
npm run build
npm run preview
```

For the local editor, serve the top-level frontend files in `dist/` over HTTPS on any static host; exclude `server/` and `.openai/` from that static upload. No backend or secrets are needed for local tools. Fonts are bundled. The offline service worker is enabled in production, on HTTPS or localhost.

For optional cloud features, the build also produces a standalone Sites Worker at `dist/server/index.js`. Sites supplies trusted signed-in identity and provisions the `BUCKET` R2 binding declared in `.openai/hosting.json`. See [cloud hosting and its trust boundary](docs/cloud.md). Do not expose this Worker directly on a host that accepts untrusted identity headers.

## Your work is local

Designs and the brand kit autosave in IndexedDB on this device. **Download project backups for important work.** Clearing site data removes the local library. Cloud storage is opt-in, through **Cloud and team**; local autosave and cloud save have separate status messages.

File imports stage their contents before replacing the canvas. Opening a design waits for the previous save and persists the newly opened copy before the operation completes. Autosave failures are shown rather than reported as success. Version 1 project files are migrated to the multi-page format; imported copies receive a separate library identity.

Trash is recoverable. Open another design before moving the currently open design to Trash. This release intentionally offers no permanent-delete action.

## Free Pro-style tools

**Background removal:** uses [IMG.LY](https://github.com/imgly/background-removal-js) and CPU ONNX inference. The model/runtime assets download from IMG.LY on first use (tens of MB); your image is processed locally. Inference runs in a cancellable worker that is released after each operation, freeing model memory before encoding the final image. Results depend on the image and device. Empty masks preserve the original photo and show an error.

**Resize:** custom sizes with proportional fit-and-center scaling. This does not automatically redesign a composition.

**Export:** PNG/JPEG at 1×, 2× or 3×, transparent PNG/SVG, and all pages in one PDF. SVG embeds uploaded fonts; built-in fonts retain their names and must be installed on the receiving device. PDF embeds RGB raster pages; CMYK, bleed and editable PDF text are not supported.

**Custom typography:** upload WOFF2/WOFF/TTF/OTF files that you have permission to use and share. Fonts load before text is measured and are pooled once in history/project assets. Up to eight per project or kit, 2 MB per file and 6 MB of embedded font data. Switch text to another font before removing an in-use project font; library/kit removal leaves existing projects intact.

**Reusable assets:** up to 40 local photos/fonts and 64 MB. Listings read thumbnails/metadata and load full files on demand. Uploads/removals update the file and index in one IndexedDB transaction, including when two tabs save together. Removing a library item preserves embedded copies in existing designs. Projects/brand kits provide portable backups.

**Offline:** the core editor, bundled fonts, local library and PNG/JPEG/SVG/project downloads work after core assets are cached. PDF and AI may need an online first use. Offline readiness depends on the browser completing installation and retaining its cache.

**Cloud and team:** save a design, open it from another signed-in device, or create a seven-day editor invite. Up to 20 collaborators can edit a design. Changes sync every four seconds while the connected tab is visible; reopen a cloud design after a page reload. Concurrent whole-document changes pause sync for an explicit choice: keep the local version as a new cloud file, or back up local edits and open the cloud version. Owners can revoke all team access and recover cloud designs from Trash. This is revision-protected file sync, without shared cursors or automatic merging of simultaneous edits.

**Animate and video:** page order is the storyboard. Each page has a 1–15 second duration and a still, fade, rise or zoom effect. Record a silent video up to 60 seconds, 1,920 px per side and 1,080p pixel area. Mixed-size pages fit within the first page’s aspect ratio. Recording takes real time and the tab must remain visible. The browser chooses supported WebM or MP4; there is no guaranteed MP4, audio mixing or clip timeline.

## Checks

```sh
npm run test:unit
npm run build
npm run check:bundle
npx playwright install chromium firefox
npm test
```

Local Chromium tests use installed Google Chrome; CI uses bundled Chromium. Firefox uses Playwright's browser.

To exercise the actual production build, offline reload and real AI:

```sh
TEST_PRODUCTION=1 TEST_AI=1 TEST_CLOUD=1 npm test
```

PowerShell: set `$env:TEST_PRODUCTION='1'`, `$env:TEST_AI='1'` and `$env:TEST_CLOUD='1'` first. The cloud QA server uses the actual built Worker with an ephemeral R2 contract adapter and test identities on loopback only. CI exercises this production code path in Chromium and Firefox, including actual inference, two-user sync/conflicts/revocation, playable animated video and cancellation. This adapter does not replace hosted R2 verification.

## Optimization with evidence

The supported CPU inference build omits the unused GPU fallback binary and shares its runtime imports. Frontend assets total about **2.56 MB**, with about **181 kB gzip** of initial JavaScript. The optional hosted Worker embeds those assets and adds about **1.32 MB gzip** of server code; it is not downloaded as initial browser JavaScript. Cloud and video controls load on demand.

Photos are interned once in Undo history and once in project files even when shared across pages. Typing/slider changes coalesce, persistence is debounced, library listings load small metadata records, and PNG/JPEG export uses Blobs.

See [performance measurements and budgets](docs/performance.md) and [verification notes](docs/verification.md). Bundle budgets are enforced in CI.

## Boundaries

OpenRang provides a complete design/save/export workflow with optional team sync and page-animation video. It does not provide Canva file compatibility, a stock-media library, generative-image service, simultaneous conflict-free co-editing or a full video timeline. Safari and real mobile hardware remain unverified.

- Canvas: 100–6,000 px per side, up to 20 pages.
- Per page: 300 elements, 100 groups, at most four nested group levels.
- Images: PNG/JPEG/WebP, up to 12 MB and 25 megapixels.
- Saved projects: 24 MB; imported files: 25 MB. Embedded assets are shared.
- Cloud files: 8 MB each, up to 100 owned files including recoverable Trash. Limits keep request memory bounded. Cloud availability and storage costs depend on the host.
- Raster exports: up to 40 megapixels per page.
- History: up to 50 snapshots with an approximate 48 MB string-data budget; at least two snapshots are retained. Large documents can still use significant memory.
- One local brand kit, including optional embedded custom fonts.
- Autosave waits 450 ms; keep the tab open until it confirms completion.

## Architecture and contributing

React + TypeScript + Vite, Fabric.js, IndexedDB, jsPDF and IMG.LY/ONNX Runtime. Native web platform features provide workers, file downloads and offline caching.

- `src/editor.ts`: canvas mutations, pages, history coordination and exports.
- `src/project.ts`: validation, migration, asset packing and atomic local persistence.
- `src/history.ts`: shared-image undo snapshots.
- `src/StudioPanels.tsx`: projects, pages, layers, crop/adjustments and brand restore.
- `src/DesignTools.tsx`, `src/assets.ts`, `src/fonts.ts`: effects/typography, transactional assets and native font loading.
- `src/background.worker.ts`: isolated CPU segmentation.
- `src/CloudStudio.tsx` and `cloud/api.mjs`: optional cloud/team UI and permission-checked R2 file storage.
- `src/MotionStudio.tsx`, `src/video.ts`, `src/motion.ts`: page animations and native browser recording.
- `src/App.tsx`: editor shell and properties.

[REA research notes](docs/research/canva-investigation.md) record a real Canva capture that reached a Cloudflare challenge. Live editor behavior was not verified; Canva internals were not copied.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md). **AGPL-3.0-only**; upstream notices are in [NOTICE.md](NOTICE.md) and `public/licenses/`. Original templates may be used in your exported designs.

See the [design-tools completion checklist](docs/completion.md) for the agreed scope, verification and supported limits.
