# Theseus OpenClaw Plugin

This package exposes one read-only OpenClaw tool: `theseus_context_read`.
It calls the scoped STORY-039 Integration API and never accesses SQLite,
the filesystem, a shell, or Theseus write operations.

## Runtime requirements

- Node 22.22.3+, 24.15+, or a currently supported OpenClaw Node runtime
- OpenClaw 2026.5.17+
- A Theseus integration pairing with `context:read`

## Build and verify

```bash
npm ci
npm test
npm run plugin:build
npm run plugin:validate
```

Run these commands with a supported Node runtime; the package enforces Node
22.22.3+, 24.15+, or 25.9+ and OpenClaw 2026.5.17+. The unit suite includes an
SDK registration test, so it validates the plugin boundary without a configured
Gateway or a real Theseus credential.

Install the local package with `openclaw plugins install` only after the
Theseus API is running and a scoped integration token has been created.
Configure `baseUrl`, `accessToken`, `channelType`, and `externalIdentity` in
the plugin entry. Treat the token and external identity as secrets; never
commit them or place them in this package.

The plugin is deliberately optional. Enable or allowlist `theseus_context_read`
only for a paired account, and revoke the Theseus integration credential when
the channel should no longer receive personal context. This release never
creates proposals, approves actions, or changes Theseus data.
