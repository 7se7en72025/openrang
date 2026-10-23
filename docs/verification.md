# Release verification — 0.4.0

The release workflow builds the actual production Worker, enforces bundle budgets and exercises 23 browser scenarios in both Chromium and Firefox. See the [current workflow results](https://github.com/7se7en72025/openrang/actions/workflows/check.yml) for the exact source commit and run status.

## Data and history checks

Twelve Node tests cover legacy migration, shared image/font pooling, validation, coalesced history, undo branches, authored layouts/graphics, motion and cloud permissions/concurrency/Trash. A one-million-character image string is retained once across 50 history states.

## Production browser checks

- Text editing, duplication, undo, resizing, file import/export and reload restoration.
- Correct PNG dimensions, transparent pixels, SVG text, JPEG and PDF file signatures.
- Multi-page PDF page count, page ordering, names and undoing page deletion.
- Crop offsets, photo filters, flipping and shared images after project-file roundtrips.
- Group/ungroup geometry, multi-selection appearance and persisted lock flags.
- A saved-design library, separate copies, recoverable Trash and opening the last project after reload.
- Brand-kit restore and manual zoom without changing document dimensions.
- Storage quota failure, rejected remote images, invalid classes and preservation of the current design.
- Desktop and 390 px responsive layouts.
- Real model inference, with both foreground and transparent output pixels, and no missing local runtime assets.
- Opening/closing Help during inference and cancellation without losing the original image.
- Offline reload, editing, saving and another offline reload after service-worker readiness.
- Two isolated test accounts: private cloud save, invite acceptance, automatic sync with the dialog closed, manual sync, explicit conflict backup and owner revocation.
- Real canvas recording: playable video with correct dimensions and different animated frames, downloadable bytes, saved page settings and cancellation.
- Actual uploaded WOFF2 font: native decoding, SVG embedding, project reload/import, brand reuse, safe removal/Undo and tamper rejection.
- Outline, drop shadow, line/letter spacing and decorations surviving project roundtrip.
- Every new template format's real dimensions and editable text.
- Library reuse/removal, two-tab uploads and transaction rollback after an index-write failure.

Local checks use installed Chrome and Playwright Firefox. On this resource-constrained Windows machine, Chrome's headless test uses software rendering; CI uses default bundled Chromium. Temporary test profiles were placed on a drive with sufficient space. These are test-environment settings, not requirements imposed on people using the editor.

## Scope and limits

Real inference validates this integration, not segmentation quality for every photo. No foreground detection replaces the original with an empty result; failure, cancellation and timeout leave it recoverable.

Performance figures and automated budgets are documented in [performance.md](performance.md). Safari and real mobile hardware have not been verified. PDF remains raster RGB and offline AI/PDF may require an initial online use. See README for the supported local workflow and remaining product boundaries.

Cloud QA runs the built production Worker against an in-memory R2 contract adapter with loopback-only test identities. It does not prove two real Sites accounts or hosted R2 behavior. The deployed audience is preserved by publication; a successful deployment alone verifies publication, not every signed-in cloud operation.
