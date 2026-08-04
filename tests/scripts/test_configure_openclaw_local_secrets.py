from __future__ import annotations

import os
from pathlib import Path
import stat
import subprocess


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPOSITORY_ROOT / "scripts" / "configure_openclaw_local_secrets.sh"


def run_script(
    openclaw_home: Path,
    stdin: str,
    *arguments: str,
) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment["OPENCLAW_HOME"] = str(openclaw_home)
    return subprocess.run(
        ["bash", str(SCRIPT), *arguments],
        input=stdin,
        text=True,
        capture_output=True,
        check=False,
        env=environment,
    )


def test_configures_both_local_secrets_without_echoing_values(tmp_path: Path) -> None:
    bot_token = "123456789:test-bot-token"
    pairing_token = "ths_int_initial-pairing-token"

    result = run_script(tmp_path / "openclaw", f"{bot_token}\n{pairing_token}\n")

    assert result.returncode == 0
    assert bot_token not in result.stdout + result.stderr
    assert pairing_token not in result.stdout + result.stderr
    secret_dir = tmp_path / "openclaw" / "secrets"
    assert (secret_dir / "telegram-bot-token").read_text() == bot_token
    assert (secret_dir / "theseus-integration-token").read_text() == pairing_token
    assert stat.S_IMODE(secret_dir.stat().st_mode) == 0o700
    assert stat.S_IMODE((secret_dir / "telegram-bot-token").stat().st_mode) == 0o600
    assert stat.S_IMODE((secret_dir / "theseus-integration-token").stat().st_mode) == 0o600


def test_theseus_only_rotates_pairing_and_preserves_bot_secret(tmp_path: Path) -> None:
    secret_dir = tmp_path / "openclaw" / "secrets"
    secret_dir.mkdir(parents=True)
    bot_secret = secret_dir / "telegram-bot-token"
    pairing_secret = secret_dir / "theseus-integration-token"
    bot_secret.write_text("existing-bot-secret")
    pairing_secret.write_text("ths_int_existing-pairing-token")
    updated_token = "ths_int_rotated-pairing-token"

    result = run_script(
        tmp_path / "openclaw",
        f"{updated_token}\n",
        "--theseus-only",
    )

    assert result.returncode == 0
    assert updated_token not in result.stdout + result.stderr
    assert bot_secret.read_text() == "existing-bot-secret"
    assert pairing_secret.read_text() == updated_token
    assert stat.S_IMODE(pairing_secret.stat().st_mode) == 0o600


def test_invalid_theseus_only_token_preserves_existing_secret(tmp_path: Path) -> None:
    secret_dir = tmp_path / "openclaw" / "secrets"
    secret_dir.mkdir(parents=True)
    pairing_secret = secret_dir / "theseus-integration-token"
    pairing_secret.write_text("ths_int_existing-pairing-token")

    result = run_script(
        tmp_path / "openclaw",
        "invalid-token\n",
        "--theseus-only",
    )

    assert result.returncode == 1
    assert pairing_secret.read_text() == "ths_int_existing-pairing-token"


def test_rejects_unknown_mode_without_writing(tmp_path: Path) -> None:
    openclaw_home = tmp_path / "openclaw"

    result = run_script(openclaw_home, "", "--unknown")

    assert result.returncode == 2
    assert not openclaw_home.exists()
