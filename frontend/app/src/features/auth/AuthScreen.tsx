import { useState, type FormEvent, type ReactNode } from "react";
import type {
  AuthResult,
  LoginPayload,
  RegisterPayload,
  SessionResult
} from "../../shared/auth/AuthClient";
import { Icon } from "../../shared/icons/Icon";

export type AuthGatePhase = "restoring" | "signed_out" | "unavailable";

interface AuthScreenProps {
  phase: AuthGatePhase;
  onLogin: (payload: LoginPayload) => Promise<AuthResult<SessionResult>>;
  onRegister: (payload: RegisterPayload) => Promise<AuthResult<SessionResult>>;
  onRetry: () => void;
}

type AuthMode = "login" | "register";

export function AuthScreen({ phase, onLogin, onRegister, onRetry }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("login");

  return (
    <AuthFrame mode={mode}>
      {phase === "restoring" ? <AuthStatus title="Opening your desk" /> : null}
      {phase === "unavailable" ? (
        <AuthStatus
          title="Local service unavailable"
          message="Start the Theseus API, then try again."
          actionLabel="Retry"
          onAction={onRetry}
        />
      ) : null}
      {phase === "signed_out" && mode === "login" ? (
        <LoginForm onSubmit={onLogin} onCreate={() => setMode("register")} />
      ) : null}
      {phase === "signed_out" && mode === "register" ? (
        <RegisterForm onSubmit={onRegister} onBack={() => setMode("login")} />
      ) : null}
    </AuthFrame>
  );
}

function AuthFrame({ mode, children }: { mode: AuthMode; children: ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-desk-canvas min-[431px]:p-6">
      <div className="pointer-events-none absolute -right-8 -top-7 size-36 rounded-full border border-desk-accent/15 bg-desk-accent-soft/55" aria-hidden="true" />
      <div className="pointer-events-none absolute right-9 top-3 h-14 w-7 -rotate-[28deg] rounded-[100%_0_100%_0] bg-desk-accent/15" aria-hidden="true" />
      <main className="relative h-dvh w-full max-w-[430px] overflow-y-auto bg-desk-paper pb-8 pl-11 pr-5 pt-5 text-desk-ink before:absolute before:bottom-0 before:left-7 before:top-0 before:border-l before:border-desk-danger/20 min-[431px]:h-[min(932px,calc(100dvh-48px))] min-[431px]:min-h-[720px] min-[431px]:rounded-[28px] min-[431px]:border min-[431px]:border-desk-line min-[431px]:shadow-[0_18px_48px_rgb(66_58_45/0.16)]">
        <BindingMarks />
        <header className="relative z-10 mb-12 flex items-center justify-between border-b border-desk-line pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[10px] border border-desk-accent/20 bg-desk-accent-soft text-desk-accent shadow-paper" aria-hidden="true">
              <Icon name="book" className="size-5" />
            </span>
            <div>
              <div className="text-lg font-bold tracking-[-0.02em]">Theseus</div>
              <div className="text-xs font-medium text-desk-muted">Private weekly desk</div>
            </div>
          </div>
          <span className="-rotate-2 rounded-md border border-dashed border-desk-warn/50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-desk-warn">
            Local
          </span>
        </header>
        <section className="relative z-10 rounded-[18px] border border-desk-line bg-desk-raised px-4 pb-5 pt-6 shadow-[0_8px_24px_rgb(66_58_45/0.09)]">
          <span className="absolute -top-7 right-3 rounded-t-[9px] border border-b-0 border-desk-line bg-desk-accent-soft px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-desk-accent">
            {mode === "register" ? "New page" : "Sign in"}
          </span>
          {children}
        </section>
        <div className="relative z-10 mx-auto mt-5 flex w-fit items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-desk-subtle" aria-hidden="true">
          <span className="h-px w-7 bg-desk-line" />
          Stored on this device
          <span className="h-px w-7 bg-desk-line" />
        </div>
      </main>
    </div>
  );
}

function BindingMarks() {
  return (
    <div className="pointer-events-none absolute left-[21px] top-20 z-20 flex flex-col gap-28" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <span key={item} className="size-3 rounded-full border border-desk-line bg-desk-canvas shadow-[inset_0_1px_2px_rgb(43_41_38/0.12)]" />
      ))}
    </div>
  );
}

function LoginForm({ onSubmit, onCreate }: { onSubmit: AuthScreenProps["onLogin"]; onCreate: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await onSubmit({ email: email.trim(), password });
    setBusy(false);
    if (!result.ok) setError(result.error?.message ?? "Sign in failed");
  }

  return (
    <AuthForm title="Welcome back" note="Continue where you left off." onSubmit={submit} error={error}>
      <AuthField label="Email"><input className={fieldClass} autoComplete="email" inputMode="email" required type="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} /></AuthField>
      <AuthField label="Password"><input className={fieldClass} autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} /></AuthField>
      <PrimarySubmit disabled={busy || !email.trim() || !password}>{busy ? "Signing in" : "Sign in"}</PrimarySubmit>
      <div className="mt-3 border-t border-dashed border-desk-line pt-4 text-center text-sm text-desk-muted">
        New here?{" "}
        <button className="min-h-11 rounded-md px-2 font-bold text-desk-accent hover:bg-desk-accent-soft hover:text-desk-ink" type="button" onClick={onCreate}>Create account</button>
      </div>
    </AuthForm>
  );
}

