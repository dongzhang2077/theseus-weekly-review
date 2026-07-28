# Theseus OpenClaw Plugin

This native OpenClaw plugin exposes five optional tools:

- `theseus_context_read` reads evidence-backed context through the scoped
  STORY-039 Integration API.
- `theseus_weekly_plan_proposal` creates a **pending** weekly-plan proposal;
  it cannot approve or execute a plan change.
- `theseus_weekly_plan_decision` records an `approve` or `reject` decision for
  a pending proposal; it cannot edit or execute a plan change.
- `theseus_weekly_plan_execute` executes an approved proposal through the
  existing reversible Action service; it never accepts plan content.
- `theseus_weekly_plan_undo` undoes one successful reversible Action from an
  approved proposal; it never accepts plan content.

The proposal-changing tools are fail-closed. The plugin observes OpenClaw's trusted
`message_received` hook, binds the runtime-provided inbound message ID to its
single `runId`, and injects an opaque reference only in the matching
`before_tool_call` hook. The model never supplies the backend message ID.
References expire after ten minutes and are kept in a bounded in-memory cache,
so concurrent turns in one chat cannot reuse each other's message ID.

## Runtime requirements

- Node 22.22.3+, 24.15+, or a currently supported OpenClaw Node runtime
- OpenClaw 2026.5.17+
- A Theseus integration pairing with `context:read`; proposal drafts also
  require `proposal:create`, and proposal decisions require `proposal:decide`
  execution requires `action:execute`, and undo requires the independent
  `action:undo` scope.

## Build and verify

```bash
npm ci
npm test
npm run plugin:build
npm run plugin:validate
```

Run these commands with a supported Node runtime; the package enforces Node
22.22.3+, 24.15+, or 25.9+ and OpenClaw 2026.5.17+. The unit suite exercises
the native SDK registration and the trusted message/run bridge without a
configured Gateway or a real Theseus credential.

## Automated adapter workflow check

From the repository root, this one command prepares a temporary sanitized
Theseus database, starts a temporary API, creates a temporary five-scope
pairing, and verifies context read, proposal draft, approval, execution, and
undo through this plugin's HTTP client. It revokes the pairing and removes all
temporary data afterward. No token or identity needs to be copied into the
terminal.

```bash
python3 scripts/run_openclaw_adapter_e2e.py
```

Use a supported Node runtime. When `node` does not point to one, pass it with
`THESEUS_NODE=/path/to/node python3 scripts/run_openclaw_adapter_e2e.py`.
This checks the real Theseus HTTP boundary and plugin client. The native
OpenClaw host hook registration remains covered by the plugin runtime tests.

Install the local package with `openclaw plugins install` only after the
Theseus API is running and a scoped integration token has been created.
Configure `baseUrl`, `accessToken`, `channelType`, and `externalIdentity` in
the plugin entry. To enable proposal drafting, also configure
`trustedChannelId` and `trustedSenderId` to the exact OpenClaw channel and
host-trusted sender allowed to act for this Theseus pairing. Without both
values, proposal calls are blocked. Treat the token, external identity, and
sender identifier as secrets; never commit them or place them in this package.

For channels that gate inbound hook data, the OpenClaw operator must also opt
this trusted plugin into `message_received` for the specific account. For
example, WhatsApp requires `channels.whatsapp.accounts.<account>.pluginHooks
.messageReceived: true` (or the equivalent channel-level setting). Without
that opt-in, both proposal-changing tools remain blocked.

All tools are deliberately optional. Enable or allowlist them only for a
paired account, and revoke the Theseus integration credential when the channel
should no longer receive personal context. The plugin never accesses SQLite,
the filesystem, or a shell.

## Real API smoke check

After starting a local Theseus API and creating an `openclaw` pairing with
`context:read`, run this read-only check from the plugin directory. It requires
explicit values and prints only a success marker and context schema version;
never put the token in a committed file.

```bash
THESEUS_BASE_URL=http://127.0.0.1:8000 \
THESEUS_ACCESS_TOKEN='<pairing token>' \
THESEUS_EXTERNAL_IDENTITY='<paired identity>' \
THESEUS_WEEK_START=2026-06-08 \
THESEUS_WEEK_END=2026-06-14 \
node scripts/smoke-context.mjs
```
