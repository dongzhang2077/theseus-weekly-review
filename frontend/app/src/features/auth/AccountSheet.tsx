import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  listIntegrations,
  pairIntegration,
  readIntegrationContext,
  revokeIntegration,
  type IntegrationChannelType,
  type IntegrationCredential,
  type IntegrationScope
} from "../../shared/api/integrations";
import type { FetchLike } from "../../shared/api/loadAppWeek";
import { AuthClient, type AuthAccount } from "../../shared/auth/AuthClient";
import { Icon } from "../../shared/icons/Icon";

interface AccountSheetProps {
  open: boolean;
  account: AuthAccount;
  client: AuthClient;
  onClose: () => void;
  onAccountChange: (account: AuthAccount) => void;
  onSignedOut: () => void;
  onOpenAssistant?: () => void;
  apiBaseUrl?: string;
  fetchImpl?: FetchLike;
}

type AccountView = "overview" | "profile" | "email" | "password" | "integrations" | "delete";

export function AccountSheet({
  open,
  account,
  client,
  onClose,
  onAccountChange,
  onSignedOut,
  onOpenAssistant,
  apiBaseUrl,
  fetchImpl
}: AccountSheetProps) {
  const [view, setView] = useState<AccountView>("overview");

  useEffect(() => {
    if (!open) {
      setView("overview");
    }
  }, [open]);

  if (!open) return null;

  function back() {
    if (view === "overview") onClose();
    else setView("overview");
  }

  return (
    <div className="absolute inset-0 z-40 flex items-end" role="presentation">
      <button className="absolute inset-0 border-0 bg-desk-ink/25 backdrop-blur-[1px]" type="button" aria-label="Close account settings" onClick={onClose} />
      <section className="relative z-10 flex max-h-[88%] w-full flex-col overflow-hidden rounded-t-[24px] border border-b-0 border-desk-line bg-desk-paper text-desk-ink shadow-[0_-16px_40px_rgb(43_41_38/0.16)] before:absolute before:bottom-0 before:left-8 before:top-0 before:border-l before:border-desk-danger/15" role="dialog" aria-modal="true" aria-labelledby="account-sheet-title">
        <header className="grid grid-cols-[44px_1fr_44px] items-center border-b border-desk-line px-3 py-2">
          <button className={iconButtonClass} type="button" aria-label={view === "overview" ? "Close account settings" : "Back to account"} onClick={back}>
            <Icon name={view === "overview" ? "chevronDown" : "chevronLeft"} className="size-5" />
          </button>
          <h2 id="account-sheet-title" className="m-0 text-center text-base font-bold">{accountTitle(view)}</h2>
          <button className={iconButtonClass} type="button" aria-label="Close account settings" onClick={onClose}>
            <Icon name="x" className="size-5" />
          </button>
        </header>
        <div className="relative overflow-y-auto pb-6 pl-12 pr-4 pt-4">
          {view === "overview" ? (
            <AccountOverview
              account={account}
              client={client}
              onOpen={setView}
              onSignedOut={onSignedOut}
              onOpenAssistant={onOpenAssistant}
              integrationsAvailable={Boolean(apiBaseUrl && fetchImpl)}
            />
          ) : null}
          {view === "profile" ? (
            <ProfileForm account={account} client={client} onSaved={(updated) => { onAccountChange(updated); setView("overview"); }} />
          ) : null}
          {view === "email" ? (
            <EmailForm account={account} client={client} onSaved={(updated) => { onAccountChange(updated); setView("overview"); }} />
          ) : null}
          {view === "password" ? (
            <PasswordForm client={client} onSaved={(updated) => { onAccountChange(updated); setView("overview"); }} />
          ) : null}
          {view === "integrations" && apiBaseUrl && fetchImpl ? (
            <IntegrationSettings apiBaseUrl={apiBaseUrl} fetchImpl={fetchImpl} />
          ) : null}
          {view === "delete" ? (
            <DeleteForm client={client} onDeleted={onSignedOut} />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function AccountOverview({
  account,
  client,
  onOpen,
  onSignedOut,
  onOpenAssistant,
  integrationsAvailable
}: {
  account: AuthAccount;
  client: AuthClient;
  onOpen: (view: AccountView) => void;
  onSignedOut: () => void;
  onOpenAssistant?: () => void;
  integrationsAvailable: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await client.logout();
    setBusy(false);
    if (result.ok) {
      onSignedOut();
      return;
    }
    setError(result.error?.message ?? "Could not sign out. Try again.");
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-3 rounded-[14px] border border-desk-line bg-desk-raised p-4 shadow-[0_5px_16px_rgb(66_58_45/0.07)]">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-desk-accent-soft text-base font-bold text-desk-accent" aria-hidden="true">
          {account.display_name.trim().charAt(0).toLocaleUpperCase() || "U"}
        </span>
        <div className="min-w-0">
          <div className="truncate font-bold">{account.display_name}</div>
          <div className="truncate text-sm text-desk-muted">{account.email}</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-desk-accent">Local desk</div>
        </div>
      </div>
      <div className="overflow-hidden rounded-paper border border-desk-line bg-desk-raised">
        {onOpenAssistant ? <AccountRow label="Assistant" onClick={onOpenAssistant} /> : null}
        {integrationsAvailable ? <AccountRow label="Integrations" onClick={() => onOpen("integrations")} /> : null}
        <AccountRow label="Edit profile" onClick={() => onOpen("profile")} />
        <AccountRow label="Change email" onClick={() => onOpen("email")} />
        <AccountRow label="Change password" onClick={() => onOpen("password")} />
      </div>
      <button className="mt-4 min-h-12 w-full rounded-paper border border-desk-line bg-desk-raised px-4 text-sm font-bold text-desk-ink hover:bg-desk-sunk" type="button" disabled={busy} onClick={logout}>
        {busy ? "Signing out" : "Sign out"}
      </button>
      {error ? <div className="mt-3 rounded-paper border border-desk-danger/30 bg-desk-danger-soft px-3 py-2 text-sm font-medium text-desk-danger" role="alert">{error}</div> : null}
      <button className="mt-3 min-h-11 w-full rounded-paper border-0 bg-transparent px-4 text-sm font-bold text-desk-danger hover:bg-desk-danger-soft" type="button" onClick={() => onOpen("delete")}>
        Delete account
      </button>
    </div>
  );
}

function IntegrationSettings({ apiBaseUrl, fetchImpl }: { apiBaseUrl: string; fetchImpl: FetchLike }) {
  const [credentials, setCredentials] = useState<IntegrationCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("OpenClaw");
  const [channelType, setChannelType] = useState<IntegrationChannelType>("telegram");
  const [identity, setIdentity] = useState("");
  const [scopes, setScopes] = useState<IntegrationScope[]>(["context:read"]);
  const [expiry, setExpiry] = useState("86400");
  const [pairing, setPairing] = useState(false);
  const [pairToken, setPairToken] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<IntegrationCredential | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    listIntegrations({ apiBaseUrl, fetchImpl }).then((result) => {
      if (ignore) return;
      if (result.status === "ok" && result.data) setCredentials(result.data);
      else setError(result.error ?? "Integrations could not be loaded.");
      setLoading(false);
    });
    return () => { ignore = true; };
  }, [apiBaseUrl, fetchImpl, reload]);

  function toggleScope(scope: IntegrationScope) {
    setScopes((current) => current.includes(scope)
      ? current.filter((item) => item !== scope)
      : [...current, scope]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pairing || !label.trim() || !identity.trim() || !scopes.length) return;
    setPairing(true);
    setError(null);
    const result = await pairIntegration(
      { apiBaseUrl, fetchImpl },
      {
        label,
        channelType,
        externalIdentity: identity,
        scopes,
        expiresInSeconds: Number(expiry)
      }
    );
    setPairing(false);
    if (result.status === "ok" && result.data) {
      setCredentials((current) => [result.data!.credential, ...current]);
      setIdentity("");
      setPairToken(result.data.access_token);
      return;
    }
    setError(result.error ?? "OpenClaw pairing could not be created.");
  }

  async function revoke() {
    if (!revokeTarget || revoking) return;
    setRevoking(true);
    setError(null);
    const result = await revokeIntegration({ apiBaseUrl, fetchImpl }, revokeTarget.id);
    setRevoking(false);
    if (result.status === "ok") {
      setCredentials((current) => current.map((credential) => credential.id === revokeTarget.id
        ? { ...credential, revoked_at: new Date().toISOString() }
        : credential));
      setRevokeTarget(null);
      return;
    }
    setError(result.error ?? "Integration could not be revoked.");
  }

  async function copyToken() {
    if (!pairToken) return;
    try {
      await navigator.clipboard.writeText(pairToken);
    } catch {
      setError("Copy is unavailable. Select the token and copy it manually.");
    }
  }

  async function runConnectionCheck() {
    if (checking) return;
    const identity = `browser-check-${uniqueSuffix()}`;
    const range = currentWeekRange();
    let credentialId: number | null = null;
    setChecking(true);
    setCheckResult(null);
    setError(null);
    try {
      const pairing = await pairIntegration(
        { apiBaseUrl, fetchImpl },
        {
          label: `Temporary ${channelLabel(channelType)} check`,
          channelType,
          externalIdentity: identity,
          scopes: ["context:read"],
          expiresInSeconds: 300
        }
      );
      if (pairing.status !== "ok" || !pairing.data) {
        setError(pairing.error ?? "Connection check could not create a temporary pairing.");
        return;
      }
      credentialId = pairing.data.credential.id;
      const context = await readIntegrationContext({
        apiBaseUrl,
        accessToken: pairing.data.access_token,
        channelType,
        externalIdentity: identity,
        weekStart: range.start,
        weekEnd: range.end,
        messageId: `browser-check-message-${uniqueSuffix()}`
      });
      if (context.status !== "ok" || !context.data) {
        setError(context.error ?? "OpenClaw connection check failed.");
        return;
      }
      setCheckResult("Connection check passed. The temporary credential was revoked.");
    } finally {
      if (credentialId !== null) {
        const cleanup = await revokeIntegration({ apiBaseUrl, fetchImpl }, credentialId);
        if (cleanup.status !== "ok") {
          setCheckResult(null);
          setError("Connection check finished, but its temporary credential could not be revoked. Revoke it from the list.");
        }
        setReload((value) => value + 1);
      }
      setChecking(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-1 mt-0 text-sm leading-5 text-desk-muted">Pair a trusted channel with your Theseus account.</p>
        <p className="m-0 text-xs leading-5 text-desk-subtle">The access token is displayed once. Theseus stores only a protected token record.</p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-[14px] border border-desk-line bg-desk-raised p-3">
        <div className="text-sm font-bold">Test channel access</div>
        <button className="min-h-10 rounded-paper border border-desk-accent bg-desk-accent px-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:border-desk-line disabled:bg-desk-sunk disabled:text-desk-subtle" type="button" disabled={checking} onClick={runConnectionCheck}>{checking ? "Checking" : "Run check"}</button>
      </div>
      {checkResult ? <div className="rounded-paper border border-desk-accent/30 bg-desk-accent-soft px-3 py-2 text-sm font-medium text-desk-ink" role="status">{checkResult}</div> : null}

      {pairToken ? (
        <div className="rounded-paper border border-desk-accent/30 bg-desk-accent-soft p-3" role="status">
          <div className="text-sm font-bold text-desk-ink">Copy this token into OpenClaw now</div>
          <code className="mt-2 block break-all rounded-[10px] border border-desk-line bg-desk-raised p-3 text-xs text-desk-ink">{pairToken}</code>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className={secondaryButtonClass} type="button" onClick={copyToken}>Copy token</button>
            <button className={primaryButtonClass} type="button" onClick={() => { setPairToken(null); setReload((value) => value + 1); }}>Done</button>
          </div>
        </div>
      ) : (
        <form className="flex flex-col gap-4 rounded-[14px] border border-desk-line bg-desk-raised p-4" onSubmit={submit}>
          <div className="text-sm font-bold">New channel pairing</div>
          <Field label="Channel">
            <select className={fieldClass} value={channelType} onChange={(event) => setChannelType(event.currentTarget.value as IntegrationChannelType)}>
              <option value="telegram">Telegram</option>
              <option value="openclaw">OpenClaw local</option>
            </select>
          </Field>
          <Field label="Label"><input className={fieldClass} maxLength={80} required value={label} onChange={(event) => setLabel(event.currentTarget.value)} /></Field>
          <Field label="OpenClaw identity" hint="Used only to verify requests"><input className={fieldClass} autoComplete="off" maxLength={256} required value={identity} onChange={(event) => setIdentity(event.currentTarget.value)} /></Field>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="text-sm font-bold">Permissions</legend>
            {scopeOptions.map(({ scope, label: scopeLabel }) => (
              <label key={scope} className="flex min-h-10 items-center gap-3 rounded-[10px] px-1 text-sm text-desk-ink hover:bg-desk-sunk">
                <input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />
                {scopeLabel}
              </label>
            ))}
          </fieldset>
          <Field label="Expiry">
            <select className={fieldClass} value={expiry} onChange={(event) => setExpiry(event.currentTarget.value)}>
              <option value="86400">24 hours</option>
              <option value="604800">7 days</option>
              <option value="2592000">30 days</option>
            </select>
          </Field>
          <SubmitButton disabled={pairing || !label.trim() || !identity.trim() || !scopes.length}>{pairing ? "Creating pairing" : "Create pairing"}</SubmitButton>
        </form>
      )}

      <section aria-labelledby="paired-integrations-title">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 id="paired-integrations-title" className="m-0 text-sm font-bold">Paired integrations</h3>
          <button className="min-h-10 rounded-paper border-0 bg-transparent px-2 text-sm font-bold text-desk-accent hover:bg-desk-sunk" type="button" disabled={loading} onClick={() => setReload((value) => value + 1)}>Refresh</button>
        </div>
        {loading ? <div className="rounded-paper border border-desk-line bg-desk-raised px-3 py-4 text-sm text-desk-muted">Loading integrations</div> : null}
        {!loading && credentials.length === 0 ? <div className="rounded-paper border border-desk-line bg-desk-raised px-3 py-4 text-sm text-desk-muted">No channel pairing yet.</div> : null}
        {!loading && credentials.length ? <div className="overflow-hidden rounded-paper border border-desk-line bg-desk-raised">{credentials.map((credential) => (
          <div key={credential.id} className="border-b border-desk-line p-3 last:border-b-0">
            <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-bold">{credential.label}</div><div className="mt-1 text-xs text-desk-muted">{credential.token_prefix} · {credential.scopes.length} permission{credential.scopes.length === 1 ? "" : "s"}</div></div><span className={credential.revoked_at ? "text-xs font-bold text-desk-subtle" : "text-xs font-bold text-desk-accent"}>{credential.revoked_at ? "Revoked" : "Active"}</span></div>
            <div className="mt-2 text-xs text-desk-subtle">Expires {shortDate(credential.expires_at)}{credential.last_used_at ? ` · Used ${shortDate(credential.last_used_at)}` : ""}</div>
            {!credential.revoked_at ? <button className="mt-3 min-h-10 rounded-paper border border-desk-danger/40 bg-transparent px-3 text-sm font-bold text-desk-danger hover:bg-desk-danger-soft" type="button" onClick={() => setRevokeTarget(credential)}>Revoke</button> : null}
          </div>
        ))}</div> : null}
      </section>

      {error ? <div className="rounded-paper border border-desk-danger/30 bg-desk-danger-soft px-3 py-2 text-sm font-medium text-desk-danger" role="alert">{error}</div> : null}
      {revokeTarget ? <div className="rounded-paper border border-desk-danger/30 bg-desk-danger-soft p-3"><div className="text-sm font-bold text-desk-danger">Revoke {revokeTarget.label}?</div><p className="mb-3 mt-1 text-sm leading-5 text-desk-ink">OpenClaw will lose access immediately. This cannot be undone.</p><div className="grid grid-cols-2 gap-2"><button className={secondaryButtonClass} type="button" disabled={revoking} onClick={() => setRevokeTarget(null)}>Cancel</button><button className={dangerButtonClass} type="button" disabled={revoking} onClick={revoke}>{revoking ? "Revoking" : "Revoke access"}</button></div></div> : null}
    </div>
  );
}

function AccountRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="flex min-h-[52px] w-full items-center justify-between border-0 border-b border-desk-line bg-transparent px-4 text-left text-sm font-bold text-desk-ink last:border-b-0 hover:bg-desk-sunk" type="button" onClick={onClick}>
      {label}
      <Icon name="chevronRight" className="size-4 text-desk-subtle" />
    </button>
  );
}

function ProfileForm({
  account,
  client,
  onSaved
}: {
  account: AuthAccount;
  client: AuthClient;
  onSaved: (account: AuthAccount) => void;
}) {
  const [name, setName] = useState(account.display_name);
  const [timezone, setTimezone] = useState(account.timezone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await client.updateProfile({ display_name: name.trim(), timezone: timezone.trim() });
    setBusy(false);
    if (result.ok && result.data) onSaved(result.data);
    else setError(result.error?.message ?? "Profile update failed");
  }

  return (
    <AccountForm onSubmit={submit} error={error}>
      <Field label="Name"><input className={fieldClass} autoComplete="name" required value={name} onChange={(event) => setName(event.currentTarget.value)} /></Field>
      <Field label="Timezone"><input className={fieldClass} autoComplete="off" required value={timezone} onChange={(event) => setTimezone(event.currentTarget.value)} /></Field>
      <SubmitButton disabled={busy || !name.trim() || !timezone.trim()}>{busy ? "Saving" : "Save profile"}</SubmitButton>
    </AccountForm>
  );
}

function EmailForm({
  account,
  client,
  onSaved
}: {
  account: AuthAccount;
  client: AuthClient;
  onSaved: (account: AuthAccount) => void;
}) {
  const [email, setEmail] = useState(account.email);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await client.changeEmail({ email: email.trim(), current_password: password });
    setBusy(false);
    if (result.ok && result.data) onSaved(result.data);
    else setError(result.error?.message ?? "Email update failed");
  }

  return (
    <AccountForm onSubmit={submit} error={error}>
      <Field label="New email"><input className={fieldClass} autoComplete="email" inputMode="email" required type="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} /></Field>
      <Field label="Current password"><input className={fieldClass} autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} /></Field>
      <SubmitButton disabled={busy || !email.trim() || !password}>{busy ? "Updating" : "Change email"}</SubmitButton>
    </AccountForm>
  );
}

