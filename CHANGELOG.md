# Changelog

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
