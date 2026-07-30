#!/usr/bin/env bash
set -euo pipefail

openclaw_home="${OPENCLAW_HOME:-${HOME}/.openclaw}"
secret_dir="${openclaw_home}/secrets"
mode="all"

if [[ $# -gt 1 ]]; then
  printf 'Usage: %s [--theseus-only]\n' "$0" >&2
  exit 2
fi
if [[ $# -eq 1 ]]; then
  if [[ "$1" != "--theseus-only" ]]; then
    printf 'Usage: %s [--theseus-only]\n' "$0" >&2
    exit 2
  fi
  mode="theseus-only"
fi

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

if [[ "${mode}" == "all" ]]; then
  read -r -s -p 'Telegram Bot Token（数字开头）: ' telegram_token
  printf '\n'

  if [[ ! "${telegram_token}" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]]; then
    printf 'Telegram Bot Token format was not recognized; no secret was written.\n' >&2
    exit 1
  fi
fi

read -r -s -p 'Theseus pairing Token（ths_int_ 开头）: ' theseus_token
printf '\n'

if [[ ! "${theseus_token}" =~ ^ths_int_[A-Za-z0-9_-]{8,}$ ]]; then
  printf 'Theseus pairing Token format was not recognized; no secret was written.\n' >&2
  exit 1
fi

if [[ "${mode}" == "all" ]]; then
  persist_secret "${telegram_token}" "${secret_dir}/telegram-bot-token"
  unset telegram_token
fi
persist_secret "${theseus_token}" "${secret_dir}/theseus-integration-token"
unset theseus_token

if [[ "${mode}" == "theseus-only" ]]; then
  printf 'Theseus pairing secret updated with owner-only permissions.\n'
else
  printf 'Local OpenClaw secrets saved with owner-only permissions.\n'
fi