function PasswordForm({
  client,
  onSaved
}: {
  client: AuthClient;
  onSaved: (account: AuthAccount) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (next !== confirmation) {
      setError("Passwords do not match");
      return;
    }
    if (next.length < 15) {
      setError("Use at least 15 characters");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await client.changePassword({ current_password: current, new_password: next });
    setBusy(false);
    if (result.ok && result.data) {
      onSaved(result.data.user);
    } else {
      setError(result.error?.message ?? "Password update failed");
    }
  }

  return (
    <AccountForm onSubmit={submit} error={error}>
      <Field label="Current password"><input className={fieldClass} autoComplete="current-password" required type="password" value={current} onChange={(event) => setCurrent(event.currentTarget.value)} /></Field>
      <Field label="New password" hint="15 characters or more"><input className={fieldClass} autoComplete="new-password" minLength={15} maxLength={256} required type="password" value={next} onChange={(event) => setNext(event.currentTarget.value)} /></Field>
      <Field label="Confirm password"><input className={fieldClass} autoComplete="new-password" minLength={15} maxLength={256} required type="password" value={confirmation} onChange={(event) => setConfirmation(event.currentTarget.value)} /></Field>
      <SubmitButton disabled={busy || !current || !next || !confirmation}>{busy ? "Updating" : "Change password"}</SubmitButton>
    </AccountForm>
  );
}

function DeleteForm({ client, onDeleted }: { client: AuthClient; onDeleted: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await client.deleteAccount(password);
    setBusy(false);
    if (result.ok) onDeleted();
    else setError(result.error?.message ?? "Account deletion failed");
  }

  return (
    <AccountForm onSubmit={submit} error={error}>
      <div className="rounded-paper border border-desk-danger/30 bg-desk-danger-soft p-3 text-sm leading-5 text-desk-danger">
        This permanently deletes the account and all goals, plans, sessions, and reviews stored under it.
      </div>
      <Field label="Current password"><input className={fieldClass} autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} /></Field>
      <Field label="Type DELETE"><input className={fieldClass} autoComplete="off" required value={confirmation} onChange={(event) => setConfirmation(event.currentTarget.value)} /></Field>
      <button className="mt-2 min-h-12 rounded-paper border border-desk-danger bg-desk-danger px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:border-desk-line disabled:bg-desk-sunk disabled:text-desk-subtle" type="submit" disabled={busy || !password || confirmation !== "DELETE"}>
        {busy ? "Deleting" : "Delete permanently"}
      </button>
    </AccountForm>
  );
}

