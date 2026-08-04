#!/usr/bin/env python3
"""Run the complete Theseus OpenClaw adapter workflow without user secrets.

This is a local developer verification command. It creates all data, credentials,
and the API server in a temporary directory, then removes the temporary pairing
and directory when the check finishes.
"""
from __future__ import annotations

import argparse
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PLUGIN_DIRECTORY = ROOT / "integrations" / "openclaw-theseus"
sys.path.insert(0, str(ROOT))

from backend.app.db import Database  # noqa: E402
from backend.app.schemas import IntegrationPairCreate  # noqa: E402
from backend.app.services import AuthSettings, IntegrationService  # noqa: E402
from scripts.prepare_midterm_demo import prepare_demo  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Verify the OpenClaw adapter context, next-action, proposal, decision, execution, and undo flow."
    )
    parser.add_argument(
        "--node",
        default=os.getenv("THESEUS_NODE", "node"),
        help="Supported Node executable (defaults to THESEUS_NODE or node).",
    )
    args = parser.parse_args()
    require_supported_node(args.node)

    with tempfile.TemporaryDirectory(prefix="theseus-openclaw-e2e-") as directory:
        workspace = Path(directory)
        database_path = workspace / "theseus.db"
        preparation = prepare_demo(
            database_path,
            credentials_path=workspace / "demo-credentials.json",
        )
        database = Database(database_path)
        settings = AuthSettings.from_environment(database_path)
        identity = "openclaw-e2e-temporary"
        with database.session() as connection:
            pairing = IntegrationService(
                connection, settings.secret_key, user_id=preparation.user_id
            ).pair(
                IntegrationPairCreate(
                    label="Temporary OpenClaw adapter E2E",
                    channel_type="openclaw",
                    external_identity=identity,
                    scopes=[
                        "context:read",
                        "proposal:create",
                        "proposal:decide",
                        "action:execute",
                        "action:undo",
                    ],
                    expires_in_seconds=300,
                )
            )

        environment = os.environ | {"THESEUS_DB_PATH": str(database_path)}
        server: subprocess.Popen[bytes] | None = None
        try:
            port = available_port()
            server = subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "backend.app.main:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    str(port),
                ],
                cwd=ROOT,
                env=environment,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            wait_for_health(server, port)
            subprocess.run(
                [args.node, "scripts/smoke-workflow.mjs"],
                cwd=PLUGIN_DIRECTORY,
                env=environment
                | {
                    "THESEUS_BASE_URL": f"http://127.0.0.1:{port}",
                    "THESEUS_ACCESS_TOKEN": pairing.access_token,
                    "THESEUS_EXTERNAL_IDENTITY": identity,
                    "THESEUS_REVIEW_WEEK_START": preparation.week_start,
                    "THESEUS_REVIEW_WEEK_END": preparation.week_end,
                    "THESEUS_TARGET_WEEK_START": "2026-06-15",
                    "THESEUS_TARGET_WEEK_END": "2026-06-21",
                },
                check=True,
            )
        finally:
            if server is not None:
                server.terminate()
                try:
                    server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait(timeout=5)
            with database.session() as connection:
                IntegrationService(
                    connection, settings.secret_key, user_id=preparation.user_id
                ).revoke(pairing.credential.id)


def available_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(("127.0.0.1", 0))
        return int(listener.getsockname()[1])


def require_supported_node(node: str) -> None:
    try:
        result = subprocess.run(
            [node, "scripts/require-supported-node.mjs"],
            cwd=PLUGIN_DIRECTORY,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise SystemExit(
            f"Could not find Node executable: {node}. "
            "Set THESEUS_NODE to a supported Node 22.22.3+, 24.15+, or 25.9+ executable."
        ) from exc
    if result.returncode == 0:
        return
    detail = (result.stderr or result.stdout).strip()
    raise SystemExit(
        f"{detail}\n"
        "Re-run with THESEUS_NODE=/path/to/supported-node "
        "or pass --node /path/to/supported-node."
    )


def wait_for_health(server: subprocess.Popen[bytes], port: int) -> None:
    deadline = time.monotonic() + 10
    health_url = f"http://127.0.0.1:{port}/health"
    while time.monotonic() < deadline:
        if server.poll() is not None:
            raise RuntimeError("Temporary Theseus API stopped before becoming healthy")
        try:
            with urllib.request.urlopen(health_url, timeout=0.5) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(0.1)
    raise RuntimeError("Temporary Theseus API did not become healthy within 10 seconds")


if __name__ == "__main__":
    main()
