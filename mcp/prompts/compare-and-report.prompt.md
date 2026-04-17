Screenshot capture for page "{{pageName}}" on browser "{{browser}}" is complete.

Evaluate the result:
- Baseline path: baselines/{{browser}}/{{pageName}}.png
- Diff threshold: {{threshold}}% maximum pixel difference

Determine the outcome:
- PASS — the screenshot is identical to the baseline or within the {{threshold}}% threshold.
- WARN — the screenshot differs but is within an acceptable tolerance (developer review recommended).
- FAIL — the screenshot exceeds the {{threshold}}% threshold; a visual regression has been detected.

Report the outcome in this exact format:
COMPARISON_RESULT: <PASS|WARN|FAIL> | diffRatio=<value> | page={{pageName}} | browser={{browser}}
