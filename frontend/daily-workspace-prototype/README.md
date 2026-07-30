# STORY-040 Daily Workspace HTML Prototype

This is a static, responsive acceptance prototype for the approved
`Today / Insights / Plan` workspace contract. It uses sanitized sample data and
does not call Theseus APIs or modify React application code.

Run from the repository root:

```bash
python3 -m http.server 4173 --directory frontend/daily-workspace-prototype
```

Then open `http://127.0.0.1:4173`.

Direct prototype entry points are available at `#today`, `#insights`, and
`#plan`. The checked reference captures are `mobile.png` (a 430px app shell)
and `desktop.png` for Today, plus `insights.png` and `plan.png` for destination
coverage.

Use the `Prototype` control to inspect loading, empty, sparse, stale, conflict,
save, verification, and error states for the active destination.
