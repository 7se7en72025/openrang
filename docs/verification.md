# Release verification — 22 October 2026

Verified locally on Windows with installed Google Chrome:

- TypeScript check and Vite production build.
- Seven Playwright tests against the built production bundle, including the real IMG.LY model and photo.
- Text editing, duplication, undo, custom resize, project download/import, reload restoration.
- PNG file signature, logical dimensions and transparent corner pixel at 2× resolution.
- SVG text content and PDF file signature.
- Image project roundtrip and persisted brand-kit name.
- Rejection of invalid projects, unknown Fabric classes and remote image URLs without losing the current design.
- Storage quota failure is shown accurately while editable project download remains available.
- Desktop/mobile screenshots and viewport overflow check.

Background-removal verification checks both transparent and solid pixels in actual inference output. This verifies the integration works on this machine; it does not establish segmentation quality for all images or performance on phones.

The latest source is checked again during publication. Safari, Firefox, mobile hardware and GitHub-hosted CI were not part of the local checks. See README for feature limits.
