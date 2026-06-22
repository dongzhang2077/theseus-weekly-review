# Frontend

The frontend should support the minimum workflow needed for the MVP demo.

## MVP Screens

1. Goal and project setup
2. Weekly plan input
3. Time-log input
4. Weekly review result
5. Simple dashboard

## Design Direction

Theseus should feel like a practical review tool, not a motivational landing page.

UI priorities:

- Clear forms
- Dense but readable review output
- Visible evidence for claims
- Calm risk flags
- Limited next steps

## Suggested Stack

- Current shell: static HTML, CSS, and JavaScript with no build dependency.
- Later implementation may move to React or another component framework if the app needs more state complexity.
- Fetch API can be added behind a small API client layer when wiring the backend demo flow.

## Local Run

From the repository root:

```bash
python3 -m http.server 5173 --bind 127.0.0.1 --directory frontend
```

Open:

```text
http://127.0.0.1:5173
```

The static shell can also be opened directly from `frontend/index.html`.

## First Prototype Flow

```text
Open app
  -> Load sample week
  -> Edit goals/plans/logs
  -> Generate review
  -> Display wins, insights, risks, and next steps
```