function AccountForm({ onSubmit, error, children }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; error: string | null; children: ReactNode }) {
  return <form className="flex flex-col gap-4" onSubmit={onSubmit}>{children}{error ? <div className="rounded-paper border border-desk-danger/30 bg-desk-danger-soft px-3 py-2 text-sm font-medium text-desk-danger" role="alert">{error}</div> : null}</form>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-sm font-bold"><span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><span>{label}</span>{hint ? <small className="font-medium text-desk-subtle">{hint}</small> : null}</span>{children}</label>;
}

function SubmitButton({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  return <button className={`${primaryButtonClass} mt-2`} type="submit" disabled={disabled}>{children}</button>;
}

function accountTitle(view: AccountView): string {
  if (view === "profile") return "Edit profile";
  if (view === "email") return "Change email";
  if (view === "password") return "Change password";
  if (view === "integrations") return "Integrations";
  if (view === "delete") return "Delete account";
  return "Account";
}

const iconButtonClass = "grid size-11 place-items-center rounded-paper border-0 bg-transparent text-desk-muted hover:bg-desk-sunk hover:text-desk-ink";
const fieldClass = "min-h-12 w-full rounded-paper border border-desk-line bg-desk-raised px-3 text-base text-desk-ink outline-none focus:border-desk-accent focus:ring-2 focus:ring-desk-accent-soft";
const primaryButtonClass = "min-h-12 w-full rounded-paper border border-desk-accent bg-desk-accent px-4 text-sm font-bold text-white shadow-paper disabled:cursor-not-allowed disabled:border-desk-line disabled:bg-desk-sunk disabled:text-desk-subtle";
const secondaryButtonClass = "min-h-12 w-full rounded-paper border border-desk-line bg-desk-raised px-4 text-sm font-bold text-desk-ink hover:bg-desk-sunk disabled:cursor-not-allowed disabled:text-desk-subtle";
const dangerButtonClass = "min-h-12 w-full rounded-paper border border-desk-danger bg-desk-danger px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:border-desk-line disabled:bg-desk-sunk disabled:text-desk-subtle";

const scopeOptions: Array<{ scope: IntegrationScope; label: string }> = [
  { scope: "context:read", label: "Read weekly context" },
  { scope: "proposal:create", label: "Create proposals" },
  { scope: "proposal:decide", label: "Record proposal decisions" },
  { scope: "action:execute", label: "Execute approved plan changes" },
  { scope: "action:undo", label: "Undo executed plan changes" }
];

function shortDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function currentWeekRange(now = new Date()): { start: string; end: string } {
  const date = new Date(now);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  const start = localIsoDate(date);
  date.setDate(date.getDate() + 6);
  return { start, end: localIsoDate(date) };
}

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function channelLabel(channelType: IntegrationChannelType): string {
  return channelType === "telegram" ? "Telegram" : channelType === "openclaw" ? "OpenClaw" : channelType;
}
