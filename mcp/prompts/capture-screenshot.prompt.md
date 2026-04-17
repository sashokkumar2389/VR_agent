The page at {{url}} is stable and all overlays have been dismissed. Prepare the page for a full-page screenshot by performing the following steps:

1. Scroll slowly to the bottom of the page — pause briefly at intervals to allow lazy-loaded images, videos, and components to fully render.
2. Wait 2 seconds after reaching the bottom for any deferred content to finish loading.
3. Scroll back to the very top of the page.
4. Wait 1 second for the page to visually settle.
5. Verify that all <img> elements on the page have finished loading (no broken image icons).
6. Confirm the scroll position is at the top (scrollY = 0).

When all steps are complete, respond with: CAPTURE_READY
