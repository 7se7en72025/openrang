# Contributing

Make the complete editor workflow better before adding another panel.

1. Use Node.js 24 and `npm ci`.
2. Keep image processing local. Do not silently add tracking, paid APIs or document uploads.
3. Validate imports before replacing a design. Failed loading, saving and inference must preserve recoverable work.
4. Run `npm run build` and relevant Playwright tests; exercise changed controls in the browser.
5. Use original or licensed assets and retain upstream notices.

Good first contributions: more original templates, image crop controls, brand-kit import, a project library and accessible canvas navigation. Open an issue before major dependencies or cloud features.
