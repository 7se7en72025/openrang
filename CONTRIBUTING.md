# Contributing

Make the complete editor workflow better before adding another panel.

1. Use Node.js 24 and `npm ci`.
2. Keep image processing local. Do not silently add tracking, paid APIs or document uploads.
3. Validate imports before replacing a design. Failed loading, saving and inference must preserve recoverable work.
4. Run `npm run build`, `npm run test:unit`, `npm run check:bundle` and relevant Playwright tests. Exercise the production bundle in both Chrome/Chromium and Firefox.
5. Use original or licensed assets and retain upstream notices.

Good first contributions: more original templates, accessible canvas navigation and improved image-editing ergonomics. Open an issue before major dependencies or cloud features. Keep the version 1 project importer working when extending the document format.
