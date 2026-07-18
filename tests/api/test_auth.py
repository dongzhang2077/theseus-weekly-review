from __future__ import annotations

import httpx
import jwt
import pytest

from backend.app.main import create_app
from backend.app.services import AuthSettings
from tests.support import DEFAULT_TEST_PASSWORD, create_and_select_api_user


pytestmark = pytest.mark.anyio

NEW_PASSWORD = "a different durable passphrase"


async def test_register_hashes_credentials_and_login_survives_restart(database) -> None:
    first_app = create_app(database.path)
    first_transport = httpx.ASGITransport(app=first_app)
    async with httpx.AsyncClient(
        transport=first_transport,
        base_url="http://test",
    ) as client:
        registered = await client.post(
            "/auth/register",
            json={
                "email": "Douglas@Example.com",
                "password": DEFAULT_TEST_PASSWORD,
                "display_name": "Douglas",
                "timezone": "America/Vancouver",
                "locale": "en-CA",
            },
        )
        payload = registered.json()
        original_access = payload["access_token"]
        original_refresh = registered.cookies.get("theseus_rt")
        original_csrf = registered.cookies.get("theseus_csrf")
        users_endpoint = await client.get("/users")

    assert registered.status_code == 201
    assert payload["user"]["email"] == "douglas@example.com"
    assert payload["access_token"]
    assert original_refresh
    assert original_csrf
    cookies = registered.headers.get_list("set-cookie")
    refresh_cookie = next(value for value in cookies if value.startswith("theseus_rt="))
    csrf_cookie = next(value for value in cookies if value.startswith("theseus_csrf="))
    assert "HttpOnly" in refresh_cookie
    assert "Path=/auth" in refresh_cookie
    assert "SameSite=strict" in refresh_cookie
    assert "HttpOnly" not in csrf_cookie
    assert "Path=/" in csrf_cookie
    assert "SameSite=strict" in csrf_cookie
    assert "refresh_token" not in payload
    assert "csrf_token" not in payload
    assert users_endpoint.status_code == 404

    with database.session() as connection:
        credential = connection.execute(
            "SELECT email, password_hash FROM auth_credentials"
        ).fetchone()
    assert credential["email"] == "douglas@example.com"
    assert credential["password_hash"].startswith("$argon2id$")
    assert credential["password_hash"] != DEFAULT_TEST_PASSWORD

    second_app = create_app(database.path)
    second_transport = httpx.ASGITransport(app=second_app)
    async with httpx.AsyncClient(
        transport=second_transport,
        base_url="http://test",
    ) as client:
        original_access_after_restart = await client.get(
            "/goals",
            headers={"Authorization": f"Bearer {original_access}"},
        )
        original_refresh_after_restart = await client.post(
            "/auth/refresh",
            headers={
                "Cookie": (
                    f"theseus_rt={original_refresh}; theseus_csrf={original_csrf}"
                ),
                "X-CSRF-Token": original_csrf,
            },
        )
        login = await client.post(
            "/auth/login",
            json={
                "email": "douglas@example.com",
                "password": DEFAULT_TEST_PASSWORD,
            },
        )

    assert original_access_after_restart.status_code == 200
    assert original_refresh_after_restart.status_code == 200
    assert login.status_code == 200
    assert login.json()["user"]["id"] == payload["user"]["id"]


