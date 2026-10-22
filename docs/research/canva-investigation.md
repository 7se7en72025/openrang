# Canva workflow investigation

Target: https://www.canva.com/
Method: REA's browser runtime workflow, following the installed reverse-engineer-anything skill.

## Questions

- [ ] How does a user start a design and choose its dimensions?
- [ ] How are text, shapes and uploads selected and edited?
- [ ] How are design resizing and export presented?
- [ ] Which requested capabilities require authentication or a paid plan?

## Evidence

REA CLI 6.7.0 executed `capture-browser-scenario` against the target with an owned temporary Chrome profile and DOM/accessibility capture. The browser was cleaned up by REA.

Evidence ID: `ev_70c0f8bdcc567c29acb8d8b220c0ca7dd13b815ce6f9055bc985f557a4c783a9`.

Observed: the final accessibility tree contained "We'll have you designing again soon" and a link to Canva's Cloudflare troubleshooting page. The live design editor was not reached. None of the editor questions above is verified by this run. No attempts were made to bypass the challenge.

The full local evidence is kept in ignored `.research/canva-home-evidence.json`; it is not a distributable asset or application source.

## Implementation decisions

React + TypeScript for the app and Fabric.js for object selection, editable text, transforms and exports. Browser storage is sufficient for the initial local design workflow. These are our implementation choices, not claims about Canva's internal stack.
