# STORY-040 Daily Workspace HTML Prototype

This is a static, responsive acceptance prototype for the approved
`Today / Insights / Plan` workspace contract. It uses sanitized sample data and
does not call Theseus APIs or modify React application code.

Theseus is treated as a mobile App. The product workspace stays 430px and
single-column at wide browser sizes; the surrounding canvas is only a QA
preview surface, not a desktop information architecture.

Run from the repository root:

```bash
python3 -m http.server 4173 --directory frontend/daily-workspace-prototype
```

Then open `http://127.0.0.1:4173`.

Direct prototype entry points are available at `#today`, `#week`, `#tracker`,
`#running`, `#insights`, `#insights-stale`, `#plan`, `#plan-conflict`, and
`#plan-verified`. Add `?width=320` or `?width=390` before the hash to constrain
the portrait QA shell to an exact viewport width.

The acceptance captures are:

- `today-day-390x844.png`, `today-week-390x844.png`,
  `insights-390x844.png`, and `plan-390x844.png`;
- `today-day-320x844.png` for narrow-width overflow review;
- `desktop-1440x900.png` for the centered portrait workspace;
- `running-activities-390x844.png`, `insights-stale-390x844.png`,
  `plan-conflict-390x844.png`, and `plan-verified-390x844.png`;
- `tracker-390x844.png` plus the earlier `tracker.png` reference.

Use the `Prototype` control to inspect loading, empty, sparse, stale, conflict,
save, verification, and error states for the active destination.

Run the repeatable DOM interaction check after changing the prototype:

```bash
node frontend/daily-workspace-prototype/verify.mjs
```

`browser-verify.html` is the Chromium acceptance harness for the 320px overflow,
drawer focus-entry, focus-wrap, nested Escape, and focus-return checks. It
reports a JSON result and sets `data-browser-qa="passed"` on success.
