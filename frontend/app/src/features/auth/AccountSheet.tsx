import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AuthClient, type AuthAccount } from "../../shared/auth/AuthClient";
import { Icon } from "../../shared/icons/Icon";

interface AccountSheetProps {
  open: boolean;
  account: AuthAccount;
  client: AuthClient;
  onClose: () => void;
  onAccountChange: (account: AuthAccount) => void;
  onSignedOut: () => void;
}

type AccountView = "overview" | "profile" | "email" | "password" | "delete";

export function AccountSheet({
  open,
  account,
  client,
  onClose,
  onAccountChange,
  onSignedOut
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
  onSignedOut
}: {
  account: AuthAccount;
  client: AuthClient;
  onOpen: (view: AccountView) => void;
  onSignedOut: () => void;
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
  return <label className="flex flex-col gap-1.5 text-sm font-bold"><span className="flex justify-between">{label}{hint ? <small className="font-medium text-desk-subtle">{hint}</small> : null}</span>{children}</label>;
}

function SubmitButton({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  return <button className={`${primaryButtonClass} mt-2`} type="submit" disabled={disabled}>{children}</button>;
}

function accountTitle(view: AccountView): string {
  if (view === "profile") return "Edit profile";
  if (view === "email") return "Change email";
  if (view === "password") return "Change password";
  if (view === "delete") return "Delete account";
  return "Account";
}

const iconButtonClass = "grid size-11 place-items-center rounded-paper border-0 bg-transparent text-desk-muted hover:bg-desk-sunk hover:text-desk-ink";
const fieldClass = "min-h-12 w-full rounded-paper border border-desk-line bg-desk-raised px-3 text-base text-desk-ink outline-none focus:border-desk-accent focus:ring-2 focus:ring-desk-accent-soft";
const primaryButtonClass = "min-h-12 w-full rounded-paper border border-desk-accent bg-desk-accent px-4 text-sm font-bold text-white shadow-paper disabled:cursor-not-allowed disabled:border-desk-line disabled:bg-desk-sunk disabled:text-desk-subtle";
