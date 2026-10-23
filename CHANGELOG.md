# Changelog

## 0.4.0

- Embedded custom fonts with native decoding, content-hash identities and pooled project/history assets.
- Portable typography in editable projects, SVG and brand kits; unused project fonts can be removed safely and restored with Undo.
- Outline, drop shadow, line/letter spacing, underline and strikethrough with validated roundtrips.
- 12 additional original layouts in real story, thumbnail, slide, card and document formats; 20 starting designs total, including blank.
- Searchable local photo/font library with thumbnails, on-demand reads, atomic cross-tab saves/removals and bounded storage.
- Six original editable graphics: star, heart, arrow, flower, checker and speech bubble.
- Preserve project copies after library removal; reject corrupt/tampered fonts before replacing the canvas.
- Guard asynchronous image insertion if the user changes pages while decoding.
- Report brand-kit storage failures accurately and support larger font-bearing kit backups.

## 0.3.0

- Optional signed-in cloud library backed by R2, including recoverable cloud Trash.
- Revocable seven-day editor invitations, up to 20 collaborators and automatic four-second sync in an active connected tab.
- Atomic ETag-conditional writes prevent simultaneous edits from silently overwriting each other. Conflict recovery saves a separate local backup or creates a new cloud design.
- Owner-only team revocation and server-side permission checks on every file operation.
- Page durations and still/fade/rise/zoom animation persisted in editable projects.
- Preview/download native browser video, with cancellation, a 60-second limit and bounded output resolution.
- Lazy-load cloud/video tools; preserve frontend budgets and add a 2 MB gzip Worker budget.
- Production Worker browser coverage for two-account sync, conflicts, revoked access, animated video playback and cancellation.

## 0.2.0

- Saved-design library with thumbnails, duplication and recoverable Trash.
- Up to 20 pages per design; add, duplicate, name, reorder and undo page deletion.
- Export all pages to PDF; add JPEG export alongside transparent PNG, SVG and editable projects.
- Center crop presets, crop positioning, flip, brightness, contrast, saturation and grayscale.
- Named layers, hide/show, lock, group/ungroup, multi-selection, copy/paste and keyboard nudging.
- Restore a brand-kit backup, including its logo.
- Manual zoom and a scrollable canvas.
- Installable web-app manifest and offline core-editor reload after the first online visit.
- Asset references in history and project files avoid copying photos for each page or edit.
- AI segmentation runs in a cancellable worker; raw pixel transfers avoid worker canvas inconsistencies, and empty masks preserve the original image.
- Retain the CPU-capable ONNX backend while removing unused GPU fallback assets and a duplicate runtime import from deployment.
- Add model/history tests, production Chrome and Firefox coverage, and enforced bundle budgets.

## 0.1.0

Initial single-canvas editor: original templates, text/shapes/uploads, background removal, brand kit, resize, layers, undo, local autosave and exports.