async def test_personal_routes_require_bearer_and_ignore_legacy_user_header(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        missing = await client.get("/goals")
        legacy_header = await client.get(
            "/goals",
            headers={"X-Theseus-User-Id": "1"},
        )
        forged = await client.get(
            "/goals",
            headers={"Authorization": "Bearer forged.token.value"},
        )

    assert missing.status_code == 401
    assert legacy_header.status_code == 401
    assert forged.status_code == 401
    assert missing.json()["detail"]["code"] == "not_authenticated"


async def test_refresh_rotates_session_and_reuse_revokes_replacement(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        registered = await client.post(
            "/auth/register",
            json={
                "email": "rotate@example.com",
                "password": DEFAULT_TEST_PASSWORD,
                "display_name": "Rotate",
            },
        )
        old_refresh = registered.cookies.get("theseus_rt")
        old_csrf = registered.cookies.get("theseus_csrf")
        refreshed = await client.post(
            "/auth/refresh",
            headers={"X-CSRF-Token": old_csrf},
        )
        replacement_access = refreshed.json()["access_token"]

    assert refreshed.status_code == 200
    assert refreshed.cookies.get("theseus_rt") != old_refresh

    reuse_transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=reuse_transport,
        base_url="http://test",
    ) as attacker:
        reused = await attacker.post(
            "/auth/refresh",
            headers={
                "Cookie": f"theseus_rt={old_refresh}; theseus_csrf={old_csrf}",
                "X-CSRF-Token": old_csrf,
            },
        )
        replacement_after_reuse = await attacker.get(
            "/goals",
            headers={"Authorization": f"Bearer {replacement_access}"},
        )

    assert reused.status_code == 401
    assert reused.json()["detail"]["code"] == "session_reuse_detected"
    cleared_cookies = reused.headers.get_list("set-cookie")
    assert len(cleared_cookies) == 2
    assert any("theseus_rt=" in value and "Max-Age=0" in value for value in cleared_cookies)
    assert any("theseus_csrf=" in value and "Max-Age=0" in value for value in cleared_cookies)
    assert replacement_after_reuse.status_code == 401


async def test_refresh_rejects_csrf_failures_without_invalidating_session(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        registered = await client.post(
            "/auth/register",
            json={
                "email": "csrf@example.com",
                "password": DEFAULT_TEST_PASSWORD,
                "display_name": "CSRF",
            },
        )
        csrf = registered.cookies.get("theseus_csrf")
        missing_header = await client.post("/auth/refresh")
        wrong_header = await client.post(
            "/auth/refresh",
            headers={"X-CSRF-Token": "wrong-session-value"},
        )
        valid_after_failures = await client.post(
            "/auth/refresh",
            headers={"X-CSRF-Token": csrf},
        )

    assert missing_header.status_code == 403
    assert wrong_header.status_code == 403
    assert missing_header.json()["detail"]["code"] == "invalid_csrf"
    assert wrong_header.json()["detail"]["code"] == "invalid_csrf"
    assert missing_header.headers.get_list("set-cookie") == []
    assert wrong_header.headers.get_list("set-cookie") == []
    assert valid_after_failures.status_code == 200


async def test_access_rejects_expired_and_wrong_type_jwts(database) -> None:
    settings = AuthSettings(secret_key="test-secret-key-" * 4)
    app = create_app(database.path, auth_settings=settings)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        registered = await client.post(
            "/auth/register",
            json={
                "email": "claims@example.com",
                "password": DEFAULT_TEST_PASSWORD,
                "display_name": "Claims",
            },
        )
        access = registered.json()["access_token"]
        refresh_token = registered.cookies.get("theseus_rt")
        claims = jwt.decode(access, options={"verify_signature": False})
        claims["exp"] = 1
        expired = jwt.encode(claims, settings.secret_key, algorithm=settings.algorithm)
        expired_access = await client.get(
            "/goals",
            headers={"Authorization": f"Bearer {expired}"},
        )
        refresh_as_access = await client.get(
            "/goals",
            headers={"Authorization": f"Bearer {refresh_token}"},
        )

    assert expired_access.status_code == 401
    assert refresh_as_access.status_code == 401
    assert expired_access.headers["www-authenticate"] == "Bearer"
    assert refresh_as_access.headers["www-authenticate"] == "Bearer"


async def test_logout_revokes_access_token(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        registered = await client.post(
            "/auth/register",
            json={
                "email": "logout@example.com",
                "password": DEFAULT_TEST_PASSWORD,
                "display_name": "Logout",
            },
        )
        access = registered.json()["access_token"]
        client.headers["Authorization"] = f"Bearer {access}"
        logged_out = await client.post("/auth/logout")
        after_logout = await client.get("/goals")

    assert logged_out.status_code == 204
    assert after_logout.status_code == 401


async def test_logout_revokes_only_the_active_session(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as first:
        registered = await first.post(
            "/auth/register",
            json={
                "email": "sessions@example.com",
                "password": DEFAULT_TEST_PASSWORD,
                "display_name": "Sessions",
            },
        )
        first_access = registered.json()["access_token"]
        first.headers["Authorization"] = f"Bearer {first_access}"

        async with httpx.AsyncClient(transport=transport, base_url="http://test") as second:
            logged_in = await second.post(
                "/auth/login",
                json={
                    "email": "sessions@example.com",
                    "password": DEFAULT_TEST_PASSWORD,
                },
            )
            second_access = logged_in.json()["access_token"]
            logged_out = await first.post("/auth/logout")
            first_after_logout = await first.get("/goals")
            second_after_logout = await second.get(
                "/goals",
                headers={"Authorization": f"Bearer {second_access}"},
            )

    assert logged_out.status_code == 204
    assert first_after_logout.status_code == 401
    assert second_after_logout.status_code == 200


async def test_login_lockout_returns_retry_after_and_blocks_correct_password(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            "/auth/register",
            json={
                "email": "locked@example.com",
                "password": DEFAULT_TEST_PASSWORD,
                "display_name": "Locked",
            },
        )
        failures = [
            await client.post(
                "/auth/login",
                json={"email": "locked@example.com", "password": "wrong-password"},
            )
            for _ in range(5)
        ]
        locked = await client.post(
            "/auth/login",
            json={
                "email": "locked@example.com",
                "password": DEFAULT_TEST_PASSWORD,
            },
        )

    assert [response.status_code for response in failures] == [401] * 5
    assert locked.status_code == 429
    assert locked.json()["detail"]["code"] == "account_locked"
    assert int(locked.headers["retry-after"]) >= 1


async def test_accounts_cannot_read_or_link_each_others_data(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        first = await create_and_select_api_user(client, "First")
        first_authorization = client.headers["Authorization"]
        first_goal = (
            await client.post("/goals", json={"title": "First goal"})
        ).json()

        second = await create_and_select_api_user(client, "Second")
        second_goal = await client.post("/goals", json={"title": "Second goal"})
        cross_user_project = await client.post(
            "/projects",
            json={"goal_id": first_goal["id"], "title": "Invalid project"},
        )
        second_goals = await client.get("/goals")
        client.headers["Authorization"] = first_authorization
        first_goals = await client.get("/goals")

    assert first["id"] != second["id"]
    assert second_goal.status_code == 201
    assert cross_user_project.status_code == 409
    assert [goal["title"] for goal in second_goals.json()] == ["Second goal"]
    assert [goal["title"] for goal in first_goals.json()] == ["First goal"]


async def test_change_password_rotates_session(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        registered = await client.post(
            "/auth/register",
            json={
                "email": "password@example.com",
                "password": DEFAULT_TEST_PASSWORD,
                "display_name": "Password",
            },
        )
        old_access = registered.json()["access_token"]
        client.headers["Authorization"] = f"Bearer {old_access}"
        changed = await client.post(
            "/auth/change-password",
            json={
                "current_password": DEFAULT_TEST_PASSWORD,
                "new_password": NEW_PASSWORD,
            },
        )
        old_session = await client.get(
            "/goals",
            headers={"Authorization": f"Bearer {old_access}"},
        )
        client.headers.pop("Authorization", None)
        old_login = await client.post(
            "/auth/login",
            json={"email": "password@example.com", "password": DEFAULT_TEST_PASSWORD},
        )
        new_login = await client.post(
            "/auth/login",
            json={"email": "password@example.com", "password": NEW_PASSWORD},
        )

    assert changed.status_code == 200
    assert changed.json()["access_token"] != old_access
    assert old_session.status_code == 401
    assert old_login.status_code == 401
    assert new_login.status_code == 200


async def test_change_email_requires_password_and_updates_login_identity(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        registered = await client.post(
            "/auth/register",
            json={
                "email": "old-email@example.com",
                "password": DEFAULT_TEST_PASSWORD,
                "display_name": "Email",
            },
        )
        client.headers["Authorization"] = f"Bearer {registered.json()['access_token']}"
        rejected = await client.post(
            "/auth/change-email",
            json={"email": "new-email@example.com", "current_password": "wrong"},
        )
        changed = await client.post(
            "/auth/change-email",
            json={
                "email": "new-email@example.com",
                "current_password": DEFAULT_TEST_PASSWORD,
            },
        )
        old_login = await client.post(
            "/auth/login",
            json={"email": "old-email@example.com", "password": DEFAULT_TEST_PASSWORD},
        )
        new_login = await client.post(
            "/auth/login",
            json={"email": "new-email@example.com", "password": DEFAULT_TEST_PASSWORD},
        )

    assert rejected.status_code == 401
    assert changed.status_code == 200
    assert changed.json()["email"] == "new-email@example.com"
    assert old_login.status_code == 401
    assert new_login.status_code == 200


async def test_profile_update_and_account_deletion_are_persisted(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Delete Me")
        updated = await client.patch(
            "/auth/me",
            json={"display_name": "Updated", "timezone": "America/Vancouver"},
        )
        await client.post("/goals", json={"title": "Private goal"})
        deleted = await client.request(
            "DELETE",
            "/auth/account",
            json={"current_password": DEFAULT_TEST_PASSWORD, "confirmation": "DELETE"},
        )
        login = await client.post(
            "/auth/login",
            json={"email": "delete-me@example.com", "password": DEFAULT_TEST_PASSWORD},
        )

    assert updated.status_code == 200
    assert updated.json()["display_name"] == "Updated"
    assert deleted.status_code == 204
    assert login.status_code == 401
    with database.session() as connection:
        assert connection.execute(
            "SELECT COUNT(*) FROM users WHERE id = ?", (user["id"],)
        ).fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM goals").fetchone()[0] == 0
        assert connection.execute(
            "SELECT COUNT(*) FROM auth_credentials WHERE user_id = ?", (user["id"],)
        ).fetchone()[0] == 0
        assert connection.execute(
            "SELECT COUNT(*) FROM auth_sessions WHERE user_id = ?", (user["id"],)
        ).fetchone()[0] == 0
