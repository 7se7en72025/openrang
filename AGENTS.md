# OpenRang Studio

Build a free, open-source browser design editor. The name must start with Open.

## Required workflow

- Use the Ponytail skill for implementation, dependency choices, tests and review.
- Use the reverse-engineer-anything skill and REA for the requested Canva workflow investigation.
- Use the Sites skill for browser-app implementation, preview and publication.
- If a required skill is unavailable, stop that work and ask the user what to do. Do not silently substitute a workflow or install an unapproved skill.
- Keep research observations separate from implementation choices. Never report unobserved Canva behavior as verified.

## Product scope

Deliver a complete initial workflow: choose a template, edit text and graphics, add a local image, resize the design, save the editable project and export the result.
The user also requested brand kits and background removal; mark any unimplemented capability clearly.
Keep designs local by default. Handle failed saves and invalid project files without destroying the current document.
Use original templates and permitted fonts/assets. Do not claim full Canva Pro compatibility or parity.

## Verification

Run meaningful checks for project loading/saving, undo, resize and export. Test the actual editor in a browser before calling it ready.

The editor now uses version 2 documents with shared assets and multiple pages. Preserve version 1 imports, independent local project identities, atomic saves, recoverable Trash, and lock/group properties through export/import.

Run `npm run test:unit`, `npm run build`, `npm run check:bundle` and relevant production Playwright checks. CI exercises both Chromium and Firefox, offline reload and real model inference. Do not weaken the performance budgets or replace inference tests with mocked success.

Optional cloud files use Sites-authenticated identity and a private R2 bucket. Preserve same-origin writes, per-file permission checks, ETag-conditional updates, revocation and recoverable Trash. Never publish the loopback test identity adapter as hosted authentication. Keep cloud responses out of offline caches. Team sync pauses on conflicts instead of silently overwriting local edits.

Page motion is persisted in version 2 documents. Video uses native browser recording with bounded duration/resolution, playable output and cancellation. Do not describe it as a full video timeline or promise MP4 on every browser.

