# Theseus OpenClaw Plugin

This native OpenClaw plugin exposes two optional tools:

- `theseus_context_read` reads evidence-backed context through the scoped
  STORY-039 Integration API.
- `theseus_weekly_plan_proposal` creates a **pending** weekly-plan proposal;
  it cannot approve or execute a plan change.

The proposal tool is fail-closed. The plugin observes OpenClaw's trusted
`message_received` hook, binds the runtime-provided inbound message ID to its
single `runId`, and injects an opaque reference only in the matching
`before_tool_call` hook. The model never supplies the backend message ID.
References expire after ten minutes and are kept in a bounded in-memory cache,
so concurrent turns in one chat cannot reuse each other's message ID.

## Runtime requirements

- Node 22.22.3+, 24.15+, or a currently supported OpenClaw Node runtime
- OpenClaw 2026.5.17+
- A Theseus integration pairing with `context:read`; proposal drafts also
  require `proposal:create`

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
that opt-in, the proposal tool remains blocked.

Both tools are deliberately optional. Enable or allowlist them only for a
paired account, and revoke the Theseus integration credential when the channel
should no longer receive personal context. The plugin never accesses SQLite,
the filesystem, or a shell.
