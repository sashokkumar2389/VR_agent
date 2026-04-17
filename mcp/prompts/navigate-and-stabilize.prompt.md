Navigate to {{url}} and perform the following steps in order:

1. Wait for the page to fully load — all network requests must be settled before proceeding.
2. Scan the visible page for any cookie consent banner, GDPR popup, or privacy overlay.
3. If a consent banner is found:
   a. Click the button labelled "Reject All", "Essential Only", "Decline", or "Necessary Only".
   b. Wait for the banner to fully disappear from the DOM.
4. Scan for any remaining modal dialogs or interstitial overlays and dismiss them if present.
5. Confirm the page viewport is now free of overlays — the main page content must be visible.

{{mcpInstructions}}

When all steps are complete, respond with: STABILIZATION_COMPLETE
