# Performance checks

Measured from the local Vite production build on 22 October 2026. These are artifact sizes and an explicit data-structure check, not Lighthouse scores or claims about every user's hardware.

| Metric                                                                     |                                  Result |
| -------------------------------------------------------------------------- | --------------------------------------: |
| Assets before CPU-only runtime selection                                   |                        27,217,942 bytes |
| Assets after removing the unused GPU fallback and duplicate runtime import |                   about 2,512,794 bytes |
| Reduction in deployed asset bytes                                          |                                   90.8% |
| Main JavaScript, gzip (Node zlib defaults)                                 |                            about 172 kB |
| First-load cache                                                           | Core application, CSS and bundled fonts |

The removed 23.9 MB WASM file was the unused GPU fallback. The supported CPU path explicitly receives runtime asset URLs from IMG.LY. The full CPU-capable JavaScript backend is retained for compatibility; the deployment omits its unused GPU fallback artifact. Real-inference tests also check for missing local assets. This is a deployment-size improvement, not a 91% initial-JavaScript reduction. AI model/runtime downloads still happen on first use and are not included in these figures.

`npm run check:bundle` enforces a 200 kB gzip initial-JavaScript budget and a 3 MB deployed-assets budget. Optional AI/PDF tools must stay outside the first-load offline cache.

History interns image strings once and retains small document snapshots with asset references. The model test keeps a 1,000,000-character image string through 50 states with an estimated serialized/string footprint below 2.1 MB, versus roughly 100 MB if every state retained its own UTF-16 image copy. This estimate excludes engine-specific object overhead and is not a heap profiler measurement. Old unreferenced assets are released when history is trimmed.

Typing and sliders coalesce nearby changes, local persistence is debounced, library listings load metadata rather than all full-size documents, and imports stage objects before replacing the current canvas. PNG/JPEG export uses a Blob rather than building an extra base64 string.

AI inference lives in a dedicated worker and uses transferable pixel buffers. The real-model browser test opens and closes Help during inference to check that controls remain usable. Cancelling terminates the worker; an idle worker is released after 90 seconds.
