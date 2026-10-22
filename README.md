# OpenRang Studio

### Your ideas. Your canvas.

A free, open-source browser design studio with useful Pro-style tools: transparent exports, custom resizing, brand kits and on-device background removal.

![OpenRang editor](docs/screenshots/editor-desktop.png)

**No account. No watermark. No API key.** Your design and photos stay in your browser. This is an independent project, not affiliated with Canva. It does not import Canva files or assets.

Source: [7se7en72025/openrang](https://github.com/7se7en72025/openrang).

## Available now

- Eight original starting points, including a blank canvas.
- Text editing with bundled Inter and Space Grotesk, plus system fonts.
- Shapes, image uploads, transforms, layers, alignment and duplication.
- Undo/redo and custom-size proportional fit-and-center resizing.
- One local brand kit: colors, font and reusable logo.
- Real on-device AI background removal using [IMG.LY](https://github.com/imgly/background-removal-js).
- Transparent PNG, 1×/2×/3× raster export, SVG and raster PDF.
- Editable JSON import/export with embedded images.
- IndexedDB autosave, clear save failures and imports that preserve the current design if rejected.
- Responsive controls and keyboard shortcuts.

## Run it

Use Node.js 24 LTS and npm.

```sh
npm ci
npm run dev
```

Open the local Vite URL. Build and preview a static deployment:

```sh
npm run build
npm run preview
```

Serve `dist/` on any static host over HTTPS. No server, database or secrets are needed. Fonts are bundled. Background removal downloads model assets from IMG.LY on first use; your image is processed locally.

## Try it

1. Pick a template. The previous design remains available with Undo.
2. Select text from Layers, or double-click it on the canvas.
3. Add a photo from Uploads, select it and choose **Remove background**.
4. Resize to a story or custom size.
5. Export a transparent PNG, or download an **OpenRang project** to edit later.

Autosave stores one canvas in this browser. Clearing site data removes the project and brand kit. Download editable project backups for important work.

## Checks

```sh
# Locally uses installed Google Chrome.
npm test

# CI uses bundled Chromium.
npx playwright install chromium
CI=1 npm test

# Optional real-model/network test.
TEST_AI=1 npm test -- tests/background.spec.ts
```

PowerShell: set `$env:TEST_AI='1'` before the last command. The real-model test downloads assets and checks that output contains transparent and solid pixels. Normal tests exercise editing, undo, resize, image/project roundtrips, PNG dimensions and alpha, SVG/PDF signatures, storage failure, rejected remote URLs, brand persistence and mobile layout.

## Honest limits

Initial release, not full Canva Pro parity. One canvas per project, one local brand kit and eight original templates. No cloud sync, collaboration, video, animation, stock-photo library, generative image service or proprietary-format import.

- Resize scales and centers artwork; it does not intelligently redesign a composition.
- PDF contains a raster RGB page, without CMYK, bleed or editable text. SVG text needs the same fonts on the receiving device.
- AI requires a first-use model download (tens of MB), can be slow and may produce imperfect edges.
- Images: PNG/JPEG/WebP, up to 12 MB and 25 megapixels.
- Canvas: 100–6,000 px per side, 300 layers, roughly 25 MB per project, 40 megapixels per raster export.
- History: up to 30 snapshots / about 24 MB serialized, retaining at least two. Large images use significant memory.
- Autosave waits 450 ms after editing. Keep the tab open until the save indicator confirms completion; leaving during a pending save or AI operation triggers a browser warning.
- Local Chrome tests were run. The supplied GitHub CI workflow has not run remotely; Safari and Firefox are unverified.

## Architecture

React + TypeScript + Vite for the interface; Fabric.js for editing/rendering; IndexedDB for local persistence; jsPDF for raster PDFs; IMG.LY and ONNX Runtime for segmentation.

- `src/project.ts`: file validation and persistence.
- `src/editor.ts`: canvas mutations, history and exports.
- `src/templates.ts`: original templates.
- `src/App.tsx`: editing controls.

[REA research notes](docs/research/canva-investigation.md) record an actual Canva capture that reached a Cloudflare challenge. Live editor behavior was not verified; no Canva internals were copied.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md). **AGPL-3.0-only**; see [LICENSE.md](LICENSE.md) and [NOTICE.md](NOTICE.md). Original templates may be used in exported designs.