function RegisterForm({ onSubmit, onBack }: { onSubmit: AuthScreenProps["onRegister"]; onBack: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (password !== confirmation) return setError("Passwords do not match");
    if (password.length < 15) return setError("Use at least 15 characters");
    setBusy(true);
    setError(null);
    const result = await onSubmit({ email: email.trim(), password, display_name: name.trim(), timezone: browserTimezone(), locale: browserLocale() });
    setBusy(false);
    if (!result.ok) setError(result.error?.message ?? "Account creation failed");
  }

  return (
    <AuthForm title="Create account" note="Start a private desk on this device." onSubmit={submit} error={error} onBack={onBack}>
      <AuthField label="Name"><input className={fieldClass} autoComplete="name" maxLength={80} required value={name} onChange={(event) => setName(event.currentTarget.value)} /></AuthField>
      <AuthField label="Email"><input className={fieldClass} autoComplete="email" inputMode="email" required type="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} /></AuthField>
      <AuthField label="Password" hint="15+ characters"><input className={fieldClass} autoComplete="new-password" minLength={15} maxLength={256} required type="password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} /></AuthField>
      <AuthField label="Confirm password"><input className={fieldClass} autoComplete="new-password" minLength={15} maxLength={256} required type="password" value={confirmation} onChange={(event) => setConfirmation(event.currentTarget.value)} /></AuthField>
      <PrimarySubmit disabled={busy || !name.trim() || !email.trim() || !password || !confirmation}>{busy ? "Creating" : "Create account"}</PrimarySubmit>
    </AuthForm>
  );
}

function AuthStatus({ title, message, actionLabel, onAction }: { title: string; message?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <section className="grid min-h-72 place-items-center text-center" role="status">
      <div>
        <span className="mx-auto mb-4 grid size-11 place-items-center rounded-full border border-desk-accent/20 bg-desk-accent-soft text-desk-accent" aria-hidden="true"><Icon name="book" className="size-5" /></span>
        <h1 className="m-0 text-xl font-bold">{title}</h1>
        {message ? <p className="mt-2 text-sm text-desk-muted">{message}</p> : null}
        {actionLabel && onAction ? <button className={`${primaryButtonClass} mt-6`} type="button" onClick={onAction}>{actionLabel}</button> : null}
      </div>
    </section>
  );
}

function AuthForm({ title, note, onSubmit, error, onBack, children }: { title: string; note: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; error: string | null; onBack?: () => void; children: ReactNode }) {
  return (
    <section>
      <div className="mb-5 flex items-start gap-2">
        {onBack ? <button className="-ml-2 grid size-11 shrink-0 place-items-center rounded-paper border-0 bg-transparent text-desk-muted hover:bg-desk-sunk hover:text-desk-ink" type="button" aria-label="Back to sign in" onClick={onBack}><Icon name="chevronLeft" className="size-5" /></button> : null}
        <div className={onBack ? "pt-1" : ""}><h1 className="m-0 text-2xl font-bold tracking-[-0.025em]">{title}</h1><p className="mb-0 mt-1 text-sm text-desk-muted">{note}</p></div>
      </div>
      <form className="flex flex-col gap-4" onSubmit={onSubmit} aria-busy={undefined}>
        {children}
        {error ? <div className="rounded-[10px] border border-desk-danger/30 bg-desk-danger-soft px-3 py-2 text-sm font-medium text-desk-danger" role="alert">{error}</div> : null}
      </form>
    </section>
  );
}

function AuthField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-sm font-bold text-desk-ink"><span className="flex items-center justify-between">{label}{hint ? <small className="font-medium text-desk-subtle">{hint}</small> : null}</span>{children}</label>;
}

function PrimarySubmit({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  return <button className={`${primaryButtonClass} mt-1`} type="submit" disabled={disabled}>{children}</button>;
}

const fieldClass = "min-h-12 w-full rounded-[10px] border border-desk-line bg-desk-paper px-3 text-base text-desk-ink shadow-[inset_0_1px_1px_rgb(43_41_38/0.03)] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-desk-subtle hover:border-desk-subtle focus:border-desk-accent focus:bg-desk-raised focus:ring-2 focus:ring-desk-accent-soft";
const primaryButtonClass = "min-h-12 w-full rounded-[10px] border border-desk-accent bg-desk-accent px-4 text-sm font-bold text-white shadow-[0_3px_0_rgb(81_109_78/0.28)] transition-[transform,background-color,box-shadow] hover:bg-desk-ink active:translate-y-px active:shadow-paper disabled:cursor-not-allowed disabled:border-desk-line disabled:bg-desk-sunk disabled:text-desk-subtle disabled:shadow-none";

function browserTimezone(): string { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
function browserLocale(): string { return typeof navigator === "undefined" ? "en" : navigator.language || "en"; }
