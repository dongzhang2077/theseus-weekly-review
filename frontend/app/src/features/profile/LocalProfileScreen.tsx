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
}

export function LocalProfileScreen({
  users,
  loading,
  unavailable,
  saving,
  error,
  onSelect,
  onCreate,
  onRetry
}: LocalProfileScreenProps) {
  const [displayName, setDisplayName] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = displayName.trim();
    if (!name || saving) return;

    await onCreate({
      display_name: name,
      timezone: browserTimezone(),
      locale: browserLocale()
    });
  }

  return (
    <section className="profile-screen" aria-labelledby="local-profile-title">
      <header className="profile-heading">
        <span className="profile-emblem" aria-hidden="true">
          <Icon name="book" />
        </span>
        <h1 id="local-profile-title">Local profile</h1>
        <p>Choose who this local data belongs to.</p>
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

      {!loading && users.length > 0 ? (
        <div className="profile-section">
          <div className="profile-section-label">Continue</div>
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
                  <small>{user.timezone}</small>
                </span>
                <Icon name="chevronRight" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && !unavailable ? (
        <form className="profile-section profile-form" onSubmit={submit}>
          <div className="profile-section-label">New profile</div>
          <label className="paper-field">
            <span>Name</span>
            <input
              autoComplete="name"
              maxLength={80}
              type="text"
              value={displayName}
              aria-label="Profile name"
              onChange={(event) => setDisplayName(event.currentTarget.value)}
            />
          </label>
          {error ? <span className="profile-inline-error" role="alert">Could not save this profile.</span> : null}
          <button className="paper-action" type="submit" disabled={!displayName.trim() || saving}>
            {saving ? "Saving" : "Create"}
          </button>
        </form>
      ) : null}
    </section>
  );
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
