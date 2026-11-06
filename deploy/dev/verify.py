"""Run on the EC2 host. Never print credentials or session/CSRF tokens."""

import argparse
import http.cookiejar
import json
import secrets
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:8080"
SESSION_AUTH_ORIGINS = {
    "https://dev-backend.issue-atlas.kr": "issueatlas-dev-backend-1",
    "https://backend.issue-atlas.kr": "issueatlas-prod-backend-1",
}
COMPOSE = ["sudo", "docker", "compose", "-f", str(Path(__file__).with_name("compose.yaml"))]


def client():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)), jar


def request(opener, path, method="GET", body=None, token=None, expected=200):
    headers = {"Accept": "application/json", "User-Agent": "IssueAtlasDeploymentCheck/1.0"}
    if token:
        headers["X-XSRF-TOKEN"] = token
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with opener.open(req, timeout=20) as response:
            status, content = response.status, response.read()
            if BASE in SESSION_AUTH_ORIGINS:
                assert "no-store" in response.headers.get("Cache-Control", "")
                assert response.headers.get("CF-Cache-Status", "").upper() != "HIT"
    except urllib.error.HTTPError as error:
        status, content = error.code, error.read()
    if status != expected:
        raise RuntimeError(f"{method} {path}: expected {expected}, got {status}")
    return json.loads(content) if content else None


def csrf(opener, jar):
    request(opener, "/v1/auth/csrf", expected=204)
    return urllib.parse.unquote(next(c.value for c in jar if c.name == "XSRF-TOKEN"))


def main():
    global BASE
    parser = argparse.ArgumentParser()
    parser.add_argument("--auth", action="store_true", help="Create and deactivate one synthetic VIEWER")
    parser.add_argument("--base-url", default=BASE, help="Origin URL; HTTPS required for remote authentication")
    parser.add_argument("--session-auth", action="store_true", help="Verify existing ADMIN session without creating accounts")
    args = parser.parse_args()
    BASE = args.base_url.rstrip("/")
    if args.session_auth and BASE not in SESSION_AUTH_ORIGINS:
        parser.error("--session-auth only sends credentials to the configured development/production API origins")
    if args.auth and BASE != "http://127.0.0.1:8080":
        parser.error("--auth is restricted to the original loopback development endpoint")
    anonymous, _ = client()
    assert request(anonymous, "/actuator/health")["status"] == "UP"
    request(anonymous, "/v1/auth/me", expected=401)
    print("PASS: health UP; anonymous me rejected (401)")
    if not (args.auth or args.session_auth):
        return

    # Consume bootstrap credentials locally; never return inspect output to the terminal.
    container = SESSION_AUTH_ORIGINS.get(BASE) if args.session_auth else subprocess.check_output(
        COMPOSE + ["ps", "-q", "backend"], text=True).strip()
    info = json.loads(subprocess.check_output(["sudo", "docker", "inspect", container]))[0]
    env = dict(item.split("=", 1) for item in info["Config"]["Env"] if "=" in item)
    admin, admin_jar = client()
    token = csrf(admin, admin_jar)
    if args.session_auth:
        request(admin, "/v1/auth/login", "POST", {
            "email": env["ADMIN_EMAIL"], "password": env["ADMIN_PASSWORD"]
        }, expected=403)
    request(admin, "/v1/auth/login", "POST", {
        "email": env["ADMIN_EMAIL"], "password": env["ADMIN_PASSWORD"]
    }, token)
    assert request(admin, "/v1/auth/me")["role"] == "ADMIN"
    if args.session_auth:
        session = next(c for c in admin_jar if c.name == "JSESSIONID")
        xsrf = next(c for c in admin_jar if c.name == "XSRF-TOKEN")
        assert session.secure and xsrf.secure, "HTTPS cookies must be Secure"
        assert session.has_nonstandard_attr("HttpOnly"), "Session cookie must be HttpOnly"
        assert session.get_nonstandard_attr("SameSite").lower() == "lax"
        request(admin, "/v1/auth/logout", "POST", token=csrf(admin, admin_jar), expected=204)
        request(admin, "/v1/auth/me", expected=401)
        print("PASS: HTTPS ADMIN login/me/logout; missing CSRF 403; Secure cookies; HttpOnly/SameSite=Lax session; no-store responses")
        print("No synthetic account created.")
        return
    token = csrf(admin, admin_jar)
    fixture = {
        "email": f"smoke-{secrets.token_hex(6)}@issueatlas.test",
        "password": secrets.token_urlsafe(24), "name": "배포 검증용 비활성 계정", "role": "VIEWER"
    }
    request(admin, "/v1/admin/users", "POST", fixture, expected=403)
    created = request(admin, "/v1/admin/users", "POST", fixture, token, 201)
    try:
        viewer, viewer_jar = client()
        viewer_token = csrf(viewer, viewer_jar)
        request(viewer, "/v1/auth/login", "POST", {
            "email": fixture["email"], "password": fixture["password"]
        }, viewer_token)
        assert request(viewer, "/v1/auth/me")["role"] == "VIEWER"
        viewer_token = csrf(viewer, viewer_jar)
        request(viewer, "/v1/admin/users", "POST", fixture, viewer_token, 403)
    finally:
        token = csrf(admin, admin_jar)
        request(admin, f"/v1/admin/users/{created['id']}", "PATCH", {"is_active": False}, token)
    request(admin, "/v1/auth/logout", "POST", token=csrf(admin, admin_jar), expected=204)
    request(admin, "/v1/auth/me", expected=401)
    print("PASS: real CSRF cookies/headers; ADMIN login/me; missing CSRF 403; VIEWER admin 403; logout")
    print("Synthetic VIEWER deactivated; its record retained for traceability.")


if __name__ == "__main__":
    main()
