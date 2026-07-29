#!/usr/bin/env bash
set -euo pipefail

openclaw_home="${OPENCLAW_HOME:-${HOME}/.openclaw}"
secret_dir="${openclaw_home}/secrets"

mkdir -p -- "${secret_dir}"
chmod 700 "${secret_dir}"

persist_secret() {
  local value="$1"
  local destination="$2"
  local temporary

  temporary="$(mktemp "${secret_dir}/.theseus-secret.XXXXXX")"
  chmod 600 "${temporary}"
  printf '%s' "${value}" > "${temporary}"
  mv -- "${temporary}" "${destination}"
  unset value
}

read -r -s -p 'Telegram Bot Token（数字开头）: ' telegram_token
printf '\n'

if [[ ! "${telegram_token}" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]]; then
  printf 'Telegram Bot Token format was not recognized; no secret was written.\n' >&2
  exit 1
fi

read -r -s -p 'Theseus pairing Token（ths_int_ 开头）: ' theseus_token
printf '\n'

if [[ ! "${theseus_token}" =~ ^ths_int_[A-Za-z0-9_-]{8,}$ ]]; then
  printf 'Theseus pairing Token format was not recognized; no secret was written.\n' >&2
  exit 1
fi

persist_secret "${telegram_token}" "${secret_dir}/telegram-bot-token"
persist_secret "${theseus_token}" "${secret_dir}/theseus-integration-token"
unset telegram_token theseus_token

printf 'Local OpenClaw secrets saved with owner-only permissions.\n'
