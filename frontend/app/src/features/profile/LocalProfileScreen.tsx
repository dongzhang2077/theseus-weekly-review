import { useState, type FormEvent } from "react";
import type { LocalUser, LocalUserCreatePayload } from "../../shared/api/users";
import { Icon } from "../../shared/icons/Icon";

interface LocalProfileScreenProps {
  users: LocalUser[];
  loading: boolean;
  unavailable: boolean;
  saving: boolean;
  error: string | null;
  onSelect: (user: LocalUser) => void;
  onCreate: (payload: LocalUserCreatePayload) => Promise<void>;
  onRetry: () => void;
  onClose?: () => void;
}

export function LocalProfileScreen({
  users,
  loading,
  unavailable,
  saving,
  error,
  onSelect,
  onCreate,
  onRetry,
  onClose
}: LocalProfileScreenProps) {
  const [view, setView] = useState<"choose" | "create" | "sync">("choose");
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState(browserTimezone());
  const [accountEmail, setAccountEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountChoice, setAccountChoice] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = displayName.trim();
    if (!name || saving) return;

    await onCreate({
      display_name: name,
      timezone: timezone.trim() || "UTC",
      locale: browserLocale()
    });
  }

  return (
    <section className={`profile-screen profile-view-${view}`} aria-labelledby="local-profile-title">
      {view === "choose" ? (
        <div className="profile-brand-lockup" role="img" aria-label="Theseus">
          <span className="profile-brand-mark" />
        </div>
      ) : null}
      <header className={`profile-heading${view === "create" ? " profile-create-heading" : ""}`}>
        {onClose ? (
          <button className="profile-close" type="button" aria-label="Close account" onClick={onClose}>
            <Icon name="x" />
          </button>
        ) : null}
        {view === "create" ? (
          <>
            <span className="profile-create-compass" aria-hidden="true" />
            <span className="profile-create-book" aria-hidden="true">
              <Icon name="book" />
            </span>
          </>
        ) : (
          <span className="profile-emblem" aria-hidden="true">
            <Icon name="book" />
          </span>
        )}
        <h1 id="local-profile-title">{profileTitle(view)}</h1>
        <p>{profileSubtitle(view)}</p>
      </header>

      {loading ? (
        <div className="profile-state" role="status">
          <Icon name="book" />
          <span>Loading profiles</span>
        </div>
      ) : null}

      {!loading && unavailable ? (
        <div className="profile-state profile-error" role="alert">
          <Icon name="info" />
          <strong>Profiles unavailable</strong>
          <span>Check the local API, then try again.</span>
          <button className="paper-action" type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !unavailable && view === "choose" ? (
        <>
          {users.length > 0 ? (
            <div className="profile-section">
              <div className="profile-section-label">Existing profiles</div>
              <div className="profile-list">
                {users.map((user) => (
                  <button
                    className="profile-row"
                    key={user.id}
                    type="button"
                    onClick={() => onSelect(user)}
                  >
                    <span className="profile-initial" aria-hidden="true">
                      {profileInitial(user.display_name)}
                    </span>
                    <span className="profile-row-copy">
                      <strong>{user.display_name}</strong>
                      <small>Only on this device</small>
                    </span>
                    <span className="profile-row-meta">{user.timezone}</span>
                    <Icon name="chevronRight" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="profile-section">
            <div className="profile-section-label">Get started</div>
            <div className="profile-list">
              <button className="profile-row profile-action-row" type="button" onClick={() => setView("create")}>
                <span className="profile-action-icon" aria-hidden="true">
                  <Icon name="plus" />
                </span>
                <span className="profile-row-copy">
                  <strong>Start on this device</strong>
                  <small>No account required</small>
                </span>
                <Icon name="chevronRight" />
              </button>
              <button className="profile-row profile-action-row" type="button" onClick={() => setView("sync")}>
                <span className="profile-action-icon" aria-hidden="true">
                  <Icon name="route" />
                </span>
                <span className="profile-row-copy">
                  <strong>Login and sync</strong>
                  <small>Optional backup later</small>
                </span>
                <Icon name="chevronRight" />
              </button>
            </div>
          </div>
          <div className="profile-device-note">
            <span aria-hidden="true">
              <Icon name="check" />
            </span>
            <p>You can use the app without an account. Data stays on this device until you sync.</p>
          </div>
        </>
      ) : null}

      {!loading && !unavailable && view === "create" ? (
        <form className="profile-section profile-form" onSubmit={submit}>
          <button className="profile-back" type="button" onClick={() => setView("choose")}>
            <Icon name="chevronLeft" />
            Back
          </button>
          <div className="profile-form-card">
            <div className="profile-section-label">New local profile</div>
            <div className="profile-create-preview" aria-hidden="true">
              <span className="profile-initial">{profileInitial(displayName || "User")}</span>
              <span>
                <strong>{displayName.trim() || "New profile"}</strong>
                <small>Local only</small>
              </span>
              <span className="profile-create-landmark" />
            </div>
            <div className="profile-create-field">
              <span className="profile-field-icon" aria-hidden="true">
                <Icon name="user" />
              </span>
              <label className="paper-field">
                <span>Name</span>
                <input
                  autoComplete="name"
                  maxLength={80}
                  placeholder="e.g. Project Mercury"
                  type="text"
                  value={displayName}
                  aria-label="Profile name"
                  onChange={(event) => setDisplayName(event.currentTarget.value)}
                />
              </label>
            </div>
            <div className="profile-create-field">
              <span className="profile-field-icon" aria-hidden="true">
                <Icon name="globe" />
              </span>
              <label className="paper-field">
                <span>Time zone</span>
                <input
                  autoComplete="off"
                  maxLength={80}
                  type="text"
                  value={timezone}
                  aria-label="Time zone"
                  onChange={(event) => setTimezone(event.currentTarget.value)}
                />
              </label>
            </div>
            <div className="profile-local-note">
              <span aria-hidden="true"><Icon name="info" /></span>
              <p>This profile stays on this device. Login can be added later for backup.</p>
            </div>
            {error ? <span className="profile-inline-error" role="alert">Could not save this profile.</span> : null}
            <button className="paper-action profile-create-action" type="submit" disabled={!displayName.trim() || saving}>
              <Icon name="target" />
              <span>{saving ? "Saving" : "Create and continue"}</span>
              <Icon name="chevronRight" />
            </button>
          </div>
          <div className="profile-create-progress" aria-hidden="true">
            <span className="active" />
            <i />
            <span />
            <i />
            <span />
          </div>
          <div className="profile-create-footnote">
            <Icon name="check" />
            <span>Your data stays on this device.</span>
          </div>
        </form>
      ) : null}

      {!loading && !unavailable && view === "sync" ? (
        <div className="profile-section profile-sync">
          <button className="profile-back" type="button" onClick={() => setView("choose")}>
            <Icon name="chevronLeft" />
            Back
          </button>
          <div className="profile-section-label">Optional account</div>
          <div className="profile-sync-panel">
            <strong>{connectedEmail ? "Connected" : "Not connected"}</strong>
            <span>
              {connectedEmail
                ? `${connectedEmail} is connected for this local demo.`
                : "Profiles stay local until account sync is implemented."}
            </span>
          </div>
          <div className="profile-section-label">Sign in methods</div>
          <button className="profile-row profile-provider-row" type="button" disabled>
            <span className="profile-provider-mark">A</span>
            <span className="profile-row-copy">
              <strong>Continue with Apple</strong>
              <small>Planned for cloud backup</small>
            </span>
          </button>
          <button className="profile-row profile-provider-row" type="button" disabled>
            <span className="profile-provider-mark">G</span>
            <span className="profile-row-copy">
              <strong>Continue with Google</strong>
              <small>Planned for multi-device sync</small>
            </span>
          </button>
          <button
            className="profile-row profile-provider-row"
            type="button"
            onClick={() => {
              setCodeSent(true);
              setAccountError(null);
            }}
          >
            <span className="profile-provider-mark">@</span>
            <span className="profile-row-copy">
              <strong>Email code</strong>
              <small>Use development code 000000</small>
            </span>
            <Icon name="chevronRight" />
          </button>
          {codeSent && !connectedEmail ? (
            <form className="profile-email-form" onSubmit={(event) => {
              event.preventDefault();
              const email = accountEmail.trim();
              if (!isValidEmail(email)) {
                setAccountError("Enter a valid email.");
                return;
              }
              if (emailCode.trim() !== "000000") {
                setAccountError("Use code 000000 for this local demo.");
                return;
              }
              setConnectedEmail(email);
              setAccountChoice(null);
              setAccountError(null);
            }}>
              <label className="paper-field">
                <span>Email</span>
                <input
                  autoComplete="email"
                  type="email"
                  value={accountEmail}
                  aria-label="Account email"
                  onChange={(event) => setAccountEmail(event.currentTarget.value)}
                />
              </label>
              <label className="paper-field">
                <span>Code</span>
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  type="text"
                  value={emailCode}
                  aria-label="Email code"
                  onChange={(event) => setEmailCode(event.currentTarget.value)}
                />
              </label>
              {accountError ? <span className="profile-inline-error" role="alert">{accountError}</span> : null}
              <button className="paper-action" type="submit">
                Connect account
              </button>
            </form>
          ) : null}
          <div className="profile-section-label">After login</div>
          <div className="profile-conflict-list" aria-label="Account data choices">
            {["Sync this local profile", "Use cloud profile", "Keep both profiles", "Review and merge"].map((label) => (
              <button
                className={`profile-conflict-row ${accountChoice === label ? "selected" : ""}`}
                type="button"
                disabled={!connectedEmail}
                key={label}
                onClick={() => setAccountChoice(label)}
              >
                {label}
              </button>
            ))}
          </div>
          {accountChoice ? (
            <div className="profile-sync-panel" role="status">
              <strong>{accountChoice}</strong>
              <span>Choice saved locally for the future sync flow.</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function profileTitle(view: "choose" | "create" | "sync"): string {
  if (view === "create") return "Create your profile";
  if (view === "sync") return "Account sync";
  return "Start on this device";
}

function profileSubtitle(view: "choose" | "create" | "sync"): string {
  if (view === "create") return "Set your direction. Stay aligned.";
  if (view === "sync") return "Backup and multi-device access can come later.";
  return "Create a local profile first, or connect later.";
}

function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function browserLocale(): string {
  return typeof navigator === "undefined" ? "en" : navigator.language || "en";
}

function profileInitial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase() || "U";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
